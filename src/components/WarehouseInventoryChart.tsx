import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  Filter,
  Sparkles,
  TrendingUp,
  PackageCheck,
  RotateCcw,
  Zap,
  Flame,
  GitCompareArrows,
  CheckCircle2,
  Sliders,
  X,
  Building2,
  AlertTriangle,
  Gauge,
  Activity,
  PackagePlus,
  Clock,
  Loader2,
  CheckSquare,
  Square,
  ClipboardCheck
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CategoryDepletionAiSection } from './CategoryDepletionAiSection';
import { getAllRegionalConflicts, RegionalWarehouseSnapshot } from '../utils/inventoryConflicts';
import {
  computeWarehouseDiscrepancyHeatmap,
  getChartSkuDiscrepancies,
  WarehouseSubZoneMetric,
  DiscrepancyRiskTier
} from '../utils/warehouseZoneDiscrepancies';
import {
  computeLowStockProbabilityHeatmap,
  ZeroStockRiskTier
} from '../utils/lowStockProbability';

interface CategoryDataPoint {
  categoryId: string;
  categoryLabel: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
  skuCount: number;
  inventoryValue: number;
  color: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; hoverColor: string }> = {
  audio: {
    label: 'Audio',
    color: '#0ea5e9', // Sky 500
    hoverColor: '#38bdf8'
  },
  workstation: {
    label: 'Workstations',
    color: '#6366f1', // Indigo 500
    hoverColor: '#818cf8'
  },
  computing: {
    label: 'Computing',
    color: '#8b5cf6', // Violet 500
    hoverColor: '#a78bfa'
  },
  optics: {
    label: 'Cinema Optics',
    color: '#10b981', // Emerald 500
    hoverColor: '#34d399'
  },
  peripherals: {
    label: 'Peripherals',
    color: '#f59e0b', // Amber 500
    hoverColor: '#fbbf24'
  }
};

