import { Product, SkuAuditLogEntry } from '../types';
import { isAuditEntryQuarantineOrDamaged } from './skuAuditSafety';
import { SkuRegionalConflict } from './inventoryConflicts';

export type DiscrepancyRiskTier = 'critical' | 'high' | 'elevated' | 'healthy';

export interface WarehouseSubZoneMetric {
  zoneId: string;
  zoneCode: 'Z-A' | 'Z-B' | 'Z-C' | 'Z-D';
  zoneName: string;
  warehouseName: string;
  discrepancyCount: number;
  varianceUnits: number;
  flaggedSkuCount: number;
  heatScore: number; // 0 to 100
  riskTier: DiscrepancyRiskTier;
  affectedSkus: string[];
  primaryIssue: string;
}

export interface WarehouseDiscrepancySummary {
  warehouseName: string;
  shortName: string;
  discrepancyCount: number;
  varianceUnits: number;
  conflictCount: number;
  flaggedAuditCount: number;
  heatScore: number; // 0 to 100
  riskTier: DiscrepancyRiskTier;
  affectedSkus: string[];
  zones: WarehouseSubZoneMetric[];
  hottestZone: WarehouseSubZoneMetric;
}

export interface CategoryDiscrepancyMetric {
  categoryId: string;
  discrepancyCount: number;
  varianceUnits: number;
  heatScore: number; // 0 to 100
  riskTier: DiscrepancyRiskTier;
  hottestWarehouse: string | null;
}

const ZONE_DEFINITIONS: {
  code: 'Z-A' | 'Z-B' | 'Z-C' | 'Z-D';
  name: string;
}[] = [
  { code: 'Z-A', name: 'Inbound & QA Hold' },
  { code: 'Z-B', name: 'Bulk Racking' },
  { code: 'Z-C', name: 'High-Velocity Pick' },
  { code: 'Z-D', name: 'Express Staging' }
];

function normalizeWh(name: string): string {
  return (name || '').split('(')[0].trim().toLowerCase();
}

function shortenWh(name: string): string {
  return (name || '').split('(')[0].trim() || name;
}

function scoreToTier(score: number): DiscrepancyRiskTier {
  if (score >= 72) return 'critical';
  if (score >= 48) return 'high';
  if (score >= 22) return 'elevated';
  return 'healthy';
}

function classifyAuditEntryZone(entry: SkuAuditLogEntry): 'Z-A' | 'Z-B' | 'Z-C' | 'Z-D' {
  const combined = `${entry.reason || ''} ${entry.notes || ''}`.toLowerCase();
  const safety = isAuditEntryQuarantineOrDamaged(entry);
  if (safety.isFlagged || combined.includes('qa') || combined.includes('quarantin') || combined.includes('damage')) {
    return 'Z-A';
  }
  if (combined.includes('staging') || combined.includes('dispatch') || combined.includes('express') || combined.includes('transfer')) {
    return 'Z-D';
  }
  if (entry.adjustmentType === 'cycle_count' || combined.includes('cycle') || combined.includes('variance') || combined.includes('scan')) {
    return 'Z-C';
  }
  return 'Z-B';
}

export type DiscrepancyTypeTag =
  | 'regional_conflict'
  | 'quarantine_damaged'
  | 'cycle_variance'
  | 'pick_bin_shortage';

export interface ChartSkuDiscrepancy {
  sku: string;
  productId: string;
  productName: string;
  category: Product['category'];
  warehouse: string;
  shortWarehouse: string;
  currentStock: number;
  lowStockThreshold: number;
  discrepancyCount: number;
  varianceUnits: number;
  discrepancyTypes: DiscrepancyTypeTag[];
  zones: ('Z-A' | 'Z-B' | 'Z-C' | 'Z-D')[];
  severity: 'critical' | 'high' | 'elevated';
  summaryReason: string;
  latestTimestamp: string;
}

/**
 * Computes stock discrepancy heat metrics across every warehouse location,
 * its 4 operational sub-zones, and product categories from live audit logs,
 * regional conflicts, and catalog stock anomalies.
 */
