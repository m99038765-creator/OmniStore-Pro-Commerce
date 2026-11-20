import { Product, SkuAuditLogEntry } from '../types';
import { checkSkuAuditLogSafety } from './skuAuditSafety';

export type DensityClusterTier = 'high' | 'moderate' | 'low' | 'empty';

export interface AisleBayCell {
  id: string;
  aisleIndex: number;
  bayIndex: number;
  aisleCode: string;
  aisleName: string;
  aisleCategory: Product['category'] | 'staging';
  bayCode: string;
  bayLabel: string;
  units: number;
  capacity: number;
  densityPct: number;
  clusterTier: DensityClusterTier;
  reservedUnits: number;
  skus: Product[];
  hasLowStockAlert: boolean;
  hasQuarantineOrDamage: boolean;
}

export interface AisleDensitySummary {
  aisleCode: string;
  aisleName: string;
  aisleCategory: Product['category'] | 'staging';
  totalUnits: number;
  totalCapacity: number;
  avgDensityPct: number;
  highClusterBays: number;
  lowClusterBays: number;
  skuCount: number;
  dominantTier: DensityClusterTier;
}

export interface RegionalHubHeatmapData {
  hubName: string;
  shortName: string;
  hubCode: string;
  cells: AisleBayCell[];
  aisles: AisleDensitySummary[];
  bays: { code: string; label: string }[];
  totalUnits: number;
  totalCapacity: number;
  avgDensityPct: number;
  highClusterCount: number;
  moderateClusterCount: number;
  lowClusterCount: number;
  emptyBayCount: number;
  hubProductsCount: number;
}

export const AISLE_DEFINITIONS: {
  code: string;
  name: string;
  shortName: string;
  category: Product['category'] | 'staging';
}[] = [
  { code: 'A1', name: 'Aisle A1 · Mastering Audio', shortName: 'A1 · Audio', category: 'audio' },
  { code: 'A2', name: 'Aisle A2 · Workstations & Displays', shortName: 'A2 · Displays', category: 'workstation' },
  { code: 'A3', name: 'Aisle A3 · High-IO Computing', shortName: 'A3 · Computing', category: 'computing' },
  { code: 'A4', name: 'Aisle A4 · Cinema Optics', shortName: 'A4 · Optics', category: 'optics' },
  { code: 'A5', name: 'Aisle A5 · Artisan Peripherals', shortName: 'A5 · Peripherals', category: 'peripherals' },
  { code: 'A6', name: 'Aisle A6 · Express Staging & Reserve', shortName: 'A6 · Staging', category: 'staging' }
];

export const BAY_DEFINITIONS: { code: string; label: string }[] = [
  { code: 'B01', label: 'Bay 01' },
  { code: 'B02', label: 'Bay 02' },
  { code: 'B03', label: 'Bay 03' },
  { code: 'B04', label: 'Bay 04' },
  { code: 'B05', label: 'Bay 05' },
  { code: 'B06', label: 'Bay 06' }
];

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function classifyDensityTier(densityPct: number, units: number): DensityClusterTier {
  if (units <= 0 || densityPct <= 0) return 'empty';
  if (densityPct >= 65) return 'high';
  if (densityPct >= 30) return 'moderate';
  return 'low';
}

export function extractHubShortName(warehouse: string): string {
  return (warehouse || '').split('(')[0].trim() || warehouse;
}

export function extractHubCode(warehouse: string): string {
  const match = (warehouse || '').match(/\(([^)]+)\)/);
  return match ? match[1] : 'WH';
}

export function getRegionalHubList(products: Product[]): string[] {
  const hubSet = new Set<string>();
  for (const p of products) {
    if (p.warehouse && p.warehouse.trim()) {
      hubSet.add(p.warehouse.trim());
    }
  }
  const ordered = Array.from(hubSet).sort((a, b) => {
    const codeA = extractHubCode(a);
    const codeB = extractHubCode(b);
    return codeA.localeCompare(codeB);
  });
  return ordered.length > 0 ? ordered : ['Bay Area Hub (WH-01)'];
}

