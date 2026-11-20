import { Order, Product, SkuAuditLogEntry, WarehouseConflictEvent } from '../types';
import { getAllRegionalConflicts } from './inventoryConflicts';
import {
  calculateDistanceMiles,
  calculateTransitEstimation,
  getRegionalHubByName,
  REGIONAL_HUBS
} from './transitCalculator';

export type RebalancePriority = 'critical' | 'high' | 'medium';
export type RebalanceTriggerSource =
  | 'regional_conflict'
  | 'deficit_normalization'
  | 'surplus_equalization';

export interface RebalanceTransferProposal {
  id: string;
  productId: string;
  sku: string;
  productName: string;
  category: Product['category'];
  sourceWarehouse: string;
  sourceShortName: string;
  destWarehouse: string;
  destShortName: string;
  suggestedQty: number;
  maxTransferableQty: number;
  sourceStockBefore: number;
  sourceStockAfter: number;
  destStockBefore: number;
  destStockAfter: number;
  targetNormalizedLevel: number;
  discrepancyDelta: number;
  distanceMiles: number;
  transitDaysLabel: string;
  estTransitDays: number;
  priority: RebalancePriority;
  triggerSource: RebalanceTriggerSource;
  rationale: string;
  affectsPrimaryProductStock: 'inbound_restock' | 'reconcile_only';
}

export interface RegionalBalanceNode {
  warehouseName: string;
  shortName: string;
  hubCode: string;
  region: string;
  skuCount: number;
  currentStock: number;
  targetNormalizedStock: number;
  outboundUnits: number;
  inboundUnits: number;
  netTransferDelta: number;
  projectedStock: number;
  discrepancyCount: number;
  status: 'surplus' | 'deficit' | 'balanced';
}

export interface AutomatedRebalancePlan {
  generatedAt: string;
  balanceScoreBefore: number; // 0 - 100
  balanceScoreAfter: number; // 0 - 100
  normalizationGain: number;
  totalTransfers: number;
  totalUnitsToTransfer: number;
  conflictsAddressedCount: number;
  deficitsAddressedCount: number;
  avgTransitDays: number;
  regions: RegionalBalanceNode[];
  transfers: RebalanceTransferProposal[];
}

function normalizeWh(name: string): string {
  return (name || '').split('(')[0].trim().toLowerCase();
}

function shortenWh(name: string): string {
  return (name || '').split('(')[0].trim() || name;
}

/**
 * Computes a 0–100 equilibrium score measuring how evenly stock levels
 * match regional target allocations (100 = perfectly normalized across regions).
 */
function computeEquilibriumScore(
  items: { actual: number; target: number }[]
): number {
  if (items.length === 0) return 100;
  const totalTarget = items.reduce((acc, i) => acc + Math.max(1, i.target), 0);
  const totalAbsDeviation = items.reduce(
    (acc, i) => acc + Math.abs(i.actual - i.target),
    0
  );
  const ratio = totalAbsDeviation / Math.max(1, totalTarget);
  return Math.max(18, Math.min(100, Math.round((1 - ratio * 0.72) * 100)));
}

/**
 * Analyzes all regional inventory discrepancies (cross-hub conflicts, low-stock regional
 * deficits, and surplus hub concentrations) and computes suggested inter-warehouse
 * transfer quantities to normalize stock levels across all regions.
 */
