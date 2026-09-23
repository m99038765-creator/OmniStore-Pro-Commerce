import React, { useState, useMemo } from 'react';
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
  Flame
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { CategoryDepletionAiSection } from './CategoryDepletionAiSection';

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
  const { products, orders, selectedCategory, setSelectedCategory, setIsAdminOpen, setAdminActiveTab } = useStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [metricMode, setMetricMode] = useState<'units' | 'valuation'>('units');
  const [viewMode, setViewMode] = useState<'categories' | 'heatmap' | 'ai-insights'>('categories');
  const [showAiDepletionInsights, setShowAiDepletionInsights] = useState(true);

  
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
      return (
        <div className="bg-neutral-900/95 backdrop-blur-md border border-neutral-700/90 p-3.5 rounded-xl shadow-2xl shadow-black/80 text-xs min-w-[210px] space-y-2">
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
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Live stock levels, reserved allocations, and valuations across warehouse equipment categories
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
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
          {/* Heatmap View */}
          {viewMode === 'heatmap' && (
            <div className="w-full min-h-[260px] flex flex-col">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {warehouseDensity.data.map((wh, index) => {
                  const intensity = warehouseDensity.maxRate > 0 ? (wh.turnoverRate / warehouseDensity.maxRate) : 0;
                  
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
                      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                        <TrendingUp className="w-16 h-16" />
                      </div>
                      <div>
                        <div className="flex items-start justify-between mb-4 relative z-10">
                          <h4 className="text-sm font-bold text-white leading-tight pr-4">{wh.name}</h4>
                          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-neutral-950/50 border border-neutral-800 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${indicatorClass}`} />
                            <span className={textClass}>{heatLabel}</span>
                          </span>
                        </div>
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

          {/* Recharts Bar Chart Container */}
          <div className={`w-full h-64 sm:h-72 min-h-[260px] relative ${viewMode !== 'categories' ? 'hidden' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryStats}
                margin={{ top: 12, right: 16, left: -4, bottom: 24 }}
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
