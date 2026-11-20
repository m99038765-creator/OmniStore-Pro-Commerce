import { Order, Product, SkuAuditLogEntry } from '../types';

export type IntegrityAnomalyStatus = 'critical_anomaly' | 'anomaly' | 'verified';

export interface StockTrendPoint {
  bucketIndex: number;
  dateLabel: string;
  stock: number;
  salesUnits: number;
  unmatchedDecreaseUnits: number;
  hasAnomaly: boolean;
}

export interface UnmatchedDecreaseEvent {
  id: string;
  timestamp: string;
  formattedDate: string;
  delta: number; // negative number
  previousStock: number;
  newStock: number;
  operatorId: string;
  reason: string;
  notes?: string;
  adjustmentType: SkuAuditLogEntry['adjustmentType'];
  salesRecordStatus: 'no_sales_record' | 'partial_sales_mismatch';
}

export interface SkuInventoryIntegrityRow {
  productId: string;
  sku: string;
  productName: string;
  category: Product['category'];
  warehouse: string;
  shortWarehouse: string;
  unitPrice: number;
  startStock30d: number;
  currentStock: number;
  netChange30d: number;
  fluctuationPercent: number;
  restockedUnits30d: number;
  totalDecreaseUnits30d: number;
  recordedSalesUnits30d: number;
  orderCount30d: number;
  unmatchedDecreaseUnits: number;
  estimatedShrinkageValue: number;
  integrityScore: number; // 0 to 100
  status: IntegrityAnomalyStatus;
  primaryAnomalyReason: string | null;
  anomalyEvents: UnmatchedDecreaseEvent[];
  trend30d: StockTrendPoint[];
}