export function computeWarehouseDiscrepancyHeatmap(
  products: Product[],
  auditLogs: SkuAuditLogEntry[],
  regionalConflicts: SkuRegionalConflict[],
  reconciledSkus: string[] = []
): {
  warehouses: WarehouseDiscrepancySummary[];
  warehouseByNorm: Record<string, WarehouseDiscrepancySummary>;
  byCategory: Record<string, CategoryDiscrepancyMetric>;
  totalDiscrepancies: number;
  hotZoneCount: number;
} {
  const reconciledSet = new Set(reconciledSkus.map((s) => s.trim().toUpperCase()));

  // Track latest batch-reconciliation timestamp per SKU so older discrepancies are cleared
  const latestBatchReconcileTs = new Map<string, number>();
  auditLogs.forEach((log) => {
    const rLower = (log.reason || '').toLowerCase();
    if (rLower.includes('batch clear & reconcile') || rLower.includes('auditor clearance')) {
      const key = (log.sku || '').trim().toUpperCase();
      const ts = new Date(log.timestamp).getTime();
      if (Number.isFinite(ts)) {
        const prev = latestBatchReconcileTs.get(key) || 0;
        if (ts > prev) latestBatchReconcileTs.set(key, ts);
      }
    }
  });

  // Gather all distinct warehouse names from products, audit logs, and conflicts
  const canonicalNames = new Map<string, string>();
  const registerWh = (name?: string) => {
    if (!name) return;
    const norm = normalizeWh(name);
    if (!norm) return;
    if (!canonicalNames.has(norm)) {
      canonicalNames.set(norm, name);
    }
  };

  products.forEach((p) => registerWh(p.warehouse));
  auditLogs.forEach((l) => registerWh(l.warehouse));
  regionalConflicts.forEach((c) => {
    registerWh(c.primaryWarehouse);
    registerWh(c.conflictingWarehouse);
  });

  const productBySku = new Map<string, Product>();
  products.forEach((p) => productBySku.set(p.sku.toUpperCase(), p));

  // Initialize warehouse buckets
  interface ZoneAcc {
    discrepancyCount: number;
    varianceUnits: number;
    skus: Set<string>;
    reasons: string[];
  }
  interface WhAcc {
    warehouseName: string;
    discrepancyCount: number;
    varianceUnits: number;
    conflictCount: number;
    flaggedAuditCount: number;
    skus: Set<string>;
    zones: Record<'Z-A' | 'Z-B' | 'Z-C' | 'Z-D', ZoneAcc>;
  }

  const whMap = new Map<string, WhAcc>();
  const ensureWh = (name: string): WhAcc => {
    const norm = normalizeWh(name);
    let existing = whMap.get(norm);
    if (!existing) {
      existing = {
        warehouseName: canonicalNames.get(norm) || name,
        discrepancyCount: 0,
        varianceUnits: 0,
        conflictCount: 0,
        flaggedAuditCount: 0,
        skus: new Set<string>(),
        zones: {
          'Z-A': { discrepancyCount: 0, varianceUnits: 0, skus: new Set(), reasons: [] },
          'Z-B': { discrepancyCount: 0, varianceUnits: 0, skus: new Set(), reasons: [] },
          'Z-C': { discrepancyCount: 0, varianceUnits: 0, skus: new Set(), reasons: [] },
          'Z-D': { discrepancyCount: 0, varianceUnits: 0, skus: new Set(), reasons: [] }
        }
      };
      whMap.set(norm, existing);
    }
    return existing;
  };

  canonicalNames.forEach((fullName) => ensureWh(fullName));

  // Category discrepancy accumulator
  const catAcc: Record<
    string,
    { discrepancyCount: number; varianceUnits: number; whCounts: Record<string, number> }
  > = {
    audio: { discrepancyCount: 0, varianceUnits: 0, whCounts: {} },
    workstation: { discrepancyCount: 0, varianceUnits: 0, whCounts: {} },
    computing: { discrepancyCount: 0, varianceUnits: 0, whCounts: {} },
    optics: { discrepancyCount: 0, varianceUnits: 0, whCounts: {} },
    peripherals: { discrepancyCount: 0, varianceUnits: 0, whCounts: {} }
  };

  const recordCategoryDiscrepancy = (sku: string, whName: string, count: number, variance: number) => {
    const prod = productBySku.get(sku.toUpperCase());
    if (!prod || !catAcc[prod.category]) return;
    catAcc[prod.category].discrepancyCount += count;
    catAcc[prod.category].varianceUnits += variance;
    const short = shortenWh(whName);
    catAcc[prod.category].whCounts[short] = (catAcc[prod.category].whCounts[short] || 0) + count;
  };

  // 1. Score audit log discrepancies (cycle counts, write-offs, quarantine/damage flags, variance reconciliations)
  auditLogs.forEach((log) => {
    const skuKey = (log.sku || '').trim().toUpperCase();
    if (reconciledSet.has(skuKey)) return;
    const clearedAt = latestBatchReconcileTs.get(skuKey);
    const logTs = new Date(log.timestamp).getTime();
    if (clearedAt && Number.isFinite(logTs) && logTs <= clearedAt) return;

    const reasonLower = (log.reason || '').toLowerCase();
    const notesLower = (log.notes || '').toLowerCase();
    const combined = `${reasonLower} ${notesLower}`;
    if (reasonLower.includes('batch clear & reconcile') || reasonLower.includes('regional conflict reconciled')) {
      return;
    }

    const safety = isAuditEntryQuarantineOrDamaged(log);

    const isDiscrepancy =
      safety.isFlagged ||
      log.adjustmentType === 'cycle_count' ||
      log.adjustmentType === 'subtract' ||
      combined.includes('discrepancy') ||
      combined.includes('variance') ||
      combined.includes('write-off') ||
      combined.includes('missing');

    if (!isDiscrepancy) return;

    const acc = ensureWh(log.warehouse || 'Bay Area Hub (WH-01)');
    const zoneCode = classifyAuditEntryZone(log);
    const variance = Math.max(1, Math.abs(log.adjustmentValue || 1));
    const weight = safety.isFlagged ? 2 : 1;

    acc.discrepancyCount += weight;
    acc.varianceUnits += variance;
    if (safety.isFlagged) acc.flaggedAuditCount += 1;
    acc.skus.add(log.sku);

    const z = acc.zones[zoneCode];
    z.discrepancyCount += weight;
    z.varianceUnits += variance;
    z.skus.add(log.sku);
    z.reasons.push(log.reason);

    recordCategoryDiscrepancy(log.sku, acc.warehouseName, weight, variance);
  });

  // 2. Score active cross-regional conflicts
  regionalConflicts.forEach((conflict) => {
    const skuKey = conflict.sku.trim().toUpperCase();
    if (reconciledSet.has(skuKey)) return;
    const deltaAbs = Math.max(1, Math.abs(conflict.delta));

    // Primary warehouse: Express Staging / Pick conflict
    const primaryAcc = ensureWh(conflict.primaryWarehouse);
    primaryAcc.discrepancyCount += 2;
    primaryAcc.varianceUnits += deltaAbs;
    primaryAcc.conflictCount += 1;
    primaryAcc.skus.add(conflict.sku);
    primaryAcc.zones['Z-D'].discrepancyCount += 2;
    primaryAcc.zones['Z-D'].varianceUnits += deltaAbs;
    primaryAcc.zones['Z-D'].skus.add(conflict.sku);
    primaryAcc.zones['Z-D'].reasons.push(`Regional sync conflict (${conflict.delta >= 0 ? `+${conflict.delta}` : conflict.delta} units)`);

    // Conflicting warehouse: Bulk Racking drift
    const confAcc = ensureWh(conflict.conflictingWarehouse);
    confAcc.discrepancyCount += 2;
    confAcc.varianceUnits += deltaAbs;
    confAcc.conflictCount += 1;
    confAcc.skus.add(conflict.sku);
    confAcc.zones['Z-B'].discrepancyCount += 2;
    confAcc.zones['Z-B'].varianceUnits += deltaAbs;
    confAcc.zones['Z-B'].skus.add(conflict.sku);
    confAcc.zones['Z-B'].reasons.push(`Cross-hub ledger drift on ${conflict.sku}`);

    recordCategoryDiscrepancy(conflict.sku, primaryAcc.warehouseName, 2, deltaAbs);
  });

  // 3. Score low-stock / out-of-stock pick-line pressure
  products.forEach((p) => {
    const skuKey = p.sku.trim().toUpperCase();
    if (reconciledSet.has(skuKey)) return;
    if (p.stock <= p.lowStockThreshold) {
      const acc = ensureWh(p.warehouse);
      const pressure = p.stock === 0 ? 2 : 1;
      acc.discrepancyCount += pressure;
      acc.skus.add(p.sku);
      acc.zones['Z-C'].discrepancyCount += pressure;
      acc.zones['Z-C'].varianceUnits += Math.max(1, p.lowStockThreshold - p.stock);
      acc.zones['Z-C'].skus.add(p.sku);
      acc.zones['Z-C'].reasons.push(
        p.stock === 0
          ? `Depleted pick bin (${p.sku})`
          : `Below safety threshold (${p.stock}/${p.lowStockThreshold})`
      );
      recordCategoryDiscrepancy(p.sku, acc.warehouseName, pressure, Math.max(1, p.lowStockThreshold - p.stock));
    }
  });

  // Normalize scores across warehouses & sub-zones
  const allAccs = Array.from(whMap.values());
  const maxWhRaw = Math.max(
    1,
    ...allAccs.map((w) => w.discrepancyCount * 3 + w.varianceUnits)
  );
  const maxZoneRaw = Math.max(
    1,
    ...allAccs.flatMap((w) =>
      ZONE_DEFINITIONS.map((zd) => {
        const z = w.zones[zd.code];
        return z.discrepancyCount * 3 + z.varianceUnits;
      })
    )
  );

  const warehouseByNorm: Record<string, WarehouseDiscrepancySummary> = {};
  let hotZoneCount = 0;
  let totalDiscrepancies = 0;

  const warehouses: WarehouseDiscrepancySummary[] = allAccs
    .map((acc) => {
      const rawWh = acc.discrepancyCount * 3 + acc.varianceUnits;
      const heatScore = acc.discrepancyCount === 0 ? 6 : Math.min(100, Math.round((rawWh / maxWhRaw) * 92 + 8));

      const zones: WarehouseSubZoneMetric[] = ZONE_DEFINITIONS.map((zd) => {
        const z = acc.zones[zd.code];
        const rawZ = z.discrepancyCount * 3 + z.varianceUnits;
        const zScore =
          z.discrepancyCount === 0
            ? 5
            : Math.min(100, Math.round((rawZ / maxZoneRaw) * 90 + 10));
        const zTier = scoreToTier(zScore);
        if (zTier === 'critical' || zTier === 'high') {
          hotZoneCount += 1;
        }
        return {
          zoneId: `${normalizeWh(acc.warehouseName)}::${zd.code}`,
          zoneCode: zd.code,
          zoneName: zd.name,
          warehouseName: acc.warehouseName,
          discrepancyCount: z.discrepancyCount,
          varianceUnits: z.varianceUnits,
          flaggedSkuCount: z.skus.size,
          heatScore: zScore,
          riskTier: zTier,
          affectedSkus: Array.from(z.skus),
          primaryIssue: z.reasons[0] || 'No active stock discrepancies'
        };
      });

      const hottestZone = [...zones].sort((a, b) => b.heatScore - a.heatScore)[0];
      totalDiscrepancies += acc.discrepancyCount;

      const summary: WarehouseDiscrepancySummary = {
        warehouseName: acc.warehouseName,
        shortName: shortenWh(acc.warehouseName),
        discrepancyCount: acc.discrepancyCount,
        varianceUnits: acc.varianceUnits,
        conflictCount: acc.conflictCount,
        flaggedAuditCount: acc.flaggedAuditCount,
        heatScore,
        riskTier: scoreToTier(heatScore),
        affectedSkus: Array.from(acc.skus),
        zones,
        hottestZone
      };

      warehouseByNorm[normalizeWh(acc.warehouseName)] = summary;
      return summary;
    })
    .sort((a, b) => b.heatScore - a.heatScore);

  const maxCatRaw = Math.max(
    1,
    ...Object.values(catAcc).map((c) => c.discrepancyCount * 3 + c.varianceUnits)
  );
  const byCategory: Record<string, CategoryDiscrepancyMetric> = {};
  Object.entries(catAcc).forEach(([catId, c]) => {
    const raw = c.discrepancyCount * 3 + c.varianceUnits;
    const score =
      c.discrepancyCount === 0
        ? 0
        : Math.min(100, Math.round((raw / maxCatRaw) * 90 + 10));
    const hottestEntry = Object.entries(c.whCounts).sort((a, b) => b[1] - a[1])[0];
    byCategory[catId] = {
      categoryId: catId,
      discrepancyCount: c.discrepancyCount,
      varianceUnits: c.varianceUnits,
      heatScore: score,
      riskTier: scoreToTier(score),
      hottestWarehouse: hottestEntry ? hottestEntry[0] : null
    };
  });

  return {
    warehouses,
    warehouseByNorm,
    byCategory,
    totalDiscrepancies,
    hotZoneCount
  };
}

