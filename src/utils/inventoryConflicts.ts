import { Product, SkuAuditLogEntry, WarehouseConflictEvent } from '../types';

export interface RegionalWarehouseSnapshot {
  warehouse: string;
  shortName: string;
  reportedStock: number;
  reservedStock: number;
  lastSyncedAt: string;
  status: 'authoritative' | 'conflicting' | 'stale';
}

export interface SkuRegionalConflict {
  sku: string;
  productId: string;
  productName: string;
  category: Product['category'];
  primaryWarehouse: string;
  conflictingWarehouse: string;
  primaryStock: number;
  conflictingStock: number;
  delta: number;
  severity: 'high' | 'medium';
  reason: string;
  detectedAt: string;
  hubSnapshots: RegionalWarehouseSnapshot[];
  source: 'regional_ledger' | 'live_collision' | 'audit_mismatch';
}

const ALL_REGIONAL_HUBS = [
  'Bay Area Hub (WH-01)',
  'East Coast DC (WH-02)',
  'Midwest Logistics (WH-03)',
  'Pacific Northwest Facility (WH-04)'
];

function normalizeWarehouseKey(name: string): string {
  return (name || '').split('(')[0].trim().toLowerCase();
}

function shortenWarehouseName(name: string): string {
  return (name || '').split('(')[0].trim() || name;
}

function pickSecondaryHub(primaryWarehouse: string, offset = 0): string {
  const normPrimary = normalizeWarehouseKey(primaryWarehouse);
  const candidates = ALL_REGIONAL_HUBS.filter(
    (h) => normalizeWarehouseKey(h) !== normPrimary
  );
  return candidates[offset % candidates.length] || 'East Coast DC (WH-02)';
}

/**
 * Known regional replication drift snapshots observed across secondary hubs
 * before manual reconciliation. Any SKU reconciled by the user is filtered out.
 */
const REGIONAL_LEDGER_DRIFT_CONFIG: Record<
  string,
  {
    conflictingWarehouse: string;
    stockOffset: number;
    reservedOffset: number;
    tertiaryWarehouse: string;
    tertiaryOffset: number;
    reason: string;
    minutesAgo: number;
  }
> = {
  'OPT-CIN-4K60': {
    conflictingWarehouse: 'East Coast DC (WH-02)',
    stockOffset: 3,
    reservedOffset: 1,
    tertiaryWarehouse: 'Midwest Logistics (WH-03)',
    tertiaryOffset: 0,
    reason:
      'Cross-region ledger drift: East Coast DC (WH-02) reports 3 unallocated transit units not reflected in Bay Area Hub (WH-01).',
    minutesAgo: 18
  },
  'AUD-HP-APEX': {
    conflictingWarehouse: 'Bay Area Hub (WH-01)',
    stockOffset: -4,
    reservedOffset: 2,
    tertiaryWarehouse: 'East Coast DC (WH-02)',
    tertiaryOffset: -1,
    reason:
      'Regional sync discrepancy: Bay Area Hub (WH-01) mirror reports 4 fewer units than Midwest Logistics (WH-03) after split-batch transfer.',
    minutesAgo: 42
  },
  'KB-TITAN-75': {
    conflictingWarehouse: 'Midwest Logistics (WH-03)',
    stockOffset: 2,
    reservedOffset: 1,
    tertiaryWarehouse: 'Bay Area Hub (WH-01)',
    tertiaryOffset: 0,
    reason:
      'Low-stock regional conflict: Midwest Logistics (WH-03) shows 2 pending restock units conflicting with East Coast DC (WH-02) count.',
    minutesAgo: 11
  }
};

/**
 * Evaluates whether a catalog SKU currently has conflicting inventory data
 * across different regional warehouses (from live collision events, cross-hub
 * audit log mismatches, or regional replication ledger drift).
 */
