import { Order, Product, SkuAuditLogEntry } from '../types';
import { calculateSkuAiSuggestions } from './aiSkuSuggestionEngine';
import { getRegionalHubByName } from './transitCalculator';

export type ZeroStockRiskTier = 'imminent' | 'high' | 'moderate' | 'low';

export interface SkuZeroStockRisk {
  productId: string;
  sku: string;
  name: string;
  category: string;
  warehouse: string;
  stock: number;
  reserved: number;
  availableStock: number;
  lowStockThreshold: number;
  orderVolumeUnits: number;
  dailyOrderBurnRate: number; // units / day
  replenishmentVelocity: number; // units / day incoming replenishment rate
  netDailyBurn: number; // dailyOrderBurnRate - replenishmentVelocity
  estDaysToZero: number;
  zeroStockProbability: number; // 0 - 99 (%)
  prob24h: number;
  prob72h: number;
  prob7d: number;
  riskTier: ZeroStockRiskTier;
  recommendedRestockQty: number;
}

export interface WarehouseLowStockProbability {
  warehouseName: string;
  shortName: string;
  hubCode: string;
  region: string;
  skuCount: number;
  totalStock: number;
  availableStock: number;
  reservedUnits: number;
  orderVolumeUnits: number;
  dailyOrderBurnRate: number; // units / day
  replenishmentVelocity: number; // units / day
  netVelocityDelta: number; // replenishmentVelocity - dailyOrderBurnRate (negative = draining)
  replenishmentLeadTimeDays: number;
  estDaysToZero: number;
  zeroStockProbability: number; // 0 - 99 (%)
  prob24h: number;
  prob72h: number;
  prob7d: number;
  riskTier: ZeroStockRiskTier;
  atRiskSkuCount: number;
  depletedSkuCount: number;
  skuRisks: SkuZeroStockRisk[];
  highestRiskSku: SkuZeroStockRisk | null;
}

export interface CategoryLowStockProbability {
  categoryId: string;
  zeroStockProbability: number; // 0 - 99 (%)
  prob24h: number;
  prob72h: number;
  prob7d: number;
  riskTier: ZeroStockRiskTier;
  dailyOrderBurnRate: number;
  replenishmentVelocity: number;
  hottestWarehouse: string | null;
  atRiskSkuCount: number;
}

export interface LowStockProbabilityHeatmapResult {
  warehouses: WarehouseLowStockProbability[];
  warehouseByNorm: Record<string, WarehouseLowStockProbability>;
  byCategory: Record<string, CategoryLowStockProbability>;
  highRiskWarehouseCount: number;
  imminentWarehouseCount: number;
  peakProbability: number;
  mostVulnerableWarehouse: WarehouseLowStockProbability | null;
  networkDailyBurn: number;
  networkReplenishmentVelocity: number;
}

// Baseline regional replenishment lead times (days) and inbound restock throughput multipliers
const HUB_REPLENISHMENT_PROFILE: Record<
  string,
  { leadTimeDays: number; baseReplenishThroughput: number }
> = {
  'bay area hub': { leadTimeDays: 1.8, baseReplenishThroughput: 4.8 },
  'east coast dc': { leadTimeDays: 2.6, baseReplenishThroughput: 4.1 },
  'midwest logistics': { leadTimeDays: 3.1, baseReplenishThroughput: 3.4 },
  'pacific northwest facility': { leadTimeDays: 3.4, baseReplenishThroughput: 2.9 },
  'socal studio hub': { leadTimeDays: 2.2, baseReplenishThroughput: 4.3 },
  'automated logistics hub': { leadTimeDays: 2.8, baseReplenishThroughput: 3.6 }
};

function normalizeWh(name: string): string {
  return (name || '').split('(')[0].trim().toLowerCase();
}

function shortenWh(name: string): string {
  return (name || '').split('(')[0].trim() || name;
}

function clampProb(value: number): number {
  return Math.max(3, Math.min(99, Math.round(value)));
}

export function probabilityToRiskTier(prob: number): ZeroStockRiskTier {
  if (prob >= 75) return 'imminent';
  if (prob >= 50) return 'high';
  if (prob >= 25) return 'moderate';
  return 'low';
}