export const WarehouseInventoryChart: React.FC = () => {
  const {
    products,
    orders,
    selectedCategory,
    setSelectedCategory,
    setIsAdminOpen,
    setAdminActiveTab,
    openAdminForProduct,
    warehouseAuditLogs,
    warehouseConflicts,
    resolvedRegionalConflictSkus,
    chartDrilldownSku,
    setChartDrilldownSku,
    resolveRegionalConflict,
    reconciledDiscrepancySkus,
    selectedDiscrepancySkus,
    setSelectedDiscrepancySkus,
    toggleDiscrepancySkuSelection,
    openBatchReconcileForSkus,
    restockProduct,
    addAlert
  } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [metricMode, setMetricMode] = useState<'units' | 'valuation'>('units');
  const [viewMode, setViewMode] = useState<'categories' | 'heatmap' | 'ai-insights' | 'conflicts'>('categories');
  const [showAiDepletionInsights, setShowAiDepletionInsights] = useState(true);
  const [showDiscrepancyOverlay, setShowDiscrepancyOverlay] = useState(true);
  const [showLowStockProbLayer, setShowLowStockProbLayer] = useState(true);
  const [selectedHeatZone, setSelectedHeatZone] = useState<WarehouseSubZoneMetric | null>(null);
  const [selectedProbWarehouseName, setSelectedProbWarehouseName] = useState<string | null>(null);
  const [restockingSkuId, setRestockingSkuId] = useState<string | null>(null);

  const allRegionalConflicts = useMemo(
    () =>
      getAllRegionalConflicts(
        products,
        warehouseAuditLogs,
        warehouseConflicts,
        resolvedRegionalConflictSkus
      ),
    [products, warehouseAuditLogs, warehouseConflicts, resolvedRegionalConflictSkus]
  );

  const discrepancyHeatmap = useMemo(
    () =>
      computeWarehouseDiscrepancyHeatmap(
        products,
        warehouseAuditLogs,
        allRegionalConflicts,
        reconciledDiscrepancySkus
      ),
    [products, warehouseAuditLogs, allRegionalConflicts, reconciledDiscrepancySkus]
  );

  const chartSkuDiscrepancies = useMemo(
    () =>
      getChartSkuDiscrepancies(
        products,
        warehouseAuditLogs,
        allRegionalConflicts,
        reconciledDiscrepancySkus
      ),
    [products, warehouseAuditLogs, allRegionalConflicts, reconciledDiscrepancySkus]
  );

  const activeSelectedChartSkus = useMemo(() => {
    const activeSet = new Set(chartSkuDiscrepancies.map((d) => d.sku.trim().toUpperCase()));
    return selectedDiscrepancySkus.filter((s) => activeSet.has(s.trim().toUpperCase()));
  }, [chartSkuDiscrepancies, selectedDiscrepancySkus]);

  const lowStockProbHeatmap = useMemo(
    () => computeLowStockProbabilityHeatmap(products, orders, warehouseAuditLogs),
    [products, orders, warehouseAuditLogs]
  );

  const selectedProbWarehouse = useMemo(() => {
    if (!selectedProbWarehouseName) return null;
    return (
      lowStockProbHeatmap.warehouses.find(
        (w) => w.warehouseName === selectedProbWarehouseName
      ) || null
    );
  }, [lowStockProbHeatmap, selectedProbWarehouseName]);

  const handleQuickRestockFromHeatmap = async (
    productId: string,
    sku: string,
    qty: number,
    warehouseName: string
  ) => {
    if (restockingSkuId) return;
    setRestockingSkuId(productId);
    const ok = await restockProduct(productId, qty);
    setRestockingSkuId(null);
    if (ok) {
      addAlert(
        'success',
        'Preventive Restock Applied',
        `Replenished +${qty} units of ${sku} at ${warehouseName} to reduce zero-stock risk.`
      );
    }
  };

  const getProbTierStyles = (tier: ZeroStockRiskTier) => {
    if (tier === 'imminent') {
      return {
        cell: 'bg-fuchsia-500/30 hover:bg-fuchsia-500/40 border-fuchsia-400/75 text-fuchsia-100 shadow-[inset_0_0_16px_rgba(217,70,239,0.3)]',
        badge: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/60',
        bar: 'bg-gradient-to-r from-rose-500 to-fuchsia-500',
        dot: 'bg-fuchsia-400',
        wash: 'from-fuchsia-500/25 via-rose-500/10 to-transparent border-fuchsia-500/40',
        label: 'Imminent'
      };
    }
    if (tier === 'high') {
      return {
        cell: 'bg-rose-500/24 hover:bg-rose-500/34 border-rose-500/65 text-rose-100 shadow-[inset_0_0_12px_rgba(244,63,94,0.22)]',
        badge: 'bg-rose-500/20 text-rose-200 border-rose-500/55',
        bar: 'bg-gradient-to-r from-orange-500 to-rose-500',
        dot: 'bg-rose-400',
        wash: 'from-rose-500/20 via-orange-500/8 to-transparent border-rose-500/35',
        label: 'High Risk'
      };
    }
    if (tier === 'moderate') {
      return {
        cell: 'bg-amber-500/18 hover:bg-amber-500/28 border-amber-500/50 text-amber-100',
        badge: 'bg-amber-500/20 text-amber-200 border-amber-500/45',
        bar: 'bg-gradient-to-r from-amber-500 to-orange-400',
        dot: 'bg-amber-400',
        wash: 'from-amber-500/16 via-amber-500/6 to-transparent border-amber-500/30',
        label: 'Moderate'
      };
    }
    return {
      cell: 'bg-cyan-950/35 hover:bg-cyan-900/45 border-cyan-500/30 text-cyan-200',
      badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
      bar: 'bg-gradient-to-r from-emerald-500 to-cyan-400',
      dot: 'bg-cyan-400',
      wash: 'from-cyan-500/10 via-transparent to-transparent border-cyan-500/20',
      label: 'Low Risk'
    };
  };

  const getTierStyles = (tier: DiscrepancyRiskTier) => {
    if (tier === 'critical') {
      return {
        cell: 'bg-rose-500/30 hover:bg-rose-500/40 border-rose-500/75 text-rose-100 shadow-[inset_0_0_18px_rgba(244,63,94,0.3)]',
        badge: 'bg-rose-500/25 text-rose-200 border-rose-500/60',
        dot: 'bg-rose-400',
        wash: 'from-rose-500/28 via-rose-500/12 to-transparent border-rose-500/40',
        label: 'Critical Zone'
      };
    }
    if (tier === 'high') {
      return {
        cell: 'bg-orange-500/25 hover:bg-orange-500/35 border-orange-500/65 text-orange-100 shadow-[inset_0_0_14px_rgba(249,115,22,0.22)]',
        badge: 'bg-orange-500/25 text-orange-200 border-orange-500/55',
        dot: 'bg-orange-400',
        wash: 'from-orange-500/22 via-orange-500/10 to-transparent border-orange-500/35',
        label: 'High Drift'
      };
    }
    if (tier === 'elevated') {
      return {
        cell: 'bg-amber-500/18 hover:bg-amber-500/28 border-amber-500/50 text-amber-100',
        badge: 'bg-amber-500/20 text-amber-200 border-amber-500/45',
        dot: 'bg-amber-400',
        wash: 'from-amber-500/16 via-amber-500/6 to-transparent border-amber-500/30',
        label: 'Elevated'
      };
    }
    return {
      cell: 'bg-emerald-950/35 hover:bg-emerald-900/40 border-emerald-500/25 text-emerald-300/90',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
      dot: 'bg-emerald-400',
      wash: 'from-emerald-500/8 via-transparent to-transparent border-emerald-500/15',
      label: 'Healthy'
    };
  };

  useEffect(() => {
    if (chartDrilldownSku) {
      setIsExpanded(true);
      setViewMode('conflicts');
    }
  }, [chartDrilldownSku]);

  const activeRegionalConflict = useMemo(() => {
    if (allRegionalConflicts.length === 0) return null;
    if (chartDrilldownSku) {
      const exact = allRegionalConflicts.find(
        (c) => c.sku.toUpperCase() === chartDrilldownSku.trim().toUpperCase()
      );
      if (exact) return exact;
    }
    return allRegionalConflicts[0];
  }, [allRegionalConflicts, chartDrilldownSku]);

  
  // Compute demand density by warehouse
  const warehouseDensity = useMemo(() => {
     const wStats: Record<string, { totalStock: number, totalOrdered: number, reserved: number, value: number, skus: number }> = {};
     products.forEach(p => {
        if (!wStats[p.warehouse]) {
           wStats[p.warehouse] = { totalStock: 0, totalOrdered: 0, reserved: 0, value: 0, skus: 0 };
        }
        wStats[p.warehouse].totalStock += p.stock;
        wStats[p.warehouse].reserved += p.reserved;
        wStats[p.warehouse].value += p.price * p.stock;
        wStats[p.warehouse].skus += 1;
     });
     
     orders.forEach(o => {
        o.items.forEach(item => {
           const product = products.find(p => p.id === item.productId);
           if (product && wStats[product.warehouse]) {
               wStats[product.warehouse].totalOrdered += item.quantity;
           }
        });
     });

     let maxRate = 0;
     const mapped = Object.entries(wStats).map(([name, stats]) => {
         const demandVolume = stats.totalOrdered + stats.reserved;
         const turnoverRate = stats.totalStock > 0 ? demandVolume / (stats.totalStock + demandVolume) : 0; 
         if (turnoverRate > maxRate) maxRate = turnoverRate;
         return {
            name,
            ...stats,
            demandVolume,
            turnoverRate
         };
     }).sort((a, b) => b.turnoverRate - a.turnoverRate);

     return { data: mapped, maxRate };
  }, [products, orders]);

  // Compute category stock breakdown from authoritative store products
  const categoryStats: CategoryDataPoint[] = useMemo(() => {
    const rawCategories = ['audio', 'workstation', 'computing', 'optics', 'peripherals'];

    return rawCategories.map((catKey) => {
      const catProducts = products.filter((p) => p.category === catKey);
      const available = catProducts.reduce((acc, p) => acc + (p.stock || 0), 0);
      const reserved = catProducts.reduce((acc, p) => acc + (p.reserved || 0), 0);
      const value = catProducts.reduce((acc, p) => acc + (p.stock || 0) * p.price, 0);
      const config = CATEGORY_CONFIG[catKey] || {
        label: catKey,
        color: '#0ea5e9',
        hoverColor: '#38bdf8'
      };

      return {
        categoryId: catKey,
        categoryLabel: config.label,
        availableStock: available,
        reservedStock: reserved,
        totalStock: available + reserved,
        skuCount: catProducts.length,
        inventoryValue: Math.round(value),
        color: config.color
      };
    });
  }, [products]);

  // Overall warehouse aggregate telemetry
  const totals = useMemo(() => {
    return {
      availableUnits: categoryStats.reduce((acc, c) => acc + c.availableStock, 0),
      reservedUnits: categoryStats.reduce((acc, c) => acc + c.reservedStock, 0),
      totalValue: categoryStats.reduce((acc, c) => acc + c.inventoryValue, 0),
      totalSkus: categoryStats.reduce((acc, c) => acc + c.skuCount, 0)
    };
  }, [categoryStats]);

  // Custom Chart Tooltip
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data: CategoryDataPoint = payload[0].payload;
      const catProb = lowStockProbHeatmap.byCategory[data.categoryId];
      return (
        <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-700/90 p-3.5 rounded-xl shadow-2xl shadow-black/80 text-xs min-w-[225px] space-y-2">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: data.color }}
              />
              <span className="font-bold text-white text-sm">{data.categoryLabel}</span>
            </div>
            <span className="font-mono text-[10px] text-neutral-400">
              {data.skuCount} SKUs
            </span>
          </div>

          <div className="space-y-1 text-neutral-300 font-mono text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Available Stock:</span>
              <span className="font-bold text-sky-400">{data.availableStock.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-neutral-400">Reserved Allocation:</span>
              <span className="font-bold text-amber-400">{data.reservedStock.toLocaleString()} units</span>
            </div>
            <div className="flex justify-between items-center border-t border-neutral-800/80 pt-1">
              <span className="text-neutral-400">Inventory Value:</span>
              <span className="font-bold text-emerald-400">${data.inventoryValue.toLocaleString()}</span>
            </div>
            {showLowStockProbLayer && catProb && (
              <div className="border-t border-fuchsia-500/30 pt-1.5 mt-1 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-fuchsia-300">Zero-Stock Prob.:</span>
                  <span className="font-bold text-fuchsia-200">{catProb.zeroStockProbability}%</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-neutral-400">Burn vs Replenish:</span>
                  <span className="text-neutral-200">
                    -{catProb.dailyOrderBurnRate}/d vs +{catProb.replenishmentVelocity}/d
                  </span>
                </div>
                {catProb.hottestWarehouse && (
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-neutral-400">Highest Risk Hub:</span>
                    <span className="text-rose-300 font-semibold">{catProb.hottestWarehouse}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-neutral-500 italic pt-1 text-center">
            Click bar to filter catalog by {data.categoryLabel}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <section
      id="warehouse-inventory-distribution-dashboard"
      className="mb-8 rounded-2xl bg-neutral-900/40 border border-neutral-800 overflow-hidden transition-all duration-300 shadow-md"
    >
      {/* Header bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 bg-neutral-900/60">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                Warehouse Inventory Distribution
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-sky-300 border border-neutral-700">
                {totals.availableUnits.toLocaleString()} units available
              </span>
              {selectedCategory !== 'all' && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                  Filtered: {CATEGORY_CONFIG[selectedCategory]?.label || selectedCategory}
                </span>
              )}
              {allRegionalConflicts.length > 0 && (
                <button
                  type="button"
                  id="chart-header-conflicts-pill"
                  onClick={() => {
                    setIsExpanded(true);
                    setViewMode('conflicts');
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/50 transition-colors cursor-pointer"
                  title="Inspect SKUs with conflicting regional warehouse data"
                >
                  <GitCompareArrows className="w-3 h-3 text-orange-400" />
                  <span>
                    {allRegionalConflicts.length} Regional Conflict{allRegionalConflicts.length > 1 ? 's' : ''}
                  </span>
                </button>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live stock levels, reserved allocations, regional sync conflicts, and valuations across warehouse categories
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs flex-wrap">
            <button
              id="chart-view-categories-btn"
              onClick={() => setViewMode('categories')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer ${
                viewMode === 'categories'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Categories
            </button>
            <button
              id="chart-view-heatmap-btn"
              onClick={() => setViewMode('heatmap')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer flex items-center gap-1 ${
                viewMode === 'heatmap'
                  ? 'bg-rose-500/20 text-rose-300 shadow-xs'
                  : 'text-neutral-400 hover:text-rose-400/70'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              Density Heatmap
            </button>
            <button
              id="chart-view-conflicts-btn"
              onClick={() => setViewMode('conflicts')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer flex items-center gap-1 ${
                viewMode === 'conflicts'
                  ? 'bg-orange-500/20 text-orange-200 shadow-xs border border-orange-500/50 font-semibold'
                  : allRegionalConflicts.length > 0
                  ? 'text-orange-300/90 hover:text-orange-200'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <GitCompareArrows className="w-3 h-3 text-orange-400" />
              <span>Regional Conflicts</span>
              {allRegionalConflicts.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-md text-[9px] font-mono font-bold bg-orange-500/25 text-orange-200 border border-orange-500/40">
                  {allRegionalConflicts.length}
                </span>
              )}
            </button>
            <button
              id="chart-view-ai-insights-btn"
              onClick={() => setViewMode('ai-insights')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer flex items-center gap-1 ${
                viewMode === 'ai-insights'
                  ? 'bg-violet-500/20 text-violet-300 shadow-xs border border-violet-500/40'
                  : 'text-neutral-400 hover:text-violet-300'
              }`}
            >
              <Sparkles className="w-3 h-3 text-violet-400" />
              <span>AI Depletion Forecast</span>
            </button>
          </div>

          {/* Discrepancy Heatmap Overlay Toggle */}
          <button
            type="button"
            id="chart-discrepancy-overlay-toggle-btn"
            aria-pressed={showDiscrepancyOverlay}
            onClick={() => setShowDiscrepancyOverlay((prev) => !prev)}
            title={
              showDiscrepancyOverlay
                ? 'Hide stock discrepancy heatmap overlay'
                : 'Show visual heatmap overlay highlighting warehouse zones with frequent stock discrepancies'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-semibold transition-all cursor-pointer ${
              showDiscrepancyOverlay
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border-rose-500/60 shadow-xs shadow-rose-950/50'
                : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${showDiscrepancyOverlay ? 'text-rose-400' : 'text-neutral-500'}`} />
            <span>Discrepancy Heatmap</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                showDiscrepancyOverlay
                  ? 'bg-rose-500/30 text-rose-100 border border-rose-400/40'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {showDiscrepancyOverlay ? `${discrepancyHeatmap.hotZoneCount} Hot` : 'OFF'}
            </span>
          </button>

          {/* Low-Stock Probability Heatmap Layer Toggle */}
          <button
            type="button"
            id="chart-low-stock-prob-toggle-btn"
            aria-pressed={showLowStockProbLayer}
            onClick={() => setShowLowStockProbLayer((prev) => !prev)}
            title={
              showLowStockProbLayer
                ? 'Hide Low-Stock Probability heatmap layer'
                : 'Show Low-Stock Probability heatmap layer forecasting regional zero-stock risk from order volume and replenishment velocity'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-mono font-semibold transition-all cursor-pointer ${
              showLowStockProbLayer
                ? 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200 border-fuchsia-500/60 shadow-xs shadow-fuchsia-950/50'
                : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800'
            }`}
          >
            <Gauge className={`w-3.5 h-3.5 ${showLowStockProbLayer ? 'text-fuchsia-400' : 'text-neutral-500'}`} />
            <span>Low-Stock Prob.</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                showLowStockProbLayer
                  ? 'bg-fuchsia-500/30 text-fuchsia-100 border border-fuchsia-400/40'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {showLowStockProbLayer
                ? lowStockProbHeatmap.highRiskWarehouseCount > 0
                  ? `${lowStockProbHeatmap.highRiskWarehouseCount} At Risk`
                  : `Peak ${lowStockProbHeatmap.peakProbability}%`
                : 'OFF'}
            </span>
          </button>

          {/* Units vs Valuation Mode Switcher */}
          <div className={`flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs ${viewMode !== 'categories' ? 'hidden' : ''}`}>
            <button
              id="chart-mode-units-btn"
              onClick={() => setMetricMode('units')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer ${
                metricMode === 'units'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Stock Units
            </button>
            <button
              id="chart-mode-valuation-btn"
              onClick={() => setMetricMode('valuation')}
              className={`px-2.5 py-1 rounded-lg transition-all text-[11px] font-medium cursor-pointer ${
                metricMode === 'valuation'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Valuation ($)
            </button>
          </div>

          {/* Reset Filter Button if active */}
          {selectedCategory !== 'all' && (
            <button
              id="chart-reset-category-filter-btn"
              onClick={() => setSelectedCategory('all')}
              title="Reset category filter to show all products"
              className="flex items-center gap-1 text-xs text-neutral-300 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden md:inline">Reset Category</span>
            </button>
          )}

          {/* Expand / Collapse Button */}
          <button
            id="chart-toggle-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse inventory chart' : 'Expand inventory chart'}
            className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Toggle inventory chart display"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Chart Area (collapsible) */}
      {isExpanded && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Regional Conflicts Drill-Down View */}
          {viewMode === 'conflicts' && (
            <div id="warehouse-regional-conflicts-panel" className="space-y-4">
              {allRegionalConflicts.length === 0 ? (
                <div className="p-8 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-white">All Regional Warehouses Synchronized</h4>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    No conflicting inventory counts detected across regional hubs. All catalog SKUs match authoritative warehouse ledgers.
                  </p>
                </div>
              ) : (
                <>
                  {/* Conflicting SKU Selector Strip */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-800/80">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                        Conflicting SKUs:
                      </span>
                      {allRegionalConflicts.map((conflict) => {
                        const isActive = activeRegionalConflict?.sku === conflict.sku;
                        const isChecked = activeSelectedChartSkus.includes(
                          conflict.sku.trim().toUpperCase()
                        );
                        return (
                          <div
                            key={conflict.sku}
                            className={`rounded-lg border transition-all flex items-center overflow-hidden ${
                              isActive
                                ? 'bg-orange-500/25 text-orange-200 border-orange-400 font-bold shadow-xs ring-1 ring-orange-500/40'
                                : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-orange-500/50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => toggleDiscrepancySkuSelection(conflict.sku)}
                              title={`Select ${conflict.sku} for Batch Reconcile`}
                              className="pl-2 pr-1 py-1 text-orange-300 hover:text-white cursor-pointer"
                              aria-label={`Select ${conflict.sku} for batch reconcile`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5 text-neutral-500" />
                              )}
                            </button>
                            <button
                              type="button"
                              id={`conflict-drilldown-tab-${conflict.sku}`}
                              onClick={() => setChartDrilldownSku(conflict.sku)}
                              className="pr-2.5 pl-1 py-1 text-[11px] font-mono cursor-pointer flex items-center gap-1.5"
                            >
                              <span>{conflict.sku}</span>
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded ${
                                  conflict.delta > 0
                                    ? 'bg-orange-500/30 text-orange-200'
                                    : 'bg-rose-500/30 text-rose-200'
                                }`}
                              >
                                {conflict.delta >= 0 ? `+${conflict.delta}` : conflict.delta}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id="chart-conflicts-batch-reconcile-btn"
                        onClick={() =>
                          openBatchReconcileForSkus(
                            activeSelectedChartSkus.length > 0
                              ? activeSelectedChartSkus
                              : allRegionalConflicts.map((c) => c.sku)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Open Batch Reconcile in Warehouse Admin Modal with selected discrepancies"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>
                          Batch Reconcile ({activeSelectedChartSkus.length > 0 ? activeSelectedChartSkus.length : allRegionalConflicts.length})
                        </span>
                      </button>

                      {chartDrilldownSku && (
                        <button
                          type="button"
                          onClick={() => {
                            setChartDrilldownSku(null);
                            setViewMode('categories');
                          }}
                          className="text-[11px] text-neutral-400 hover:text-white flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Exit Drill-Down</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeRegionalConflict && (
                    <div className="space-y-4">
                      {/* Active Conflict Summary Header */}
                      <div className="p-4 rounded-2xl bg-orange-950/25 border border-orange-500/45 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-orange-500/25 text-orange-200 border border-orange-500/50">
                              Inventory Conflict Drill-Down
                            </span>
                            <span className="text-xs font-mono font-bold text-sky-300">
                              {activeRegionalConflict.sku}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              Detected {activeRegionalConflict.detectedAt}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">
                            {activeRegionalConflict.productName}
                          </h4>
                          <p className="text-xs text-neutral-300 leading-relaxed">
                            {activeRegionalConflict.reason}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            id={`reconcile-regional-conflict-btn-${activeRegionalConflict.sku}`}
                            onClick={() =>
                              resolveRegionalConflict(
                                activeRegionalConflict.sku,
                                activeRegionalConflict.productName
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Reconcile Regional Ledgers</span>
                          </button>

                          {(() => {
                            const matchedProd = products.find(
                              (p) => p.sku.toUpperCase() === activeRegionalConflict.sku.toUpperCase()
                            );
                            if (!matchedProd) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => openAdminForProduct(matchedProd)}
                                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-sky-300 border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Inspect in Admin</span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Regional Hub Comparison Bar Chart */}
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                        <div className="lg:col-span-3 p-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/90">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-orange-400" />
                              Regional Hub Stock Comparison ({activeRegionalConflict.sku})
                            </span>
                            <span className="text-[10px] font-mono text-orange-300">
                              Delta: {activeRegionalConflict.delta >= 0 ? `+${activeRegionalConflict.delta}` : activeRegionalConflict.delta} units
                            </span>
                          </div>
                          <div className="w-full h-56">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={activeRegionalConflict.hubSnapshots}
                                margin={{ top: 10, right: 12, left: -10, bottom: 8 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                                <XAxis
                                  dataKey="shortName"
                                  stroke="#525252"
                                  tick={{ fill: '#d4d4d4', fontSize: 11 }}
                                />
                                <YAxis
                                  stroke="#525252"
                                  tick={{ fill: '#a3a3a3', fontSize: 11 }}
                                  allowDecimals={false}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#0a0a0a',
                                    borderColor: '#404040',
                                    borderRadius: '0.75rem',
                                    fontSize: '12px'
                                  }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar
                                  dataKey="reportedStock"
                                  name="Reported Stock"
                                  radius={[5, 5, 0, 0]}
                                  maxBarSize={48}
                                >
                                  {activeRegionalConflict.hubSnapshots.map((snap: RegionalWarehouseSnapshot) => (
                                    <Cell
                                      key={snap.warehouse}
                                      fill={
                                        snap.status === 'conflicting'
                                          ? '#f97316'
                                          : snap.status === 'authoritative'
                                          ? '#0ea5e9'
                                          : '#525252'
                                      }
                                    />
                                  ))}
                                </Bar>
                                <Bar
                                  dataKey="reservedStock"
                                  name="Reserved Units"
                                  fill="#eab308"
                                  radius={[5, 5, 0, 0]}
                                  maxBarSize={48}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Regional Hub Breakdown Cards */}
                        <div className="lg:col-span-2 flex flex-col gap-2.5">
                          {activeRegionalConflict.hubSnapshots.map((snap) => (
                            <div
                              key={snap.warehouse}
                              className={`p-3.5 rounded-xl border transition-all ${
                                snap.status === 'conflicting'
                                  ? 'bg-orange-950/35 border-orange-500/60'
                                  : snap.status === 'authoritative'
                                  ? 'bg-sky-950/25 border-sky-500/45'
                                  : 'bg-neutral-900/60 border-neutral-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-xs font-bold text-white truncate">
                                  {snap.warehouse}
                                </span>
                                <span
                                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold shrink-0 ${
                                    snap.status === 'conflicting'
                                      ? 'bg-orange-500/25 text-orange-200 border border-orange-500/50'
                                      : snap.status === 'authoritative'
                                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                                  }`}
                                >
                                  {snap.status}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] font-mono">
                                <span className="text-neutral-300">
                                  Stock:{' '}
                                  <strong
                                    className={
                                      snap.status === 'conflicting'
                                        ? 'text-orange-300'
                                        : 'text-white'
                                    }
                                  >
                                    {snap.reportedStock} units
                                  </strong>
                                </span>
                                <span className="text-amber-400">
                                  Reserved: {snap.reservedStock}
                                </span>
                                <span className="text-neutral-500 text-[10px]">
                                  {snap.lastSyncedAt}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Heatmap View */}
          {viewMode === 'heatmap' && (
            <div className="w-full min-h-[260px] flex flex-col space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {warehouseDensity.data.map((wh) => {
                  const intensity = warehouseDensity.maxRate > 0 ? (wh.turnoverRate / warehouseDensity.maxRate) : 0;
                  const whNorm = wh.name.split('(')[0].trim().toLowerCase();
                  const whDisc = discrepancyHeatmap.warehouseByNorm[whNorm];
                  const discStyles = whDisc ? getTierStyles(whDisc.riskTier) : null;
                  const whProb = lowStockProbHeatmap.warehouseByNorm[whNorm];
                  const probStyles = whProb ? getProbTierStyles(whProb.riskTier) : null;

                  let bgClass = "bg-neutral-900/60 border-neutral-800";
                  let textClass = "text-neutral-400";
                  let heatLabel = "Low Velocity";
                  let indicatorClass = "bg-neutral-500";

                  if (intensity > 0.75) {
                    bgClass = "bg-rose-950/40 border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.15)]";
                    textClass = "text-rose-400";
                    heatLabel = "High Demand";
                    indicatorClass = "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]";
                  } else if (intensity > 0.4) {
                    bgClass = "bg-amber-950/40 border-amber-500/50";
                    textClass = "text-amber-400";
                    heatLabel = "Steady Turnover";
                    indicatorClass = "bg-amber-500";
                  } else if (intensity > 0.15) {
                    bgClass = "bg-emerald-950/20 border-emerald-500/40";
                    textClass = "text-emerald-400";
                    heatLabel = "Moderate Activity";
                    indicatorClass = "bg-emerald-500";
                  }

                  return (
                    <div key={wh.name} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${bgClass}`}>
                      {/* Discrepancy Thermal Gradient Wash Overlay */}
                      {showDiscrepancyOverlay && whDisc && whDisc.discrepancyCount > 0 && discStyles && (
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${discStyles.wash} pointer-events-none`}
                        />
                      )}
                      {/* Low-Stock Probability Thermal Wash Overlay (when Discrepancy Overlay is off) */}
                      {!showDiscrepancyOverlay && showLowStockProbLayer && whProb && probStyles && (
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${probStyles.wash} pointer-events-none`}
                        />
                      )}
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <TrendingUp className="w-16 h-16" />
                      </div>
                      <div>
                        <div className="flex items-start justify-between mb-3 relative z-10 gap-2">
                          <h4 className="text-sm font-bold text-white leading-tight">{wh.name}</h4>
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-neutral-950/60 border border-neutral-800 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${indicatorClass}`} />
                            <span className={textClass}>{heatLabel}</span>
                          </span>
                        </div>

                        {showLowStockProbLayer && whProb && probStyles && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedProbWarehouseName((prev) =>
                                prev === whProb.warehouseName ? null : whProb.warehouseName
                              )
                            }
                            className="w-full text-left mb-3 relative z-10 px-2.5 py-2 rounded-xl bg-neutral-950/85 hover:bg-neutral-900 border border-fuchsia-500/35 transition-all cursor-pointer space-y-1.5"
                            title="Inspect zero-stock probability drivers and at-risk SKUs for this warehouse"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-neutral-200">
                                <Gauge className={`w-3 h-3 ${whProb.riskTier === 'imminent' ? 'text-fuchsia-400' : whProb.riskTier === 'high' ? 'text-rose-400' : whProb.riskTier === 'moderate' ? 'text-amber-400' : 'text-cyan-400'}`} />
                                <span>Zero-Stock Prob.</span>
                              </span>
                              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${probStyles.badge}`}>
                                {whProb.zeroStockProbability}% · {probStyles.label}
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${probStyles.bar}`}
                                style={{ width: `${whProb.zeroStockProbability}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400">
                              <span>Burn {whProb.dailyOrderBurnRate}/d vs +{whProb.replenishmentVelocity}/d</span>
                              <span className={whProb.estDaysToZero <= 2 ? 'text-fuchsia-300 font-bold' : 'text-neutral-300'}>
                                ~{whProb.estDaysToZero}d runway
                              </span>
                            </div>
                          </button>
                        )}

                        {showDiscrepancyOverlay && whDisc && discStyles && (
                          <div className="mb-3 relative z-10 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800/90">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold">
                              <Flame className={`w-3 h-3 ${whDisc.riskTier === 'critical' ? 'text-rose-400' : whDisc.riskTier === 'high' ? 'text-orange-400' : 'text-amber-400'}`} />
                              <span className="text-neutral-200">
                                {whDisc.discrepancyCount} Discrepanc{whDisc.discrepancyCount === 1 ? 'y' : 'ies'}
                              </span>
                            </span>
                            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${discStyles.badge}`}>
                              Heat {whDisc.heatScore}
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
                          <div className="bg-neutral-950/60 rounded-xl p-3 border border-neutral-800/50">
                            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Turnover Volume</span>
                            <span className={`text-lg font-bold font-mono ${textClass}`}>{wh.demandVolume.toLocaleString()}</span>
                          </div>
                          <div className="bg-neutral-950/60 rounded-xl p-3 border border-neutral-800/50">
                            <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">Available Stock</span>
                            <span className="text-lg font-bold font-mono text-white">{wh.totalStock.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Mini 4-Zone Problematic Hotspot Strip inside card */}
                        {showDiscrepancyOverlay && whDisc && (
                          <div className="grid grid-cols-4 gap-1.5 mt-3 relative z-10">
                            {whDisc.zones.map((z) => {
                              const zStyle = getTierStyles(z.riskTier);
                              return (
                                <button
                                  key={z.zoneId}
                                  type="button"
                                  onClick={() => setSelectedHeatZone(z)}
                                  className={`px-1.5 py-1 rounded-lg border text-center font-mono transition-all cursor-pointer ${zStyle.cell}`}
                                  title={`${z.zoneCode} ${z.zoneName}: ${z.discrepancyCount} discrepancies (${z.primaryIssue})`}
                                >
                                  <span className="block text-[9px] font-bold">{z.zoneCode}</span>
                                  <span className="block text-[8px] opacity-85">{z.discrepancyCount}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-neutral-800/50 text-[11px] text-neutral-400 flex items-center justify-between relative z-10">
                        <span>{wh.skus} SKUs Managed</span>
                        <span className="font-mono">${(wh.value / 1000).toFixed(1)}k Valuation</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recharts Bar Chart Container with Visual Discrepancy & Low-Stock Probability Heatmap Overlays */}
          <div className={`w-full h-64 sm:h-72 min-h-[260px] relative rounded-xl ${viewMode !== 'categories' ? 'hidden' : ''}`}>
            {/* Translucent Thermal Heatmap Column Overlay aligned with Category Bars */}
            {(showDiscrepancyOverlay || showLowStockProbLayer) && (
              <div
                id="chart-bar-discrepancy-thermal-overlay"
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[52px] right-[16px] top-[6px] bottom-[54px] grid grid-cols-5 gap-2 z-10"
              >
                {categoryStats.map((cat) => {
                  const catHeat = discrepancyHeatmap.byCategory[cat.categoryId];
                  const hasDisc = showDiscrepancyOverlay && catHeat && catHeat.discrepancyCount > 0;
                  const discStyle = catHeat ? getTierStyles(catHeat.riskTier) : null;

                  const catProb = lowStockProbHeatmap.byCategory[cat.categoryId];
                  const hasProb = showLowStockProbLayer && catProb && catProb.zeroStockProbability >= 25;
                  const probStyle = catProb ? getProbTierStyles(catProb.riskTier) : null;

                  const columnWash =
                    hasProb && probStyle && (!hasDisc || catProb.zeroStockProbability >= 60)
                      ? `bg-gradient-to-b ${probStyle.wash}`
                      : hasDisc && discStyle
                      ? `bg-gradient-to-b ${discStyle.wash}`
                      : 'border-transparent bg-transparent';

                  return (
                    <div
                      key={`overlay-${cat.categoryId}`}
                      className={`rounded-xl border transition-all flex flex-col items-center justify-start gap-1 pt-1 px-1 ${columnWash}`}
                    >
                      {showLowStockProbLayer && catProb && probStyle && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-bold backdrop-blur-xs shadow-sm ${probStyle.badge}`}
                        >
                          <Gauge className="w-2.5 h-2.5 shrink-0" />
                          <span>P(0) {catProb.zeroStockProbability}%</span>
                        </span>
                      )}
                      {hasDisc && discStyle && (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[9px] font-mono font-bold backdrop-blur-xs shadow-sm ${discStyle.badge}`}
                        >
                          <Flame className="w-2.5 h-2.5 shrink-0" />
                          <span>{catHeat.discrepancyCount}</span>
                          {catHeat.hottestWarehouse && (
                            <span className="hidden xl:inline opacity-85 truncate max-w-[72px]">
                              · {catHeat.hottestWarehouse}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryStats}
                margin={{
                  top:
                    showDiscrepancyOverlay && showLowStockProbLayer
                      ? 46
                      : showDiscrepancyOverlay || showLowStockProbLayer
                      ? 30
                      : 12,
                  right: 16,
                  left: -4,
                  bottom: 24
                }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const clickedCat = e.activePayload[0].payload.categoryId;
                    setSelectedCategory(selectedCategory === clickedCat ? 'all' : clickedCat);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="categoryLabel"
                  stroke="#525252"
                  tick={{ fill: '#a3a3a3', fontSize: 11 }}
                  tickLine={{ stroke: '#404040' }}
                  axisLine={{ stroke: '#404040' }}
                  dy={6}
                />
                <YAxis
                  stroke="#525252"
                  tick={{ fill: '#a3a3a3', fontSize: 11 }}
                  tickLine={{ stroke: '#404040' }}
                  axisLine={{ stroke: '#404040' }}
                  tickFormatter={(val) =>
                    metricMode === 'valuation' ? `$${(val / 1000).toFixed(0)}k` : `${val}`
                  }
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend
                  wrapperStyle={{ paddingTop: 10, fontSize: 12 }}
                  formatter={(value) => <span className="text-neutral-300">{value}</span>}
                />

                {metricMode === 'units' ? (
                  <>
                    <Bar
                      dataKey="availableStock"
                      name="Available Stock"
                      fill="#0ea5e9"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                    >
                      {categoryStats.map((entry) => (
                        <Cell
                          key={`cell-avail-${entry.categoryId}`}
                          fill={
                            selectedCategory !== 'all' && selectedCategory !== entry.categoryId
                              ? '#383838'
                              : entry.color
                          }
                          fillOpacity={
                            selectedCategory !== 'all' && selectedCategory !== entry.categoryId
                              ? 0.35
                              : 1
                          }
                        />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="reservedStock"
                      name="Reserved Units"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={48}
                      cursor="pointer"
                    >
                      {categoryStats.map((entry) => (
                        <Cell
                          key={`cell-res-${entry.categoryId}`}
                          fill="#f59e0b"
                          fillOpacity={
                            selectedCategory !== 'all' && selectedCategory !== entry.categoryId
                              ? 0.25
                              : 0.85
                          }
                        />
                      ))}
                    </Bar>
                  </>
                ) : (
                  <Bar
                    dataKey="inventoryValue"
                    name="Valuation (USD)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={56}
                    cursor="pointer"
                  >
                    {categoryStats.map((entry) => (
                      <Cell
                        key={`cell-val-${entry.categoryId}`}
                        fill={
                          selectedCategory !== 'all' && selectedCategory !== entry.categoryId
                            ? '#383838'
                            : '#10b981'
                        }
                        fillOpacity={
                          selectedCategory !== 'all' && selectedCategory !== entry.categoryId
                            ? 0.35
                            : 1
                        }
                      />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Regional Low-Stock Probability Heatmap Layer */}
          {showLowStockProbLayer && (viewMode === 'categories' || viewMode === 'heatmap') && (
            <div
              id="warehouse-low-stock-probability-heatmap"
              className="p-4 rounded-2xl bg-neutral-950/85 border border-fuchsia-500/35 space-y-3 shadow-inner"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-neutral-800/80">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="p-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-400">
                    <Gauge className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-2 flex-wrap">
                      <span>Regional Low-Stock Probability Heatmap</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40">
                        Peak {lowStockProbHeatmap.peakProbability}% P(Zero-Stock) · {lowStockProbHeatmap.highRiskWarehouseCount} High-Risk Hub{lowStockProbHeatmap.highRiskWarehouseCount === 1 ? '' : 's'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-900 text-neutral-300 border border-neutral-800">
                        Net Velocity: {lowStockProbHeatmap.networkDailyBurn}/d burn vs +{lowStockProbHeatmap.networkReplenishmentVelocity}/d replenish
                      </span>
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Forecasts each regional warehouse&apos;s probability of hitting zero-stock across 24h, 72h, and 7-day horizons based on live order volume and replenishment velocity. Click any hub to inspect &amp; restock.
                    </p>
                  </div>
                </div>

                {/* Probability Thermal Scale Legend */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500/40 border border-cyan-500/50" />
                    &lt;25% Low
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/40 border border-amber-500/60" />
                    25-49% Mod
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/50 border border-rose-500/70" />
                    50-74% High
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-fuchsia-500/65 border border-fuchsia-400" />
                    &ge;75% Imminent
                  </span>
                </div>
              </div>

              {/* Regional Warehouse Zero-Stock Probability Matrix */}
              <div className="overflow-x-auto">
                <div className="min-w-[660px] space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 px-1.5">
                    <div className="col-span-3">Regional Warehouse</div>
                    <div className="col-span-3">Order Burn vs. Replenish</div>
                    <div className="col-span-1 text-center">24h P(0)</div>
                    <div className="col-span-1 text-center">72h P(0)</div>
                    <div className="col-span-1 text-center">7d P(0)</div>
                    <div className="col-span-3 text-right pr-1">Zero-Stock Risk Score</div>
                  </div>

                  {lowStockProbHeatmap.warehouses.map((wh) => {
                    const whStyle = getProbTierStyles(wh.riskTier);
                    const p24Style = getProbTierStyles(
                      wh.prob24h >= 75 ? 'imminent' : wh.prob24h >= 50 ? 'high' : wh.prob24h >= 25 ? 'moderate' : 'low'
                    );
                    const p72Style = getProbTierStyles(
                      wh.prob72h >= 75 ? 'imminent' : wh.prob72h >= 50 ? 'high' : wh.prob72h >= 25 ? 'moderate' : 'low'
                    );
                    const p7dStyle = getProbTierStyles(
                      wh.prob7d >= 75 ? 'imminent' : wh.prob7d >= 50 ? 'high' : wh.prob7d >= 25 ? 'moderate' : 'low'
                    );
                    const isSelected = selectedProbWarehouseName === wh.warehouseName;
                    const isDraining = wh.netVelocityDelta < 0;

                    return (
                      <div
                        key={`prob-row-${wh.warehouseName}`}
                        role="button"
                        tabIndex={0}
                        id={`low-stock-prob-row-${wh.warehouseName.replace(/[^a-z0-9]/gi, '-')}`}
                        onClick={() =>
                          setSelectedProbWarehouseName((prev) =>
                            prev === wh.warehouseName ? null : wh.warehouseName
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedProbWarehouseName((prev) =>
                              prev === wh.warehouseName ? null : wh.warehouseName
                            );
                          }
                        }}
                        className={`grid grid-cols-12 gap-2 items-center p-2 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-fuchsia-950/35 border-fuchsia-400/75 ring-1 ring-fuchsia-500/40'
                            : 'bg-neutral-900/65 hover:bg-neutral-900 border-neutral-800/85 hover:border-fuchsia-500/40'
                        }`}
                      >
                        {/* Warehouse Name & Stock */}
                        <div className="col-span-3 min-w-0 pr-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${whStyle.dot}`} />
                            <span className="text-xs font-semibold text-white truncate" title={wh.warehouseName}>
                              {wh.shortName}
                            </span>
                            <span className="text-[9px] font-mono text-neutral-500 shrink-0">
                              {wh.hubCode}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-neutral-400">
                            <span>{wh.availableStock} avail</span>
                            <span>·</span>
                            <span>{wh.orderVolumeUnits} ord vol</span>
                            {wh.atRiskSkuCount > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-rose-300">{wh.atRiskSkuCount} at risk</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Order Burn vs Replenishment Velocity */}
                        <div className="col-span-3 min-w-0 font-mono text-[10px] space-y-0.5">
                          <div className="flex items-center gap-1.5 text-neutral-200">
                            <Activity className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>-{wh.dailyOrderBurnRate}/d</span>
                            <span className="text-neutral-600">vs</span>
                            <span className="text-emerald-400">+{wh.replenishmentVelocity}/d</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            <span
                              className={`px-1.5 py-0.2 rounded border ${
                                isDraining
                                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                              }`}
                            >
                              {isDraining ? `${wh.netVelocityDelta}/d net drain` : `+${wh.netVelocityDelta}/d net gain`}
                            </span>
                            <span className="text-neutral-500">
                              {wh.replenishmentLeadTimeDays}d lead
                            </span>
                          </div>
                        </div>

                        {/* 24h Thermal Probability Cell */}
                        <div
                          className={`col-span-1 py-1.5 px-1 rounded-lg border text-center font-mono ${p24Style.cell}`}
                          title={`${wh.shortName}: ${wh.prob24h}% chance of hitting zero-stock within 24 hours`}
                        >
                          <div className="text-[11px] font-bold leading-none">{wh.prob24h}%</div>
                        </div>

                        {/* 72h Thermal Probability Cell */}
                        <div
                          className={`col-span-1 py-1.5 px-1 rounded-lg border text-center font-mono ${p72Style.cell}`}
                          title={`${wh.shortName}: ${wh.prob72h}% chance of hitting zero-stock within 72 hours`}
                        >
                          <div className="text-[11px] font-bold leading-none">{wh.prob72h}%</div>
                        </div>

                        {/* 7-Day Thermal Probability Cell */}
                        <div
                          className={`col-span-1 py-1.5 px-1 rounded-lg border text-center font-mono ${p7dStyle.cell}`}
                          title={`${wh.shortName}: ${wh.prob7d}% chance of hitting zero-stock within 7 days`}
                        >
                          <div className="text-[11px] font-bold leading-none">{wh.prob7d}%</div>
                        </div>

                        {/* Overall Zero-Stock Risk Meter */}
                        <div className="col-span-3 pl-1 space-y-1">
                          <div className="flex items-center justify-between gap-1.5 font-mono text-[10px]">
                            <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${whStyle.badge}`}>
                              {whStyle.label}
                            </span>
                            <span className="text-white font-bold">
                              {wh.zeroStockProbability}%
                            </span>
                            <span className="text-neutral-400 text-[9px] inline-flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {wh.estDaysToZero}d
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${whStyle.bar}`}
                              style={{ width: `${wh.zeroStockProbability}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Regional Warehouse Stockout Inspector */}
              {selectedProbWarehouse && (
                <div
                  id="warehouse-low-stock-prob-inspector"
                  className="p-3.5 rounded-xl bg-neutral-900/95 border border-fuchsia-500/45 space-y-3 text-xs animate-in fade-in duration-150"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          getProbTierStyles(selectedProbWarehouse.riskTier).badge
                        }`}
                      >
                        {selectedProbWarehouse.zeroStockProbability}% Zero-Stock Prob.
                      </span>
                      <span className="font-bold text-white">
                        {selectedProbWarehouse.warehouseName}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        {selectedProbWarehouse.region} · Est. {selectedProbWarehouse.estDaysToZero}d runway · {selectedProbWarehouse.replenishmentLeadTimeDays}d restock lead
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedProbWarehouseName(null)}
                      className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      aria-label="Close low-stock probability inspector"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Top At-Risk SKUs in Selected Warehouse */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedProbWarehouse.skuRisks.slice(0, 4).map((skuItem) => {
                      const skuStyle = getProbTierStyles(skuItem.riskTier);
                      const matchedProd = products.find((p) => p.id === skuItem.productId);
                      const isRestocking = restockingSkuId === skuItem.productId;

                      return (
                        <div
                          key={skuItem.productId}
                          className="p-2.5 rounded-xl bg-neutral-950/90 border border-neutral-800 flex items-center justify-between gap-2.5"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-bold ${skuStyle.badge}`}>
                                {skuItem.zeroStockProbability}% P(0)
                              </span>
                              <span className="font-mono text-[10px] font-bold text-sky-300">
                                {skuItem.sku}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-white truncate" title={skuItem.name}>
                              {skuItem.name}
                            </div>
                            <div className="text-[10px] font-mono text-neutral-400">
                              Stock: <strong className="text-neutral-200">{skuItem.availableStock}</strong> · Burn: <strong className="text-rose-300">{skuItem.dailyOrderBurnRate}/d</strong> · Repl: <strong className="text-emerald-300">+{skuItem.replenishmentVelocity}/d</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              id={`prob-heatmap-restock-btn-${skuItem.sku}`}
                              disabled={isRestocking}
                              onClick={() =>
                                handleQuickRestockFromHeatmap(
                                  skuItem.productId,
                                  skuItem.sku,
                                  skuItem.recommendedRestockQty,
                                  selectedProbWarehouse.shortName
                                )
                              }
                              className="px-2 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-[10px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title={`Apply preventive restock of +${skuItem.recommendedRestockQty} units`}
                            >
                              {isRestocking ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PackagePlus className="w-3 h-3 stroke-[2.5]" />
                              )}
                              <span>+{skuItem.recommendedRestockQty}</span>
                            </button>
                            {matchedProd && (
                              <button
                                type="button"
                                onClick={() => openAdminForProduct(matchedProd)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 border border-neutral-700 transition-colors cursor-pointer"
                                title="Open SKU in Warehouse Admin"
                              >
                                <Sliders className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Warehouse Zone Discrepancy Heatmap Matrix */}
          {showDiscrepancyOverlay && (viewMode === 'categories' || viewMode === 'heatmap') && (
            <div
              id="warehouse-discrepancy-heatmap-overlay-grid"
              className="p-4 rounded-2xl bg-neutral-950/80 border border-rose-500/30 space-y-3 shadow-inner"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-800/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="p-1.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-400">
                    <Flame className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
                      <span>Warehouse Zone Discrepancy Heatmap</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40">
                        {discrepancyHeatmap.totalDiscrepancies} Logged Events · {discrepancyHeatmap.hotZoneCount} Hot Zones
                      </span>
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      Thermal intensity highlights warehouse zones with frequent cycle-count variances, QA holds, or regional sync drift. Click any cell to inspect.
                    </p>
                  </div>
                </div>

                {/* Thermal Intensity Legend */}
                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/40 border border-emerald-500/50" />
                    Healthy
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/40 border border-amber-500/60" />
                    Elevated
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-orange-500/50 border border-orange-500/75" />
                    High
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/60 border border-rose-400" />
                    Critical
                  </span>
                </div>
              </div>

              {/* Matrix Table: Rows = Warehouses, Cols = Operational Zones Z-A..Z-D */}
              <div className="overflow-x-auto">
                <div className="min-w-[540px] space-y-2">
                  <div className="grid grid-cols-6 gap-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500 px-1">
                    <div className="col-span-2">Warehouse Location</div>
                    <div className="text-center">Z-A · Inbound/QA</div>
                    <div className="text-center">Z-B · Bulk Rack</div>
                    <div className="text-center">Z-C · Pick Line</div>
                    <div className="text-center">Z-D · Staging</div>
                  </div>

                  {discrepancyHeatmap.warehouses.map((wh) => {
                    const whStyle = getTierStyles(wh.riskTier);
                    return (
                      <div
                        key={wh.warehouseName}
                        className="grid grid-cols-6 gap-2 items-center p-1.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80"
                      >
                        <div className="col-span-2 pr-2 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${whStyle.dot}`} />
                            <span className="text-xs font-semibold text-white truncate" title={wh.warehouseName}>
                              {wh.shortName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-neutral-400">
                            <span>{wh.discrepancyCount} events</span>
                            <span>·</span>
                            <span>±{wh.varianceUnits}u var</span>
                          </div>
                        </div>

                        {wh.zones.map((zone) => {
                          const zStyle = getTierStyles(zone.riskTier);
                          const isSelectedZone = selectedHeatZone?.zoneId === zone.zoneId;
                          return (
                            <button
                              key={zone.zoneId}
                              type="button"
                              id={`heatmap-zone-cell-${zone.zoneId.replace(/[^a-z0-9]/gi, '-')}`}
                              onClick={() =>
                                setSelectedHeatZone((prev) =>
                                  prev?.zoneId === zone.zoneId ? null : zone
                                )
                              }
                              className={`py-2 px-2 rounded-lg border text-center transition-all cursor-pointer font-mono ${zStyle.cell} ${
                                isSelectedZone ? 'ring-2 ring-white scale-[1.03]' : ''
                              }`}
                              title={`${wh.warehouseName} — ${zone.zoneCode} (${zone.zoneName}): ${zone.discrepancyCount} discrepancies, ±${zone.varianceUnits} unit variance`}
                            >
                              <div className="text-xs font-bold leading-none">
                                {zone.discrepancyCount > 0 ? zone.discrepancyCount : '0'}
                              </div>
                              <div className="text-[9px] opacity-80 mt-0.5">
                                {zone.discrepancyCount > 0 ? `±${zone.varianceUnits}u` : 'Clean'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Selected Zone Drill-Down Inspector */}
              {selectedHeatZone && (
                <div
                  id="warehouse-heatmap-zone-inspector"
                  className="p-3 rounded-xl bg-neutral-900/95 border border-neutral-700/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                          getTierStyles(selectedHeatZone.riskTier).badge
                        }`}
                      >
                        {selectedHeatZone.zoneCode} · {selectedHeatZone.zoneName}
                      </span>
                      <span className="font-semibold text-white">
                        {selectedHeatZone.warehouseName}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        Heat Score: {selectedHeatZone.heatScore}/100
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300">
                      <strong className="text-neutral-200">Primary Driver:</strong>{' '}
                      {selectedHeatZone.primaryIssue}
                      {selectedHeatZone.affectedSkus.length > 0 && (
                        <>
                          {' '}· <strong className="text-neutral-200">SKUs:</strong>{' '}
                          <span className="font-mono text-sky-300">
                            {selectedHeatZone.affectedSkus.join(', ')}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {allRegionalConflicts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const match = selectedHeatZone.affectedSkus.find((sku) =>
                            allRegionalConflicts.some((c) => c.sku === sku)
                          );
                          if (match) setChartDrilldownSku(match);
                          setViewMode('conflicts');
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/50 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <GitCompareArrows className="w-3 h-3" />
                        <span>Inspect Conflicts</span>
                      </button>
                    )}
                    <button
                      type="button"
                      id="zone-inspector-batch-reconcile-btn"
                      onClick={() =>
                        openBatchReconcileForSkus(
                          selectedHeatZone.affectedSkus.length > 0
                            ? selectedHeatZone.affectedSkus
                            : activeSelectedChartSkus
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <ClipboardCheck className="w-3 h-3 text-emerald-400" />
                      <span>Batch Reconcile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminActiveTab('batch');
                        setIsAdminOpen(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Audit in Admin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHeatZone(null)}
                      className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      aria-label="Close zone inspector"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Multi-SKU Discrepancy Selection Tray -> Batch Reconcile in Warehouse Admin */}
              {chartSkuDiscrepancies.length > 0 && (
                <div
                  id="chart-discrepancy-batch-select-tray"
                  className="pt-3 border-t border-neutral-800/80 flex flex-col gap-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                        Select Discrepancy SKUs for Batch Reconcile:
                      </span>
                      <button
                        type="button"
                        id="chart-discrepancy-select-all-btn"
                        onClick={() => {
                          if (activeSelectedChartSkus.length === chartSkuDiscrepancies.length) {
                            setSelectedDiscrepancySkus([]);
                          } else {
                            setSelectedDiscrepancySkus(
                              chartSkuDiscrepancies.map((d) => d.sku.trim().toUpperCase())
                            );
                          }
                        }}
                        className="text-[10px] font-mono text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        {activeSelectedChartSkus.length === chartSkuDiscrepancies.length
                          ? 'Deselect All'
                          : `Select All (${chartSkuDiscrepancies.length})`}
                      </button>
                    </div>

                    <button
                      type="button"
                      id="chart-launch-batch-reconcile-btn"
                      onClick={() =>
                        openBatchReconcileForSkus(
                          activeSelectedChartSkus.length > 0
                            ? activeSelectedChartSkus
                            : chartSkuDiscrepancies.map((d) => d.sku)
                        )
                      }
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer border ${
                        activeSelectedChartSkus.length > 0
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 border-emerald-400 shadow-xs'
                          : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border-orange-500/50'
                      }`}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {activeSelectedChartSkus.length > 0
                          ? `Batch Reconcile (${activeSelectedChartSkus.length} Selected)`
                          : `Open Batch Reconcile (${chartSkuDiscrepancies.length})`}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {chartSkuDiscrepancies.map((item) => {
                      const isChecked = activeSelectedChartSkus.includes(
                        item.sku.trim().toUpperCase()
                      );
                      return (
                        <button
                          key={`select-chip-${item.sku}`}
                          type="button"
                          id={`chart-select-discrepancy-sku-${item.sku}`}
                          onClick={() => toggleDiscrepancySkuSelection(item.sku)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/70 font-bold ring-1 ring-emerald-500/30'
                              : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-rose-500/40'
                          }`}
                          title={`${item.sku} (${item.productName}) — ${item.summaryReason}`}
                        >
                          {isChecked ? (
                            <CheckSquare className="w-3 h-3 text-emerald-400 shrink-0" />
                          ) : (
                            <Square className="w-3 h-3 text-neutral-500 shrink-0" />
                          )}
                          <span>{item.sku}</span>
                          <span className="text-[9px] opacity-75">±{item.varianceUnits}u</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Category Breakdown Cards / Legend */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-neutral-800/80 ${viewMode !== 'categories' ? 'hidden' : ''}`}>
            {categoryStats.map((cat) => {
              const isSelected = selectedCategory === cat.categoryId;
              return (
                <button
                  key={cat.categoryId}
                  id={`cat-card-filter-${cat.categoryId}`}
                  onClick={() => setSelectedCategory(isSelected ? 'all' : cat.categoryId)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-neutral-800 border-sky-400 ring-1 ring-sky-500/40 shadow-sm'
                      : 'bg-neutral-900/60 hover:bg-neutral-800/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                  title={`Click to filter catalog by ${cat.categoryLabel}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-neutral-200 truncate">
                      {cat.categoryLabel}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>

                  <div className="flex items-baseline justify-between mt-auto">
                    <div>
                      <span className="text-base font-bold font-mono text-white">
                        {cat.availableStock}
                      </span>
                      <span className="text-[10px] text-neutral-400 ml-1">units</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500">
                      ${Math.round(cat.inventoryValue / 1000)}k
                    </span>
                  </div>

                  {cat.reservedStock > 0 && (
                    <div className="text-[10px] text-amber-400 font-mono mt-1 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {cat.reservedStock} reserved
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* AI-Driven Predictive Category Depletion Insights Section */}
          <div className="pt-2 border-t border-neutral-800/80">
            <CategoryDepletionAiSection
              products={products}
              orders={orders}
              selectedCategory={selectedCategory}
              onSelectCategory={(catId) => setSelectedCategory(catId)}
              onOpenAdminRestock={() => {
                setAdminActiveTab('batch');
                setIsAdminOpen(true);
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
};