export function detectSkuRegionalConflict(
  product: Product,
  warehouseAuditLogs: SkuAuditLogEntry[] = [],
  warehouseConflicts: WarehouseConflictEvent[] = [],
  resolvedRegionalConflictSkus: string[] = []
): SkuRegionalConflict | null {
  const normalizedSku = product.sku.trim().toUpperCase();
  if (
    resolvedRegionalConflictSkus.some(
      (s) => s.trim().toUpperCase() === normalizedSku
    )
  ) {
    return null;
  }

  const primaryNorm = normalizeWarehouseKey(product.warehouse);

  // 1. Active live collision event (from SSE or conflict simulator)
  const liveCollision = warehouseConflicts.find(
    (c) =>
      !c.resolved &&
      (c.sku.trim().toUpperCase() === normalizedSku || c.productId === product.id)
  );

  if (liveCollision) {
    const conflictingWarehouse =
      normalizeWarehouseKey(liveCollision.warehouse) !== primaryNorm
        ? liveCollision.warehouse
        : pickSecondaryHub(product.warehouse, 0);
    const conflictingStock = Math.max(
      0,
      liveCollision.currentStock !== product.stock
        ? liveCollision.currentStock
        : product.stock + 2
    );
    const delta = conflictingStock - product.stock;
    const tertiaryHub = pickSecondaryHub(product.warehouse, 1);

    return {
      sku: product.sku,
      productId: product.id,
      productName: product.name,
      category: product.category,
      primaryWarehouse: product.warehouse,
      conflictingWarehouse,
      primaryStock: product.stock,
      conflictingStock,
      delta,
      severity: 'high',
      reason: `Live regional edit conflict: ${liveCollision.userB.operatorName} modified ${shortenWarehouseName(
        conflictingWarehouse
      )} concurrently (${delta >= 0 ? `+${delta}` : delta} unit delta).`,
      detectedAt: liveCollision.timestamp || new Date().toLocaleTimeString(),
      source: 'live_collision',
      hubSnapshots: [
        {
          warehouse: product.warehouse,
          shortName: shortenWarehouseName(product.warehouse),
          reportedStock: product.stock,
          reservedStock: product.reserved,
          lastSyncedAt: 'Live (Authoritative)',
          status: 'authoritative'
        },
        {
          warehouse: conflictingWarehouse,
          shortName: shortenWarehouseName(conflictingWarehouse),
          reportedStock: conflictingStock,
          reservedStock: product.reserved + 1,
          lastSyncedAt: liveCollision.timestamp || 'Just now',
          status: 'conflicting'
        },
        {
          warehouse: tertiaryHub,
          shortName: shortenWarehouseName(tertiaryHub),
          reportedStock: product.stock,
          reservedStock: 0,
          lastSyncedAt: '12m ago',
          status: 'stale'
        }
      ]
    };
  }

  // 2. Cross-regional audit log discrepancy (audit entry recorded at a different regional hub than product's primary hub)
  const crossHubAuditEntry = warehouseAuditLogs.find((log) => {
    if (log.sku.trim().toUpperCase() !== normalizedSku) return false;
    if (!log.warehouse) return false;
    const logWhNorm = normalizeWarehouseKey(log.warehouse);
    if (logWhNorm === primaryNorm) return false;
    // Ignore entries that explicitly record regional conflict reconciliation
    if ((log.reason || '').toLowerCase().includes('regional conflict reconciled')) {
      return false;
    }
    return log.newStock !== product.stock || logWhNorm !== primaryNorm;
  });

  if (crossHubAuditEntry) {
    const conflictingStock =
      crossHubAuditEntry.newStock !== product.stock
        ? crossHubAuditEntry.newStock
        : product.stock + 1;
    const delta = conflictingStock - product.stock;
    const tertiaryHub = pickSecondaryHub(product.warehouse, 2);

    return {
      sku: product.sku,
      productId: product.id,
      productName: product.name,
      category: product.category,
      primaryWarehouse: product.warehouse,
      conflictingWarehouse: crossHubAuditEntry.warehouse,
      primaryStock: product.stock,
      conflictingStock,
      delta,
      severity: Math.abs(delta) >= 2 ? 'high' : 'medium',
      reason: `Audit ledger mismatch between ${shortenWarehouseName(
        product.warehouse
      )} (${product.stock} units) and ${shortenWarehouseName(
        crossHubAuditEntry.warehouse
      )} (${conflictingStock} units).`,
      detectedAt: new Date(crossHubAuditEntry.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      source: 'audit_mismatch',
      hubSnapshots: [
        {
          warehouse: product.warehouse,
          shortName: shortenWarehouseName(product.warehouse),
          reportedStock: product.stock,
          reservedStock: product.reserved,
          lastSyncedAt: 'Live (Catalog)',
          status: 'authoritative'
        },
        {
          warehouse: crossHubAuditEntry.warehouse,
          shortName: shortenWarehouseName(crossHubAuditEntry.warehouse),
          reportedStock: conflictingStock,
          reservedStock: Math.max(0, product.reserved),
          lastSyncedAt: new Date(crossHubAuditEntry.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          }),
          status: 'conflicting'
        },
        {
          warehouse: tertiaryHub,
          shortName: shortenWarehouseName(tertiaryHub),
          reportedStock: product.stock,
          reservedStock: 0,
          lastSyncedAt: '24m ago',
          status: 'stale'
        }
      ]
    };
  }

  // 3. Regional hub replication ledger drift
  const ledgerDrift = REGIONAL_LEDGER_DRIFT_CONFIG[normalizedSku];
  if (ledgerDrift) {
    const conflictingWarehouse =
      normalizeWarehouseKey(ledgerDrift.conflictingWarehouse) !== primaryNorm
        ? ledgerDrift.conflictingWarehouse
        : pickSecondaryHub(product.warehouse, 0);
    const conflictingStock = Math.max(0, product.stock + ledgerDrift.stockOffset);
    const delta = conflictingStock - product.stock;

    if (delta !== 0) {
      const tertiaryWarehouse =
        normalizeWarehouseKey(ledgerDrift.tertiaryWarehouse) !== primaryNorm &&
        normalizeWarehouseKey(ledgerDrift.tertiaryWarehouse) !==
          normalizeWarehouseKey(conflictingWarehouse)
          ? ledgerDrift.tertiaryWarehouse
          : pickSecondaryHub(product.warehouse, 1);

      return {
        sku: product.sku,
        productId: product.id,
        productName: product.name,
        category: product.category,
        primaryWarehouse: product.warehouse,
        conflictingWarehouse,
        primaryStock: product.stock,
        conflictingStock,
        delta,
        severity: Math.abs(delta) >= 3 ? 'high' : 'medium',
        reason: ledgerDrift.reason,
        detectedAt: `${ledgerDrift.minutesAgo}m ago`,
        source: 'regional_ledger',
        hubSnapshots: [
          {
            warehouse: product.warehouse,
            shortName: shortenWarehouseName(product.warehouse),
            reportedStock: product.stock,
            reservedStock: product.reserved,
            lastSyncedAt: 'Live (Primary)',
            status: 'authoritative'
          },
          {
            warehouse: conflictingWarehouse,
            shortName: shortenWarehouseName(conflictingWarehouse),
            reportedStock: conflictingStock,
            reservedStock: Math.max(0, product.reserved + ledgerDrift.reservedOffset),
            lastSyncedAt: `${ledgerDrift.minutesAgo}m ago`,
            status: 'conflicting'
          },
          {
            warehouse: tertiaryWarehouse,
            shortName: shortenWarehouseName(tertiaryWarehouse),
            reportedStock: Math.max(0, product.stock + ledgerDrift.tertiaryOffset),
            reservedStock: 0,
            lastSyncedAt: `${ledgerDrift.minutesAgo + 15}m ago`,
            status: 'stale'
          }
        ]
      };
    }
  }

  return null;
}

/**
 * Returns all active cross-regional inventory conflicts across the catalog.
 */
export function getAllRegionalConflicts(
  products: Product[],
  warehouseAuditLogs: SkuAuditLogEntry[] = [],
  warehouseConflicts: WarehouseConflictEvent[] = [],
  resolvedRegionalConflictSkus: string[] = []
): SkuRegionalConflict[] {
  const conflicts: SkuRegionalConflict[] = [];
  for (const product of products) {
    const conflict = detectSkuRegionalConflict(
      product,
      warehouseAuditLogs,
      warehouseConflicts,
      resolvedRegionalConflictSkus
    );
    if (conflict) {
      conflicts.push(conflict);
    }
  }
  return conflicts;
}