/**
 * Computes a 6-aisle × 6-bay spatial inventory density matrix for a given regional hub,
 * combining live SKU stock allocations at that hub with deterministic regional racking
 * clusters so managers can visually contrast high-density vs. low-density clusters per aisle.
 */
export function buildRegionalHubHeatmap(
  hubName: string,
  allProducts: Product[],
  auditLogs: SkuAuditLogEntry[] = []
): RegionalHubHeatmapData {
  const normTarget = extractHubShortName(hubName).toLowerCase();
  const hubProducts = allProducts.filter(
    p => extractHubShortName(p.warehouse).toLowerCase() === normTarget
  );

  // Precompute safety flags for SKUs
  const flaggedSkuSet = new Set<string>();
  for (const p of allProducts) {
    if (!checkSkuAuditLogSafety(p.sku, auditLogs).isSafe) {
      flaggedSkuSet.add(p.sku.trim().toUpperCase());
    }
  }

  // Group hub products by category + collect cross-hub buffer references for non-primary aisles
  const hubByCategory = new Map<Product['category'], Product[]>();
  const catalogByCategory = new Map<Product['category'], Product[]>();

  for (const p of allProducts) {
    const catList = catalogByCategory.get(p.category) || [];
    catList.push(p);
    catalogByCategory.set(p.category, catList);
  }

  for (const p of hubProducts) {
    const catList = hubByCategory.get(p.category) || [];
    catList.push(p);
    hubByCategory.set(p.category, catList);
  }

  const cells: AisleBayCell[] = [];
  const aisles: AisleDensitySummary[] = [];

  const BAY_CAPACITY = 20;

  AISLE_DEFINITIONS.forEach((aisleDef, aisleIndex) => {
    const primaryProds =
      aisleDef.category === 'staging'
        ? hubProducts.filter(p => p.reserved > 0 || p.stock <= p.lowStockThreshold)
        : hubByCategory.get(aisleDef.category) || [];

    const fallbackProds =
      aisleDef.category === 'staging'
        ? hubProducts
        : catalogByCategory.get(aisleDef.category) || [];

    let aisleUnits = 0;
    let aisleCapacity = 0;
    let highBays = 0;
    let lowBays = 0;
    const aisleSkuIds = new Set<string>();

    BAY_DEFINITIONS.forEach((bayDef, bayIndex) => {
      const seed = stableHash(`${hubName}::${aisleDef.code}::${bayDef.code}`);
      const isPrimaryAisleForHub = primaryProds.length > 0;

      // Determine assigned SKUs and live units for this bay
      let assignedSkus: Product[] = [];
      let units = 0;
      let reservedUnits = 0;

      if (aisleDef.category === 'staging') {
        const stagingPool = primaryProds.length > 0 ? primaryProds : hubProducts;
        if (stagingPool.length > 0) {
          const prod = stagingPool[bayIndex % stagingPool.length];
          const isExpressLane = bayIndex < 3;
          if (isExpressLane || prod.reserved > 0) {
            assignedSkus = [prod];
            reservedUnits = prod.reserved;
            const liveFactor = Math.max(0, prod.reserved * 3 + Math.min(prod.stock, 8));
            const laneModifier = bayIndex === 0 ? 1.25 : bayIndex === 1 ? 0.95 : bayIndex === 2 ? 0.55 : 0.3;
            units = Math.min(BAY_CAPACITY, Math.round(liveFactor * laneModifier + (seed % 4)));
          } else {
            // Reserve staging slots can be lightly populated or empty
            units = seed % 5 === 0 ? 0 : 1 + (seed % 4);
            if (units > 0) assignedSkus = [prod];
          }
        }
      } else if (isPrimaryAisleForHub) {
        // Hub directly stocks SKUs in this category: create realistic high/low bay clusters driven by live stock
        const prod = primaryProds[bayIndex % primaryProds.length];
        assignedSkus = [prod];
        reservedUnits = bayIndex === 0 ? prod.reserved : 0;

        // Concentrate bulk stock in bays 0-2 (bulk racking) and sparser pick-face stock in bays 3-5
        const bayProfileWeights = [1.35, 1.15, 0.9, 0.55, 0.35, 0.2];
        const hubWave = ((seed % 7) - 3) * 0.08;
        const weight = Math.max(0.08, bayProfileWeights[bayIndex] + hubWave);

        if (prod.stock === 0) {
          units = 0;
        } else {
          // Scale around real live product.stock so restocking/depleting updates heatmap immediately
          units = Math.min(
            BAY_CAPACITY,
            Math.max(1, Math.round(prod.stock * weight + (bayIndex < 2 ? 3 : 0)))
          );
        }
      } else if (fallbackProds.length > 0) {
        // Regional hub holds lighter satellite/transit buffer for categories anchored at other hubs
        const prod = fallbackProds[bayIndex % fallbackProds.length];
        const hasSatelliteBin = (seed % 10) < 6;
        if (hasSatelliteBin && prod.stock > 0) {
          assignedSkus = [prod];
          const satelliteUnits = Math.max(1, Math.round(Math.min(prod.stock, 10) * (0.25 + (seed % 5) * 0.14)));
          units = Math.min(BAY_CAPACITY, satelliteUnits);
        } else {
          units = 0;
        }
      }

      const capacity = BAY_CAPACITY;
      const densityPct = Math.min(100, Math.round((units / capacity) * 100));
      const clusterTier = classifyDensityTier(densityPct, units);

      const hasLowStockAlert = assignedSkus.some(p => p.stock <= p.lowStockThreshold);
      const hasQuarantineOrDamage = assignedSkus.some(p =>
        flaggedSkuSet.has(p.sku.trim().toUpperCase())
      );

      assignedSkus.forEach(p => aisleSkuIds.add(p.id));
      aisleUnits += units;
      aisleCapacity += capacity;
      if (clusterTier === 'high') highBays += 1;
      if (clusterTier === 'low' || clusterTier === 'empty') lowBays += 1;

      cells.push({
        id: `${aisleDef.code}-${bayDef.code}`,
        aisleIndex,
        bayIndex,
        aisleCode: aisleDef.code,
        aisleName: aisleDef.shortName,
        aisleCategory: aisleDef.category,
        bayCode: bayDef.code,
        bayLabel: bayDef.label,
        units,
        capacity,
        densityPct,
        clusterTier,
        reservedUnits,
        skus: assignedSkus,
        hasLowStockAlert,
        hasQuarantineOrDamage
      });
    });

    const avgDensityPct = aisleCapacity > 0 ? Math.round((aisleUnits / aisleCapacity) * 100) : 0;
    aisles.push({
      aisleCode: aisleDef.code,
      aisleName: aisleDef.name,
      aisleCategory: aisleDef.category,
      totalUnits: aisleUnits,
      totalCapacity: aisleCapacity,
      avgDensityPct,
      highClusterBays: highBays,
      lowClusterBays: lowBays,
      skuCount: aisleSkuIds.size,
      dominantTier: classifyDensityTier(avgDensityPct, aisleUnits)
    });
  });

  const totalUnits = cells.reduce((sum, c) => sum + c.units, 0);
  const totalCapacity = cells.reduce((sum, c) => sum + c.capacity, 0);
  const avgDensityPct = totalCapacity > 0 ? Math.round((totalUnits / totalCapacity) * 100) : 0;

  return {
    hubName,
    shortName: extractHubShortName(hubName),
    hubCode: extractHubCode(hubName),
    cells,
    aisles,
    bays: BAY_DEFINITIONS,
    totalUnits,
    totalCapacity,
    avgDensityPct,
    highClusterCount: cells.filter(c => c.clusterTier === 'high').length,
    moderateClusterCount: cells.filter(c => c.clusterTier === 'moderate').length,
    lowClusterCount: cells.filter(c => c.clusterTier === 'low').length,
    emptyBayCount: cells.filter(c => c.clusterTier === 'empty').length,
    hubProductsCount: hubProducts.length
  };
}