export interface InventoryIntegritySummaryReport {
  generatedAt: string;
  windowDays: number;
  totalSkusAnalyzed: number;
  flaggedAnomalySkusCount: number;
  criticalAnomalyCount: number;
  verifiedSkusCount: number;
  totalDecreaseUnits30d: number;
  totalRecordedSalesUnits30d: number;
  totalUnmatchedDecreaseUnits: number;
  estimatedAtRiskValue: number;
  overallIntegrityPercent: number;
  rows: SkuInventoryIntegrityRow[];
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const BUCKET_COUNT = 10; // 10 x 3-day buckets = 30 days
const BUCKET_MS = THIRTY_DAYS_MS / BUCKET_COUNT;

function formatShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${min}`;
}

function shortenWarehouse(name: string): string {
  return (name || '').split('(')[0].trim() || name;
}

/**
 * Generates a 30-day Inventory Integrity Summary across all catalog SKUs,
 * comparing 30-day stock decreases (audit trail deductions & cycle adjustments)
 * against recorded customer sales orders to flag anomalies where stock decreased
 * without a corresponding sales record.
 */
export function computeInventoryIntegritySummary(
  products: Product[],
  orders: Order[],
  auditLogs: SkuAuditLogEntry[]
): InventoryIntegritySummaryReport {
  const nowMs = Date.now();
  const windowStartMs = nowMs - THIRTY_DAYS_MS;

  // Index 30-day sales orders by productId and SKU
  interface SalesMatchEntry {
    timestampMs: number;
    quantity: number;
    orderNumber: string;
  }

  const salesByProductId = new Map<string, SalesMatchEntry[]>();
  const salesBySku = new Map<string, SalesMatchEntry[]>();

  orders.forEach((order) => {
    const orderTs = new Date(order.createdAt).getTime();
    const effectiveTs = Number.isFinite(orderTs) ? orderTs : nowMs - 2 * 24 * 60 * 60 * 1000;
    if (effectiveTs < windowStartMs) return;

    order.items.forEach((item) => {
      const entry: SalesMatchEntry = {
        timestampMs: effectiveTs,
        quantity: item.quantity,
        orderNumber: order.orderNumber
      };

      const prodList = salesByProductId.get(item.productId) || [];
      prodList.push(entry);
      salesByProductId.set(item.productId, prodList);

      const skuKey = (item.sku || '').trim().toUpperCase();
      if (skuKey) {
        const skuList = salesBySku.get(skuKey) || [];
        skuList.push(entry);
        salesBySku.set(skuKey, skuList);
      }
    });
  });

  // Index 30-day audit logs by SKU
  const logsBySku = new Map<string, SkuAuditLogEntry[]>();
  auditLogs.forEach((log) => {
    const logTs = new Date(log.timestamp).getTime();
    if (!Number.isFinite(logTs) || logTs < windowStartMs) return;
    const key = (log.sku || '').trim().toUpperCase();
    if (!key) return;
    const list = logsBySku.get(key) || [];
    list.push(log);
    logsBySku.set(key, list);
  });

  const rows: SkuInventoryIntegrityRow[] = products.map((product) => {
    const skuKey = product.sku.trim().toUpperCase();
    const productLogs = [...(logsBySku.get(skuKey) || [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Combine matching sales entries (deduplicated by orderNumber + timestamp)
    const rawSales = [
      ...(salesByProductId.get(product.id) || []),
      ...(salesBySku.get(skuKey) || [])
    ];
    const seenOrders = new Set<string>();
    const productSales: SalesMatchEntry[] = [];
    rawSales.forEach((s) => {
      const k = `${s.orderNumber}-${s.timestampMs}-${s.quantity}`;
      if (!seenOrders.has(k)) {
        seenOrders.add(k);
        productSales.push(s);
      }
    });

    const recordedSalesUnits30d = productSales.reduce((acc, s) => acc + s.quantity, 0);
    const orderCount30d = productSales.length;

    let restockedUnits30d = 0;
    let loggedDecreases30d = 0;
    const anomalyEvents: UnmatchedDecreaseEvent[] = [];

    // Track bucketed deltas for the 30-day trend sparkline
    const bucketNetDeltas = new Array<number>(BUCKET_COUNT).fill(0);
    const bucketSales = new Array<number>(BUCKET_COUNT).fill(0);
    const bucketUnmatchedDecrease = new Array<number>(BUCKET_COUNT).fill(0);

    const tsToBucket = (tsMs: number): number => {
      const idx = Math.floor((tsMs - windowStartMs) / BUCKET_MS);
      return Math.max(0, Math.min(BUCKET_COUNT - 1, idx));
    };

    // Place recorded sales into buckets
    productSales.forEach((sale) => {
      const b = tsToBucket(sale.timestampMs);
      bucketSales[b] += sale.quantity;
      bucketNetDeltas[b] -= sale.quantity;
    });

    // Evaluate audit log movements in the 30-day window
    productLogs.forEach((log) => {
      const logTs = new Date(log.timestamp).getTime();
      const b = tsToBucket(logTs);
      const delta = log.adjustmentValue || 0;

      if (delta > 0) {
        restockedUnits30d += delta;
        bucketNetDeltas[b] += delta;
      } else if (delta < 0) {
        const absLoss = Math.abs(delta);
        loggedDecreases30d += absLoss;
        bucketNetDeltas[b] += delta;

        // Check if there is a matching sales order near this stock decrease (+/- 48 hours)
        const nearbySalesUnits = productSales
          .filter((s) => Math.abs(s.timestampMs - logTs) <= 48 * 60 * 60 * 1000)
          .reduce((acc, s) => acc + s.quantity, 0);

        const reasonLower = `${log.reason || ''} ${log.notes || ''}`.toLowerCase();
        const explicitlyNonSales =
          reasonLower.includes('damage') ||
          reasonLower.includes('write-off') ||
          reasonLower.includes('variance') ||
          reasonLower.includes('cycle') ||
          reasonLower.includes('demo') ||
          reasonLower.includes('quarantin') ||
          reasonLower.includes('missing') ||
          reasonLower.includes('shrink') ||
          reasonLower.includes('dispatch') ||
          reasonLower.includes('allocation');

        if (explicitlyNonSales || nearbySalesUnits < absLoss) {
          const unmatched = explicitlyNonSales
            ? absLoss
            : Math.max(1, absLoss - nearbySalesUnits);
          bucketUnmatchedDecrease[b] += unmatched;

          anomalyEvents.push({
            id: log.id,
            timestamp: log.timestamp,
            formattedDate: formatDateTime(log.timestamp),
            delta,
            previousStock: log.previousStock,
            newStock: log.newStock,
            operatorId: log.operatorId,
            reason: log.reason,
            notes: log.notes,
            adjustmentType: log.adjustmentType,
            salesRecordStatus:
              nearbySalesUnits === 0 || explicitlyNonSales
                ? 'no_sales_record'
                : 'partial_sales_mismatch'
          });
        }
      }
    });

    const totalDecreaseUnits30d = loggedDecreases30d + recordedSalesUnits30d;
    const unmatchedDecreaseUnits = anomalyEvents.reduce(
      (acc, e) => acc + Math.abs(e.delta),
      0
    );

    // Reconstruct 10-point 30-day stock curve working backwards from currentStock
    const stockAtBucketEnd = new Array<number>(BUCKET_COUNT).fill(product.stock);
    let runningStock = product.stock;
    for (let i = BUCKET_COUNT - 1; i >= 0; i--) {
      stockAtBucketEnd[i] = Math.max(0, runningStock);
      // Reverse the net delta to estimate prior bucket level
      runningStock = Math.max(0, runningStock - bucketNetDeltas[i]);
    }
    const startStock30d = Math.max(0, runningStock);

    const trend30d: StockTrendPoint[] = stockAtBucketEnd.map((stk, idx) => {
      const pointDate = new Date(windowStartMs + (idx + 1) * BUCKET_MS);
      return {
        bucketIndex: idx,
        dateLabel: formatShortDate(pointDate),
        stock: stk,
        salesUnits: bucketSales[idx],
        unmatchedDecreaseUnits: bucketUnmatchedDecrease[idx],
        hasAnomaly: bucketUnmatchedDecrease[idx] > 0
      };
    });

    const netChange30d = product.stock - startStock30d;
    const fluctuationPercent =
      startStock30d > 0
        ? Math.round((netChange30d / startStock30d) * 1000) / 10
        : netChange30d > 0
        ? 100
        : 0;

    const estimatedShrinkageValue = unmatchedDecreaseUnits * product.price;

    // Integrity score penalizes unmatched non-sales stock decreases
    let integrityScore = 100;
    if (unmatchedDecreaseUnits > 0) {
      const denom = Math.max(1, product.stock + totalDecreaseUnits30d);
      const lossRatio = unmatchedDecreaseUnits / denom;
      integrityScore = Math.max(
        24,
        Math.round(100 - lossRatio * 75 - anomalyEvents.length * 6)
      );
    }

    let status: IntegrityAnomalyStatus = 'verified';
    if (unmatchedDecreaseUnits >= 2 || estimatedShrinkageValue >= 2000) {
      status = 'critical_anomaly';
    } else if (unmatchedDecreaseUnits > 0) {
      status = 'anomaly';
    }

    // Sort anomaly events newest first
    anomalyEvents.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      category: product.category,
      warehouse: product.warehouse,
      shortWarehouse: shortenWarehouse(product.warehouse),
      unitPrice: product.price,
      startStock30d,
      currentStock: product.stock,
      netChange30d,
      fluctuationPercent,
      restockedUnits30d,
      totalDecreaseUnits30d,
      recordedSalesUnits30d,
      orderCount30d,
      unmatchedDecreaseUnits,
      estimatedShrinkageValue,
      integrityScore,
      status,
      primaryAnomalyReason: anomalyEvents[0]?.reason || null,
      anomalyEvents,
      trend30d
    };
  });

  // Default sort: critical anomalies first, then anomalies, then largest unmatched loss
  const statusWeight: Record<IntegrityAnomalyStatus, number> = {
    critical_anomaly: 3,
    anomaly: 2,
    verified: 1
  };
  rows.sort((a, b) => {
    const sw = statusWeight[b.status] - statusWeight[a.status];
    if (sw !== 0) return sw;
    if (b.unmatchedDecreaseUnits !== a.unmatchedDecreaseUnits) {
      return b.unmatchedDecreaseUnits - a.unmatchedDecreaseUnits;
    }
    return Math.abs(b.netChange30d) - Math.abs(a.netChange30d);
  });

  const flaggedAnomalySkusCount = rows.filter((r) => r.status !== 'verified').length;
  const criticalAnomalyCount = rows.filter((r) => r.status === 'critical_anomaly').length;
  const verifiedSkusCount = rows.length - flaggedAnomalySkusCount;
  const totalDecreaseUnits30d = rows.reduce((acc, r) => acc + r.totalDecreaseUnits30d, 0);
  const totalRecordedSalesUnits30d = rows.reduce((acc, r) => acc + r.recordedSalesUnits30d, 0);
  const totalUnmatchedDecreaseUnits = rows.reduce((acc, r) => acc + r.unmatchedDecreaseUnits, 0);
  const estimatedAtRiskValue = rows.reduce((acc, r) => acc + r.estimatedShrinkageValue, 0);
  const overallIntegrityPercent =
    rows.length > 0
      ? Math.round(
          (rows.reduce((acc, r) => acc + r.integrityScore, 0) / rows.length) * 10
        ) / 10
      : 100;

  return {
    generatedAt: new Date().toISOString(),
    windowDays: 30,
    totalSkusAnalyzed: rows.length,
    flaggedAnomalySkusCount,
    criticalAnomalyCount,
    verifiedSkusCount,
    totalDecreaseUnits30d,
    totalRecordedSalesUnits30d,
    totalUnmatchedDecreaseUnits,
    estimatedAtRiskValue,
    overallIntegrityPercent,
    rows
  };
}