/**
 * Returns a deduplicated list of active SKU-level discrepancies surfaced by the
 * Warehouse Inventory Chart (regional conflicts, quarantine/damaged holds,
 * cycle-count variances, and low-stock pick-bin shortages) for multi-SKU Batch Reconcile.
 */
export function getChartSkuDiscrepancies(
  products: Product[],
  auditLogs: SkuAuditLogEntry[],
  regionalConflicts: SkuRegionalConflict[],
  reconciledSkus: string[] = []
): ChartSkuDiscrepancy[] {
  const reconciledSet = new Set(reconciledSkus.map((s) => s.trim().toUpperCase()));

  const latestBatchReconcileTs = new Map<string, number>();
  auditLogs.forEach((log) => {
    const rLower = (log.reason || '').toLowerCase();
    if (rLower.includes('batch clear & reconcile') || rLower.includes('auditor clearance')) {
      const key = (log.sku || '').trim().toUpperCase();
      const ts = new Date(log.timestamp).getTime();
      if (Number.isFinite(ts)) {
        const prev = latestBatchReconcileTs.get(key) || 0;
        if (ts > prev) latestBatchReconcileTs.set(key, ts);
      }
    }
  });

  const productBySku = new Map<string, Product>();
  products.forEach((p) => productBySku.set(p.sku.trim().toUpperCase(), p));

  interface SkuAcc {
    sku: string;
    productId: string;
    productName: string;
    category: Product['category'];
    warehouse: string;
    currentStock: number;
    lowStockThreshold: number;
    discrepancyCount: number;
    varianceUnits: number;
    types: Set<DiscrepancyTypeTag>;
    zones: Set<'Z-A' | 'Z-B' | 'Z-C' | 'Z-D'>;
    reasons: string[];
    latestTs: number;
  }

  const accMap = new Map<string, SkuAcc>();
  const ensureSku = (skuRaw: string, fallbackName?: string, fallbackWh?: string): SkuAcc => {
    const key = skuRaw.trim().toUpperCase();
    let existing = accMap.get(key);
    if (!existing) {
      const prod = productBySku.get(key);
      existing = {
        sku: prod?.sku || skuRaw,
        productId: prod?.id || key,
        productName: prod?.name || fallbackName || skuRaw,
        category: prod?.category || 'computing',
        warehouse: prod?.warehouse || fallbackWh || 'Bay Area Hub (WH-01)',
        currentStock: prod?.stock ?? 0,
        lowStockThreshold: prod?.lowStockThreshold ?? 4,
        discrepancyCount: 0,
        varianceUnits: 0,
        types: new Set(),
        zones: new Set(),
        reasons: [],
        latestTs: 0
      };
      accMap.set(key, existing);
    }
    return existing;
  };

  // 1. Regional conflicts
  regionalConflicts.forEach((conflict) => {
    const key = conflict.sku.trim().toUpperCase();
    if (reconciledSet.has(key)) return;
    const item = ensureSku(conflict.sku, conflict.productName, conflict.primaryWarehouse);
    item.discrepancyCount += 2;
    item.varianceUnits += Math.max(1, Math.abs(conflict.delta));
    item.types.add('regional_conflict');
    item.zones.add('Z-D');
    item.zones.add('Z-B');
    item.reasons.push(conflict.reason);
    item.latestTs = Math.max(item.latestTs, Date.now());
  });

  // 2. Audit log discrepancies (quarantine, damage, cycle variance, subtractions)
  auditLogs.forEach((log) => {
    const key = (log.sku || '').trim().toUpperCase();
    if (!key || reconciledSet.has(key)) return;
    const clearedAt = latestBatchReconcileTs.get(key);
    const logTs = new Date(log.timestamp).getTime();
    if (clearedAt && Number.isFinite(logTs) && logTs <= clearedAt) return;

    const reasonLower = (log.reason || '').toLowerCase();
    const notesLower = (log.notes || '').toLowerCase();
    const combined = `${reasonLower} ${notesLower}`;
    if (reasonLower.includes('batch clear & reconcile') || reasonLower.includes('regional conflict reconciled')) {
      return;
    }

    const safety = isAuditEntryQuarantineOrDamaged(log);
    const isDiscrepancy =
      safety.isFlagged ||
      log.adjustmentType === 'cycle_count' ||
      log.adjustmentType === 'subtract' ||
      combined.includes('discrepancy') ||
      combined.includes('variance') ||
      combined.includes('write-off') ||
      combined.includes('missing');

    if (!isDiscrepancy) return;

    const item = ensureSku(log.sku, log.productName, log.warehouse);
    item.discrepancyCount += safety.isFlagged ? 2 : 1;
    item.varianceUnits += Math.max(1, Math.abs(log.adjustmentValue || 1));
    item.types.add(safety.isFlagged ? 'quarantine_damaged' : 'cycle_variance');
    item.zones.add(classifyAuditEntryZone(log));
    item.reasons.push(log.reason);
    if (Number.isFinite(logTs)) {
      item.latestTs = Math.max(item.latestTs, logTs);
    }
  });

  // 3. Low-stock / depleted pick-bin shortages
  products.forEach((p) => {
    const key = p.sku.trim().toUpperCase();
    if (reconciledSet.has(key)) return;
    if (p.stock <= p.lowStockThreshold) {
      const item = ensureSku(p.sku, p.name, p.warehouse);
      item.discrepancyCount += p.stock === 0 ? 2 : 1;
      item.varianceUnits += Math.max(1, p.lowStockThreshold - p.stock);
      item.types.add('pick_bin_shortage');
      item.zones.add('Z-C');
      item.reasons.push(
        p.stock === 0
          ? `Depleted pick bin (${p.sku})`
          : `Below safety threshold (${p.stock}/${p.lowStockThreshold} units)`
      );
      item.latestTs = Math.max(item.latestTs, Date.now() - 60_000);
    }
  });

  const severityOrder = { critical: 3, high: 2, elevated: 1 };

  return Array.from(accMap.values())
    .map((acc): ChartSkuDiscrepancy => {
      const types = Array.from(acc.types);
      let severity: 'critical' | 'high' | 'elevated' = 'elevated';
      if (
        types.includes('quarantine_damaged') ||
        (types.includes('regional_conflict') && acc.varianceUnits >= 3) ||
        acc.currentStock === 0
      ) {
        severity = 'critical';
      } else if (types.includes('regional_conflict') || acc.discrepancyCount >= 2) {
        severity = 'high';
      }

      return {
        sku: acc.sku,
        productId: acc.productId,
        productName: acc.productName,
        category: acc.category,
        warehouse: acc.warehouse,
        shortWarehouse: shortenWh(acc.warehouse),
        currentStock: acc.currentStock,
        lowStockThreshold: acc.lowStockThreshold,
        discrepancyCount: acc.discrepancyCount,
        varianceUnits: acc.varianceUnits,
        discrepancyTypes: types,
        zones: Array.from(acc.zones).sort(),
        severity,
        summaryReason: acc.reasons[0] || 'Stock discrepancy detected',
        latestTimestamp: acc.latestTs
          ? new Date(acc.latestTs).toISOString()
          : new Date().toISOString()
      };
    })
    .sort((a, b) => {
      const sevDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.discrepancyCount - a.discrepancyCount;
    });
}

