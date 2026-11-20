import {
  AutoReplenishmentDraftPO,
  AutoRestockRequest,
  CategoryDepletionReport,
  Order,
  SkuAuditLogEntry
} from '../types';

export type RestockEfficiencyStatus = 'optimal' | 'under_restocking' | 'critical_deficit' | 'over_restocking';

export interface RestockEfficiencyMetrics {
  /** Ratio of restock order inflow rate (u/day) to actual sales velocity (u/day). Ideal = 1.00x */
  ratio: number;
  /** Ratio expressed as a percentage (e.g. 96 means 96% of sales velocity covered) */
  efficiencyPercent: number;
  status: RestockEfficiencyStatus;
  statusLabel: string;
  /** Daily restock inflow rate (units/day) */
  restockRatePerDay: number;
  /** Actual warehouse sales velocity (units/day) */
  actualSalesVelocityPerDay: number;
  /** Total restock order units observed in active window */
  totalRestockUnits: number;
  /** Executed restock units from warehouse audit logs */
  executedRestockUnits: number;
  /** Open/pending restock units from Auto-Restock requests & Draft POs */
  queuedRestockUnits: number;
  /** Total restock order events counted (executed + active queued) */
  restockOrderCount: number;
  /** Executed restock orders count */
  executedOrderCount: number;
  /** Active queued restock orders count */
  queuedOrderCount: number;
  /** Effective lookback window in days used to normalize restock rate */
  windowDays: number;
  /** Suggested daily unit adjustment to reach 1.0x optimal parity */
  recommendedDailyDelta: number;
  /** Short actionable optimization guidance for warehouse managers */
  optimizationTip: string;
  /** Marker position (0..100%) on a 0.0x .. 1.6x visual gauge */
  gaugePositionPercent: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * DAY_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;

function isRestockAuditEntry(entry: SkuAuditLogEntry): boolean {
  if (!entry || (entry.adjustmentValue || 0) <= 0) return false;
  if (entry.adjustmentType === 'restock') return true;
  const text = `${entry.reason || ''} ${entry.notes || ''}`.toLowerCase();
  if (
    text.includes('restock') ||
    text.includes('replenish') ||
    text.includes('inbound') ||
    text.includes('resupply') ||
    text.includes('vendor') ||
    text.includes('po-') ||
    text.includes('purchase order') ||
    text.includes('dock receipt') ||
    text.includes('assembly')
  ) {
    return true;
  }
  return entry.adjustmentType === 'add';
}

/**
 * Computes 'Restock Efficiency' — the ratio of restock order inflow rate
 * to actual warehouse sales velocity — to help managers calibrate replenishment quantities.
 */
export function computeRestockEfficiencyMetrics(params: {
  report: CategoryDepletionReport | null;
  orders: Order[];
  auditLogs: SkuAuditLogEntry[];
  autoRestockRequests?: AutoRestockRequest[];
  autoReplenishmentDraftPOs?: AutoReplenishmentDraftPO[];
  nowMs?: number;
}): RestockEfficiencyMetrics {
  const {
    report,
    orders,
    auditLogs,
    autoRestockRequests = [],
    autoReplenishmentDraftPOs = [],
    nowMs = Date.now()
  } = params;

  // 1. Determine actual sales velocity (units/day) aligned with the Predictive Insights report
  const recentOrderUnits7d = orders.reduce((acc, ord) => {
    const ts = new Date(ord.createdAt).getTime();
    if (Number.isFinite(ts) && nowMs - ts <= THIRTY_DAYS_MS) {
      return acc + ord.items.reduce((s, item) => s + (item.quantity || 0), 0);
    }
    return acc;
  }, 0);

  const reportVelocity = report?.overallWarehouseDepletionVelocity || 0;
  const actualSalesVelocityPerDay =
    reportVelocity > 0
      ? Math.round(reportVelocity * 10) / 10
      : Math.max(1, Math.round((recentOrderUnits7d / 7) * 10) / 10);

  // 2. Collect executed restock orders from warehouse audit logs (prefer 7-day operational cycle, fall back to 30d)
  const restockLogs7d = auditLogs.filter(log => {
    if (!isRestockAuditEntry(log)) return false;
    const ts = new Date(log.timestamp).getTime();
    return Number.isFinite(ts) && nowMs - ts <= SEVEN_DAYS_MS;
  });

  const activeLogs =
    restockLogs7d.length > 0
      ? restockLogs7d
      : auditLogs.filter(log => {
          if (!isRestockAuditEntry(log)) return false;
          const ts = new Date(log.timestamp).getTime();
          return Number.isFinite(ts) && nowMs - ts <= THIRTY_DAYS_MS;
        });

  const executedRestockUnits = activeLogs.reduce((sum, l) => sum + Math.max(0, l.adjustmentValue), 0);
  const executedOrderCount = activeLogs.length;

  // Determine the actual observed span of restock activity (clamped 2..7 days for 7d logs, or up to 30d)
  let windowDays = 7;
  if (activeLogs.length > 0) {
    const earliestTs = activeLogs.reduce((min, l) => {
      const ts = new Date(l.timestamp).getTime();
      return Number.isFinite(ts) && ts < min ? ts : min;
    }, nowMs);
    const spanDays = Math.ceil(Math.max(1, nowMs - earliestTs) / DAY_MS);
    windowDays = restockLogs7d.length > 0 ? Math.max(2, Math.min(7, spanDays)) : Math.max(7, Math.min(30, spanDays));
  }

  // 3. Include active queued restock orders (pending Auto-Restock requests & open Draft POs not yet fulfilled)
  const pendingAutoRequests = autoRestockRequests.filter(r => r.status === 'pending');
  const openDraftPOs = autoReplenishmentDraftPOs.filter(po => po.status === 'draft');

  const queuedRestockUnits =
    pendingAutoRequests.reduce((sum, r) => sum + Math.max(0, r.requestedQuantity), 0) +
    openDraftPOs.reduce((sum, po) => sum + Math.max(0, po.orderQuantity), 0);
  const queuedOrderCount = pendingAutoRequests.length + openDraftPOs.length;

  const totalRestockUnits = executedRestockUnits + queuedRestockUnits;
  const restockOrderCount = executedOrderCount + queuedOrderCount;

  // Normalize restock inflow rate to units/day across the observed cycle
  const restockRatePerDay = Math.round((totalRestockUnits / windowDays) * 10) / 10;

  // 4. Compute Restock Efficiency Ratio = Restock Rate / Actual Sales Velocity
  const rawRatio = actualSalesVelocityPerDay > 0 ? restockRatePerDay / actualSalesVelocityPerDay : 0;
  const ratio = Math.round(rawRatio * 100) / 100;
  const efficiencyPercent = Math.round(ratio * 100);

  // Target 1.00x optimal parity (healthy band: 0.85x – 1.15x)
  const recommendedDailyDelta = Math.round((actualSalesVelocityPerDay - restockRatePerDay) * 10) / 10;

  let status: RestockEfficiencyStatus;
  let statusLabel: string;
  let optimizationTip: string;

  if (ratio >= 0.85 && ratio <= 1.15) {
    status = 'optimal';
    statusLabel = 'Optimal Sync';
    optimizationTip = 'Replenishment quantities match live sales velocity (target 0.85x–1.15x).';
  } else if (ratio > 1.15) {
    status = 'over_restocking';
    statusLabel = 'Over-Restocking';
    const trimUnits = Math.max(1, Math.round(Math.abs(recommendedDailyDelta)));
    optimizationTip = `Inbound restocks exceed burn rate — trim batch qty by ~${trimUnits} u/day to curb holding cost.`;
  } else if (ratio >= 0.6) {
    status = 'under_restocking';
    statusLabel = 'Under-Restocking';
    const addUnits = Math.max(1, Math.round(Math.abs(recommendedDailyDelta)));
    optimizationTip = `Restocks trail sales velocity — raise replenishment by ~+${addUnits} u/day to avoid stockouts.`;
  } else {
    status = 'critical_deficit';
    statusLabel = 'Replenish Deficit';
    const addUnits = Math.max(1, Math.round(Math.abs(recommendedDailyDelta)));
    optimizationTip = `Severe inflow lag — boost restock orders by ~+${addUnits} u/day to stabilize buffers.`;
  }

  // Map 0.0x .. 1.6x onto 0% .. 100% gauge width (optimal band 0.85..1.15 sits cleanly at 53%..72%)
  const gaugePositionPercent = Math.max(2, Math.min(98, Math.round((ratio / 1.6) * 100)));

  return {
    ratio,
    efficiencyPercent,
    status,
    statusLabel,
    restockRatePerDay,
    actualSalesVelocityPerDay,
    totalRestockUnits,
    executedRestockUnits,
    queuedRestockUnits,
    restockOrderCount,
    executedOrderCount,
    queuedOrderCount,
    windowDays,
    recommendedDailyDelta,
    optimizationTip,
    gaugePositionPercent
  };
}