/**
 * Smooth logistic hazard function converting runway days, horizon window,
 * and burn-vs-replenishment velocity ratio into a 0–99% probability of hitting zero-stock.
 */
function computeHorizonProbability(
  availableStock: number,
  dailyBurn: number,
  replenishVelocity: number,
  horizonDays: number,
  leadTimeDays: number,
  lowStockThreshold: number
): number {
  if (availableStock <= 0) {
    return 98;
  }

  const effectiveBurn = Math.max(0.25, dailyBurn);
  const daysToZero = availableStock / effectiveBurn;

  // Ratio of demand burn to replenishment velocity (>1 means inventory is draining faster than restocks arrive)
  const velocityPressure = effectiveBurn / Math.max(0.5, replenishVelocity);
  // Extra pressure when stock is already below safety floor or runway is shorter than replenishment lead time
  const leadTimeDeficit = Math.max(0, leadTimeDays - daysToZero);
  const safetyBufferPressure =
    availableStock <= lowStockThreshold
      ? 0.65 * (1 - availableStock / Math.max(1, lowStockThreshold)) + 0.35
      : 0;

  // Logistic score centered around horizonDays
  const runwayRatio = horizonDays / Math.max(0.15, daysToZero);
  const velocityBoost = Math.max(-0.55, Math.min(1.6, (velocityPressure - 0.85) * 0.95));
  const logit =
    (runwayRatio - 1.0) * 2.15 +
    velocityBoost +
    leadTimeDeficit * 0.45 +
    safetyBufferPressure * 0.9;

  const rawProb = (1 / (1 + Math.exp(-logit))) * 100;
  return clampProb(rawProb);
}

/**
 * Calculates regional warehouse and category Low-Stock (Zero-Stock) Probability
 * based on live stock levels, active order volume, depletion rate, and replenishment velocity.
 */