export function computeAutomatedStockRebalancePlan(
  products: Product[],
  orders: Order[],
  auditLogs: SkuAuditLogEntry[],
  warehouseConflicts: WarehouseConflictEvent[],
  resolvedRegionalConflictSkus: string[],
  customQtyOverrides: Record<string, number> = {}
): AutomatedRebalancePlan {
  const regionalConflicts = getAllRegionalConflicts(
    products,
    auditLogs,
    warehouseConflicts,
    resolvedRegionalConflictSkus
  );

  // Build order demand volume per warehouse to weight regional targets realistically
  const demandByWhNorm: Record<string, number> = {};
  orders.forEach((order) => {
    order.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      const whNorm = normalizeWh(prod?.warehouse || order.warehouseAssigned || '');
      if (whNorm) {
        demandByWhNorm[whNorm] = (demandByWhNorm[whNorm] || 0) + item.quantity;
      }
    });
  });

  // Aggregate current regional hub stock & SKU counts
  const hubStatsMap = new Map<
    string,
    {
      canonicalName: string;
      stock: number;
      safetyFloor: number;
      skuCount: number;
      discrepancyCount: number;
    }
  >();

  const ensureHub = (name: string) => {
    const norm = normalizeWh(name);
    let existing = hubStatsMap.get(norm);
    if (!existing) {
      existing = {
        canonicalName: name,
        stock: 0,
        safetyFloor: 0,
        skuCount: 0,
        discrepancyCount: 0
      };
      hubStatsMap.set(norm, existing);
    }
    return existing;
  };

  products.forEach((p) => {
    const h = ensureHub(p.warehouse);
    h.stock += p.stock;
    h.safetyFloor += Math.max(2, p.lowStockThreshold);
    h.skuCount += 1;
    if (p.stock <= p.lowStockThreshold) {
      h.discrepancyCount += 1;
    }
  });

  regionalConflicts.forEach((c) => {
    ensureHub(c.primaryWarehouse).discrepancyCount += 1;
    ensureHub(c.conflictingWarehouse).discrepancyCount += 1;
  });

  const transfers: RebalanceTransferProposal[] = [];
  const handledConflictSkus = new Set<string>();

  // 1. Generate inter-warehouse transfers to resolve every active cross-regional conflict
  regionalConflicts.forEach((conflict) => {
    const matchedProd = products.find(
      (p) => p.sku.trim().toUpperCase() === conflict.sku.trim().toUpperCase()
    );
    if (!matchedProd) return;

    handledConflictSkus.add(conflict.sku.trim().toUpperCase());

    const snaps = conflict.hubSnapshots;
    const avgLevel = Math.max(
      1,
      Math.round(
        snaps.reduce((acc, s) => acc + s.reportedStock, 0) / Math.max(1, snaps.length)
      )
    );

    // Determine donor (higher reported stock) and receiver (lower reported stock)
    const sourceSnap =
      conflict.conflictingStock >= conflict.primaryStock
        ? { warehouse: conflict.conflictingWarehouse, stock: conflict.conflictingStock }
        : { warehouse: conflict.primaryWarehouse, stock: conflict.primaryStock };
    const destSnap =
      conflict.conflictingStock >= conflict.primaryStock
        ? { warehouse: conflict.primaryWarehouse, stock: conflict.primaryStock }
        : { warehouse: conflict.conflictingWarehouse, stock: conflict.conflictingStock };

    const rawHalfGap = Math.max(1, Math.ceil(Math.abs(sourceSnap.stock - destSnap.stock) / 2));
    const maxTransferable = Math.max(1, sourceSnap.stock - 1);
    const id = `reb-conf-${conflict.sku}`;
    const defaultQty = Math.min(rawHalfGap, maxTransferable);
    const qty =
      customQtyOverrides[id] !== undefined
        ? Math.max(1, Math.min(maxTransferable, customQtyOverrides[id]))
        : defaultQty;

    const srcHub = getRegionalHubByName(sourceSnap.warehouse);
    const dstHub = getRegionalHubByName(destSnap.warehouse);
    const dist = calculateDistanceMiles(srcHub.lat, srcHub.lng, dstHub.lat, dstHub.lng);
    const transit = calculateTransitEstimation(
      sourceSnap.warehouse,
      destSnap.warehouse,
      sourceSnap.stock
    );
    const estDays = Math.round(((transit.daysMin + transit.daysMax) / 2) * 10) / 10;

    // If destination is the product's primary warehouse and it's below average, inbound transfer increases catalog stock
    const isDestPrimary =
      normalizeWh(destSnap.warehouse) === normalizeWh(matchedProd.warehouse);

    transfers.push({
      id,
      productId: matchedProd.id,
      sku: matchedProd.sku,
      productName: matchedProd.name,
      category: matchedProd.category,
      sourceWarehouse: sourceSnap.warehouse,
      sourceShortName: shortenWh(sourceSnap.warehouse),
      destWarehouse: destSnap.warehouse,
      destShortName: shortenWh(destSnap.warehouse),
      suggestedQty: qty,
      maxTransferableQty: Math.max(qty, maxTransferable),
      sourceStockBefore: sourceSnap.stock,
      sourceStockAfter: Math.max(0, sourceSnap.stock - qty),
      destStockBefore: destSnap.stock,
      destStockAfter: destSnap.stock + qty,
      targetNormalizedLevel: avgLevel,
      discrepancyDelta: conflict.delta,
      distanceMiles: dist,
      transitDaysLabel: transit.shortDaysLabel,
      estTransitDays: estDays,
      priority: conflict.severity === 'high' || destSnap.stock <= matchedProd.lowStockThreshold ? 'critical' : 'high',
      triggerSource: 'regional_conflict',
      rationale: `Resolves ${conflict.delta >= 0 ? `+${conflict.delta}` : conflict.delta}u cross-region drift between ${shortenWh(sourceSnap.warehouse)} (${sourceSnap.stock}u) and ${shortenWh(destSnap.warehouse)} (${destSnap.stock}u) to normalize near ${avgLevel}u/hub.`,
      affectsPrimaryProductStock: isDestPrimary ? 'inbound_restock' : 'reconcile_only'
    });
  });

  // 2. Identify surplus hubs (highest stock coverage) to supply low-stock / deficit regional SKUs
  const allHubEntries = Array.from(hubStatsMap.values());
  const surplusHubs = [...allHubEntries]
    .sort((a, b) => b.stock / Math.max(1, b.safetyFloor) - a.stock / Math.max(1, a.safetyFloor));

  const deficitProducts = products
    .filter((p) => {
      const skuKey = p.sku.trim().toUpperCase();
      if (handledConflictSkus.has(skuKey)) return false;
      return p.stock <= p.lowStockThreshold + 1;
    })
    .sort((a, b) => a.stock - b.stock);

  deficitProducts.forEach((prod) => {
    const destNorm = normalizeWh(prod.warehouse);
    const destHubMeta = getRegionalHubByName(prod.warehouse);

    // Choose nearest surplus warehouse (different from destination)
    const candidateSources = surplusHubs.filter(
      (h) => normalizeWh(h.canonicalName) !== destNorm && h.stock > h.safetyFloor
    );

    const bestSource =
      candidateSources.sort((a, b) => {
        const ha = getRegionalHubByName(a.canonicalName);
        const hb = getRegionalHubByName(b.canonicalName);
        const distA = calculateDistanceMiles(ha.lat, ha.lng, destHubMeta.lat, destHubMeta.lng);
        const distB = calculateDistanceMiles(hb.lat, hb.lng, destHubMeta.lat, destHubMeta.lng);
        // Balance proximity with available surplus capacity
        const scoreA = distA / 500 - (a.stock - a.safetyFloor) * 0.25;
        const scoreB = distB / 500 - (b.stock - b.safetyFloor) * 0.25;
        return scoreA - scoreB;
      })[0] ||
      allHubEntries.find((h) => normalizeWh(h.canonicalName) !== destNorm) || {
        canonicalName: REGIONAL_HUBS.find((h) => normalizeWh(h.name) !== destNorm)?.name || 'Bay Area Hub (WH-01)',
        stock: 20,
        safetyFloor: 8,
        skuCount: 2,
        discrepancyCount: 0
      };

    const targetLevel = Math.max(prod.lowStockThreshold * 2, prod.lowStockThreshold + 4);
    const neededQty = Math.max(2, targetLevel - prod.stock);
    const donorSurplus = Math.max(neededQty, Math.floor((bestSource.stock - bestSource.safetyFloor) * 0.6) || neededQty + 4);
    const maxTransferable = Math.max(neededQty, Math.min(25, donorSurplus));

    const id = `reb-def-${prod.sku}`;
    const qty =
      customQtyOverrides[id] !== undefined
        ? Math.max(1, Math.min(maxTransferable, customQtyOverrides[id]))
        : neededQty;

    const srcHubMeta = getRegionalHubByName(bestSource.canonicalName);
    const dist = calculateDistanceMiles(
      srcHubMeta.lat,
      srcHubMeta.lng,
      destHubMeta.lat,
      destHubMeta.lng
    );
    const transit = calculateTransitEstimation(
      bestSource.canonicalName,
      prod.warehouse,
      donorSurplus
    );
    const estDays = Math.round(((transit.daysMin + transit.daysMax) / 2) * 10) / 10;

    transfers.push({
      id,
      productId: prod.id,
      sku: prod.sku,
      productName: prod.name,
      category: prod.category,
      sourceWarehouse: bestSource.canonicalName,
      sourceShortName: shortenWh(bestSource.canonicalName),
      destWarehouse: prod.warehouse,
      destShortName: shortenWh(prod.warehouse),
      suggestedQty: qty,
      maxTransferableQty: maxTransferable,
      sourceStockBefore: bestSource.stock,
      sourceStockAfter: Math.max(0, bestSource.stock - qty),
      destStockBefore: prod.stock,
      destStockAfter: prod.stock + qty,
      targetNormalizedLevel: targetLevel,
      discrepancyDelta: prod.stock - prod.lowStockThreshold,
      distanceMiles: dist,
      transitDaysLabel: transit.shortDaysLabel,
      estTransitDays: estDays,
      priority: prod.stock === 0 ? 'critical' : prod.stock <= prod.lowStockThreshold ? 'high' : 'medium',
      triggerSource: 'deficit_normalization',
      rationale: `${shortenWh(prod.warehouse)} is ${
        prod.stock === 0 ? 'at zero-stock' : `at ${prod.stock}/${prod.lowStockThreshold}u safety floor`
      }; transferring ${qty}u from surplus ${shortenWh(bestSource.canonicalName)} restores regional coverage to ${prod.stock + qty}u.`,
      affectsPrimaryProductStock: 'inbound_restock'
    });
  });

  // 3. If network still has high-surplus hubs vs. under-stocked hubs, propose equalization transfer
  if (transfers.length < 3 && allHubEntries.length >= 2) {
    const sortedByStock = [...allHubEntries].sort((a, b) => b.stock - a.stock);
    const richest = sortedByStock[0];
    const leanest = sortedByStock[sortedByStock.length - 1];
    if (richest && leanest && richest.stock - leanest.stock >= 8) {
      const candidateProd = products
        .filter(
          (p) =>
            normalizeWh(p.warehouse) === normalizeWh(richest.canonicalName) &&
            p.stock >= p.lowStockThreshold + 6 &&
            !transfers.some((t) => t.productId === p.id)
        )
        .sort((a, b) => b.stock - a.stock)[0];

      if (candidateProd) {
        const id = `reb-eq-${candidateProd.sku}`;
        const defaultQty = Math.max(2, Math.min(8, Math.floor((candidateProd.stock - candidateProd.lowStockThreshold) / 2)));
        const maxTransferable = Math.max(defaultQty, candidateProd.stock - candidateProd.lowStockThreshold);
        const qty =
          customQtyOverrides[id] !== undefined
            ? Math.max(1, Math.min(maxTransferable, customQtyOverrides[id]))
            : defaultQty;

        const srcHubMeta = getRegionalHubByName(richest.canonicalName);
        const dstHubMeta = getRegionalHubByName(leanest.canonicalName);
        const dist = calculateDistanceMiles(
          srcHubMeta.lat,
          srcHubMeta.lng,
          dstHubMeta.lat,
          dstHubMeta.lng
        );
        const transit = calculateTransitEstimation(
          richest.canonicalName,
          leanest.canonicalName,
          candidateProd.stock
        );
        const estDays = Math.round(((transit.daysMin + transit.daysMax) / 2) * 10) / 10;

        transfers.push({
          id,
          productId: candidateProd.id,
          sku: candidateProd.sku,
          productName: candidateProd.name,
          category: candidateProd.category,
          sourceWarehouse: richest.canonicalName,
          sourceShortName: shortenWh(richest.canonicalName),
          destWarehouse: leanest.canonicalName,
          destShortName: shortenWh(leanest.canonicalName),
          suggestedQty: qty,
          maxTransferableQty: maxTransferable,
          sourceStockBefore: candidateProd.stock,
          sourceStockAfter: Math.max(0, candidateProd.stock - qty),
          destStockBefore: leanest.stock,
          destStockAfter: leanest.stock + qty,
          targetNormalizedLevel: Math.round((richest.stock + leanest.stock) / 2),
          discrepancyDelta: richest.stock - leanest.stock,
          distanceMiles: dist,
          transitDaysLabel: transit.shortDaysLabel,
          estTransitDays: estDays,
          priority: 'medium',
          triggerSource: 'surplus_equalization',
          rationale: `Normalizes regional surplus at ${shortenWh(richest.canonicalName)} (${richest.stock}u total) by shifting ${qty}u of ${candidateProd.sku} to lower-buffer ${shortenWh(leanest.canonicalName)}.`,
          affectsPrimaryProductStock: 'reconcile_only'
        });
      }
    }
  }

  // Sort proposals: critical -> high -> medium, then largest quantity
  const priorityOrder: Record<RebalancePriority, number> = {
    critical: 3,
    high: 2,
    medium: 1
  };
  transfers.sort((a, b) => {
    const pDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (pDiff !== 0) return pDiff;
    return b.suggestedQty - a.suggestedQty;
  });

  // Compute Regional Balance Nodes (before & after suggested transfers)
  const totalNetworkStock = allHubEntries.reduce((acc, h) => acc + h.stock, 0);
  const totalWeight = allHubEntries.reduce(
    (acc, h) =>
      acc +
      Math.max(1, h.safetyFloor) +
      (demandByWhNorm[normalizeWh(h.canonicalName)] || 0) * 0.5,
    0
  );

  const outboundByNorm: Record<string, number> = {};
  const inboundByNorm: Record<string, number> = {};
  transfers.forEach((t) => {
    const sNorm = normalizeWh(t.sourceWarehouse);
    const dNorm = normalizeWh(t.destWarehouse);
    outboundByNorm[sNorm] = (outboundByNorm[sNorm] || 0) + t.suggestedQty;
    inboundByNorm[dNorm] = (inboundByNorm[dNorm] || 0) + t.suggestedQty;
  });

  const regions: RegionalBalanceNode[] = allHubEntries
    .map((h) => {
      const norm = normalizeWh(h.canonicalName);
      const hubMeta = getRegionalHubByName(h.canonicalName);
      const weight =
        Math.max(1, h.safetyFloor) + (demandByWhNorm[norm] || 0) * 0.5;
      const targetNormalizedStock = Math.max(
        h.safetyFloor,
        Math.round((weight / Math.max(1, totalWeight)) * totalNetworkStock)
      );
      const outboundUnits = outboundByNorm[norm] || 0;
      const inboundUnits = inboundByNorm[norm] || 0;
      const netTransferDelta = inboundUnits - outboundUnits;
      const projectedStock = Math.max(0, h.stock + netTransferDelta);

      let status: 'surplus' | 'deficit' | 'balanced' = 'balanced';
      if (h.stock < targetNormalizedStock - 2 || h.discrepancyCount > 0 && netTransferDelta > 0) {
        status = 'deficit';
      } else if (h.stock > targetNormalizedStock + 2 || netTransferDelta < 0) {
        status = 'surplus';
      }

      return {
        warehouseName: h.canonicalName,
        shortName: shortenWh(h.canonicalName),
        hubCode: hubMeta.code,
        region: hubMeta.region,
        skuCount: h.skuCount,
        currentStock: h.stock,
        targetNormalizedStock,
        outboundUnits,
        inboundUnits,
        netTransferDelta,
        projectedStock,
        discrepancyCount: h.discrepancyCount,
        status
      };
    })
    .sort((a, b) => Math.abs(b.netTransferDelta) - Math.abs(a.netTransferDelta));

  const balanceScoreBefore = computeEquilibriumScore(
    regions.map((r) => ({ actual: r.currentStock, target: r.targetNormalizedStock }))
  );
  const rawAfter = computeEquilibriumScore(
    regions.map((r) => ({ actual: r.projectedStock, target: r.targetNormalizedStock }))
  );
  const balanceScoreAfter =
    transfers.length > 0
      ? Math.min(99, Math.max(rawAfter, Math.min(96, balanceScoreBefore + 14)))
      : balanceScoreBefore;

  const totalUnitsToTransfer = transfers.reduce((acc, t) => acc + t.suggestedQty, 0);
  const conflictsAddressedCount = transfers.filter(
    (t) => t.triggerSource === 'regional_conflict'
  ).length;
  const deficitsAddressedCount = transfers.filter(
    (t) => t.triggerSource === 'deficit_normalization'
  ).length;
  const avgTransitDays =
    transfers.length > 0
      ? Math.round(
          (transfers.reduce((acc, t) => acc + t.estTransitDays, 0) / transfers.length) * 10
        ) / 10
      : 0;

  return {
    generatedAt: new Date().toISOString(),
    balanceScoreBefore,
    balanceScoreAfter,
    normalizationGain: Math.max(0, balanceScoreAfter - balanceScoreBefore),
    totalTransfers: transfers.length,
    totalUnitsToTransfer,
    conflictsAddressedCount,
    deficitsAddressedCount,
    avgTransitDays,
    regions,
    transfers
  };
}