export function computeLowStockProbabilityHeatmap(
  products: Product[],
  orders: Order[],
  auditLogs: SkuAuditLogEntry[] = []
): LowStockProbabilityHeatmapResult {
  const aiVelocityResp = calculateSkuAiSuggestions(products, orders, auditLogs);
  const velocityByProductId = new Map(
    aiVelocityResp.suggestions.map((s) => [s.productId, s])
  );

  // Aggregate order quantities by product and warehouse
  const orderUnitsByProduct: Record<string, number> = {};
  const orderUnitsByWhNorm: Record<string, number> = {};

  orders.forEach((order) => {
    const assignedWhNorm = normalizeWh(order.warehouseAssigned || '');
    order.items.forEach((item) => {
      orderUnitsByProduct[item.productId] =
        (orderUnitsByProduct[item.productId] || 0) + item.quantity;
      if (assignedWhNorm) {
        orderUnitsByWhNorm[assignedWhNorm] =
          (orderUnitsByWhNorm[assignedWhNorm] || 0) + item.quantity;
      }
    });
  });

  // Derive observed replenishment velocity from restock/add audit logs (units added per SKU & warehouse)
  const restockUnitsBySku: Record<string, number> = {};
  const restockEventsByWhNorm: Record<string, { totalUnits: number; count: number }> = {};

  auditLogs.forEach((log) => {
    const isInbound =
      log.adjustmentType === 'restock' ||
      log.adjustmentType === 'add' ||
      log.adjustmentValue > 0;
    if (!isInbound || log.adjustmentValue <= 0) return;

    const skuKey = (log.sku || '').toUpperCase();
    restockUnitsBySku[skuKey] = (restockUnitsBySku[skuKey] || 0) + log.adjustmentValue;

    const whNorm = normalizeWh(log.warehouse || '');
    if (whNorm) {
      if (!restockEventsByWhNorm[whNorm]) {
        restockEventsByWhNorm[whNorm] = { totalUnits: 0, count: 0 };
      }
      restockEventsByWhNorm[whNorm].totalUnits += log.adjustmentValue;
      restockEventsByWhNorm[whNorm].count += 1;
    }
  });

  // Group products by normalized regional warehouse
  const whBuckets = new Map<
    string,
    {
      canonicalName: string;
      products: Product[];
    }
  >();

  products.forEach((p) => {
    const norm = normalizeWh(p.warehouse);
    if (!norm) return;
    const existing = whBuckets.get(norm);
    if (existing) {
      existing.products.push(p);
    } else {
      whBuckets.set(norm, { canonicalName: p.warehouse, products: [p] });
    }
  });

  const warehouseByNorm: Record<string, WarehouseLowStockProbability> = {};
  const allSkuRisks: SkuZeroStockRisk[] = [];

  const warehouses: WarehouseLowStockProbability[] = Array.from(whBuckets.entries())
    .map(([norm, bucket]) => {
      const hubMeta = getRegionalHubByName(bucket.canonicalName);
      const profile = HUB_REPLENISHMENT_PROFILE[norm] || {
        leadTimeDays: 2.5,
        baseReplenishThroughput: 3.5
      };

      const whAuditRestock = restockEventsByWhNorm[norm];
      // Observed replenishment velocity contribution averaged over a 14-day rolling replenishment window
      const observedWhRestockPerDay = whAuditRestock
        ? Math.min(18, whAuditRestock.totalUnits / 14)
        : 0;

      const skuCount = Math.max(1, bucket.products.length);

      const skuRisks: SkuZeroStockRisk[] = bucket.products
        .map((p) => {
          const vel = velocityByProductId.get(p.id);
          const productOrderUnits = orderUnitsByProduct[p.id] || 0;
          const reserved = p.reserved || 0;
          const availableStock = Math.max(0, p.stock - reserved);

          // Daily order burn incorporates live order volume + active reservations + baseline SKU demand velocity
          const baseDailyBurn = vel?.dailyDepletionRate ?? 2.8;
          const orderDemandBoost = Math.min(4.2, productOrderUnits * 0.35 + reserved * 0.22);
          const dailyOrderBurnRate =
            Math.round((baseDailyBurn + orderDemandBoost) * 10) / 10;

          // Replenishment velocity (units/day) based on regional hub throughput + observed restock audit cadence
          const skuAuditAdded = restockUnitsBySku[p.sku.toUpperCase()] || 0;
          const perSkuBaseReplenish =
            (profile.baseReplenishThroughput / Math.sqrt(skuCount)) * 1.15;
          const auditReplenishBoost = Math.min(5.5, skuAuditAdded / 12);
          const replenishmentVelocity =
            Math.round(Math.max(0.6, perSkuBaseReplenish + auditReplenishBoost) * 10) / 10;

          const netDailyBurn =
            Math.round((dailyOrderBurnRate - replenishmentVelocity) * 10) / 10;

          const estDaysToZero =
            availableStock <= 0
              ? 0
              : Math.round((availableStock / Math.max(0.25, dailyOrderBurnRate)) * 10) / 10;

          const prob24h = computeHorizonProbability(
            availableStock,
            dailyOrderBurnRate,
            replenishmentVelocity,
            1,
            profile.leadTimeDays,
            p.lowStockThreshold
          );
          const prob72h = computeHorizonProbability(
            availableStock,
            dailyOrderBurnRate,
            replenishmentVelocity,
            3,
            profile.leadTimeDays,
            p.lowStockThreshold
          );
          const prob7d = computeHorizonProbability(
            availableStock,
            dailyOrderBurnRate,
            replenishmentVelocity,
            7,
            profile.leadTimeDays,
            p.lowStockThreshold
          );

          // Composite zero-stock probability weighted toward imminent 72h & 7d replenishment risk
          const zeroStockProbability = clampProb(
            prob24h * 0.3 + prob72h * 0.45 + prob7d * 0.25
          );

          const recommendedRestockQty =
            vel?.recommendedRestockQty ??
            Math.max(
              10,
              Math.ceil((dailyOrderBurnRate * (profile.leadTimeDays + 7) - availableStock) / 5) * 5
            );

          const skuRisk: SkuZeroStockRisk = {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            category: p.category,
            warehouse: bucket.canonicalName,
            stock: p.stock,
            reserved,
            availableStock,
            lowStockThreshold: p.lowStockThreshold,
            orderVolumeUnits: productOrderUnits + reserved,
            dailyOrderBurnRate,
            replenishmentVelocity,
            netDailyBurn,
            estDaysToZero,
            zeroStockProbability,
            prob24h,
            prob72h,
            prob7d,
            riskTier: probabilityToRiskTier(zeroStockProbability),
            recommendedRestockQty: Math.max(5, recommendedRestockQty)
          };

          allSkuRisks.push(skuRisk);
          return skuRisk;
        })
        .sort((a, b) => b.zeroStockProbability - a.zeroStockProbability);

      const totalStock = bucket.products.reduce((acc, p) => acc + (p.stock || 0), 0);
      const reservedUnits = bucket.products.reduce((acc, p) => acc + (p.reserved || 0), 0);
      const availableStock = Math.max(0, totalStock - reservedUnits);

      const productOrdersSum = skuRisks.reduce((acc, s) => acc + s.orderVolumeUnits, 0);
      const orderVolumeUnits = Math.max(productOrdersSum, orderUnitsByWhNorm[norm] || 0);

      const dailyOrderBurnRate =
        Math.round(skuRisks.reduce((acc, s) => acc + s.dailyOrderBurnRate, 0) * 10) / 10;

      const replenishmentVelocity =
        Math.round(
          (skuRisks.reduce((acc, s) => acc + s.replenishmentVelocity, 0) +
            observedWhRestockPerDay) *
            10
        ) / 10;

      const netVelocityDelta =
        Math.round((replenishmentVelocity - dailyOrderBurnRate) * 10) / 10;

      const estDaysToZero =
        availableStock <= 0
          ? 0
          : Math.round((availableStock / Math.max(0.4, dailyOrderBurnRate)) * 10) / 10;

      // Regional zero-stock probability blends worst-SKU stockout exposure (60%) with hub-level aggregate burn vs replenishment (40%)
      const peakSku = skuRisks[0] || null;
      const avgSkuProb24 =
        skuRisks.reduce((acc, s) => acc + s.prob24h, 0) / Math.max(1, skuRisks.length);
      const avgSkuProb72 =
        skuRisks.reduce((acc, s) => acc + s.prob72h, 0) / Math.max(1, skuRisks.length);
      const avgSkuProb7d =
        skuRisks.reduce((acc, s) => acc + s.prob7d, 0) / Math.max(1, skuRisks.length);

      const hubLowFloor = bucket.products.reduce((acc, p) => acc + p.lowStockThreshold, 0);
      const aggProb24 = computeHorizonProbability(
        availableStock,
        dailyOrderBurnRate,
        replenishmentVelocity,
        1,
        profile.leadTimeDays,
        hubLowFloor
      );
      const aggProb72 = computeHorizonProbability(
        availableStock,
        dailyOrderBurnRate,
        replenishmentVelocity,
        3,
        profile.leadTimeDays,
        hubLowFloor
      );
      const aggProb7d = computeHorizonProbability(
        availableStock,
        dailyOrderBurnRate,
        replenishmentVelocity,
        7,
        profile.leadTimeDays,
        hubLowFloor
      );

      const prob24h = clampProb(
        (peakSku ? peakSku.prob24h * 0.45 : aggProb24 * 0.45) +
          avgSkuProb24 * 0.25 +
          aggProb24 * 0.3
      );
      const prob72h = clampProb(
        (peakSku ? peakSku.prob72h * 0.45 : aggProb72 * 0.45) +
          avgSkuProb72 * 0.25 +
          aggProb72 * 0.3
      );
      const prob7d = clampProb(
        (peakSku ? peakSku.prob7d * 0.45 : aggProb7d * 0.45) +
          avgSkuProb7d * 0.25 +
          aggProb7d * 0.3
      );

      const zeroStockProbability = clampProb(
        prob24h * 0.28 + prob72h * 0.44 + prob7d * 0.28
      );

      const atRiskSkuCount = skuRisks.filter((s) => s.zeroStockProbability >= 50).length;
      const depletedSkuCount = skuRisks.filter((s) => s.availableStock <= 0).length;

      const summary: WarehouseLowStockProbability = {
        warehouseName: bucket.canonicalName,
        shortName: shortenWh(bucket.canonicalName),
        hubCode: hubMeta.code,
        region: hubMeta.region,
        skuCount: bucket.products.length,
        totalStock,
        availableStock,
        reservedUnits,
        orderVolumeUnits,
        dailyOrderBurnRate,
        replenishmentVelocity,
        netVelocityDelta,
        replenishmentLeadTimeDays: profile.leadTimeDays,
        estDaysToZero,
        zeroStockProbability,
        prob24h,
        prob72h,
        prob7d,
        riskTier: probabilityToRiskTier(zeroStockProbability),
        atRiskSkuCount,
        depletedSkuCount,
        skuRisks,
        highestRiskSku: peakSku
      };

      warehouseByNorm[norm] = summary;
      return summary;
    })
    .sort((a, b) => b.zeroStockProbability - a.zeroStockProbability);

  // Per-category low-stock probability metrics for Categories bar chart overlay
  const categoryKeys = ['audio', 'workstation', 'computing', 'optics', 'peripherals'];
  const byCategory: Record<string, CategoryLowStockProbability> = {};

  categoryKeys.forEach((catId) => {
    const catSkus = allSkuRisks.filter((s) => s.category === catId);
    if (catSkus.length === 0) {
      byCategory[catId] = {
        categoryId: catId,
        zeroStockProbability: 5,
        prob24h: 3,
        prob72h: 5,
        prob7d: 8,
        riskTier: 'low',
        dailyOrderBurnRate: 0,
        replenishmentVelocity: 0,
        hottestWarehouse: null,
        atRiskSkuCount: 0
      };
      return;
    }

    const sorted = [...catSkus].sort(
      (a, b) => b.zeroStockProbability - a.zeroStockProbability
    );
    const peak = sorted[0];
    const avgProb =
      catSkus.reduce((acc, s) => acc + s.zeroStockProbability, 0) / catSkus.length;
    const prob24h = clampProb(
      peak.prob24h * 0.55 +
        (catSkus.reduce((acc, s) => acc + s.prob24h, 0) / catSkus.length) * 0.45
    );
    const prob72h = clampProb(
      peak.prob72h * 0.55 +
        (catSkus.reduce((acc, s) => acc + s.prob72h, 0) / catSkus.length) * 0.45
    );
    const prob7d = clampProb(
      peak.prob7d * 0.55 +
        (catSkus.reduce((acc, s) => acc + s.prob7d, 0) / catSkus.length) * 0.45
    );
    const zeroStockProbability = clampProb(peak.zeroStockProbability * 0.55 + avgProb * 0.45);

    byCategory[catId] = {
      categoryId: catId,
      zeroStockProbability,
      prob24h,
      prob72h,
      prob7d,
      riskTier: probabilityToRiskTier(zeroStockProbability),
      dailyOrderBurnRate:
        Math.round(catSkus.reduce((acc, s) => acc + s.dailyOrderBurnRate, 0) * 10) / 10,
      replenishmentVelocity:
        Math.round(catSkus.reduce((acc, s) => acc + s.replenishmentVelocity, 0) * 10) / 10,
      hottestWarehouse: shortenWh(peak.warehouse),
      atRiskSkuCount: catSkus.filter((s) => s.zeroStockProbability >= 50).length
    };
  });

  const highRiskWarehouseCount = warehouses.filter(
    (w) => w.zeroStockProbability >= 50
  ).length;
  const imminentWarehouseCount = warehouses.filter(
    (w) => w.zeroStockProbability >= 75
  ).length;
  const peakProbability = warehouses.length > 0 ? warehouses[0].zeroStockProbability : 0;
  const networkDailyBurn =
    Math.round(warehouses.reduce((acc, w) => acc + w.dailyOrderBurnRate, 0) * 10) / 10;
  const networkReplenishmentVelocity =
    Math.round(warehouses.reduce((acc, w) => acc + w.replenishmentVelocity, 0) * 10) / 10;

  return {
    warehouses,
    warehouseByNorm,
    byCategory,
    highRiskWarehouseCount,
    imminentWarehouseCount,
    peakProbability,
    mostVulnerableWarehouse: warehouses[0] || null,
    networkDailyBurn,
    networkReplenishmentVelocity
  };
}
