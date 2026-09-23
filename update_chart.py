import re

with open("src/components/WarehouseInventoryChart.tsx", "r") as f:
    content = f.read()

# 1. Add orders to useStore
content = content.replace(
    "const { products, selectedCategory, setSelectedCategory } = useStore();",
    "const { products, orders, selectedCategory, setSelectedCategory } = useStore();"
)

# 2. Add viewMode state
content = content.replace(
    "const [metricMode, setMetricMode] = useState<'units' | 'valuation'>('units');",
    "const [metricMode, setMetricMode] = useState<'units' | 'valuation'>('units');\n  const [viewMode, setViewMode] = useState<'categories' | 'heatmap'>('categories');"
)

# 3. Add warehouseDensity calculation
warehouse_density = """
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
"""

# Insert warehouseDensity after metricMode state
content = content.replace(
    "// Compute category stock breakdown from authoritative store products",
    warehouse_density + "\n  // Compute category stock breakdown from authoritative store products"
)

# 4. Add View Mode Switcher UI
old_action_controls = """        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Units vs Valuation Mode Switcher */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">"""

new_action_controls = """        {/* Action Controls */}
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
          </div>

          {/* Units vs Valuation Mode Switcher */}
          <div className={`flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs ${viewMode === 'heatmap' ? 'hidden' : ''}`}>"""

content = content.replace(old_action_controls, new_action_controls)

# 5. Conditional render of BarChart vs Heatmap
old_chart_container = """          {/* Recharts Bar Chart Container */}
          <div className="w-full h-64 sm:h-72 min-h-[260px] relative">
            <ResponsiveContainer width="100%" height="100%">"""

new_chart_container = """          {/* Heatmap View */}
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
                    <div key={`${wh.name}-${index}`} className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative overflow-hidden ${bgClass}`}>
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
          <div className={`w-full h-64 sm:h-72 min-h-[260px] relative ${viewMode === 'heatmap' ? 'hidden' : ''}`}>
            <ResponsiveContainer width="100%" height="100%">"""

content = content.replace(old_chart_container, new_chart_container)

# Hide the category breakdown legend when in heatmap mode
old_legend = """          {/* Interactive Category Breakdown Cards / Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-neutral-800/80">"""

new_legend = """          {/* Interactive Category Breakdown Cards / Legend */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-neutral-800/80 ${viewMode === 'heatmap' ? 'hidden' : ''}`}>"""
content = content.replace(old_legend, new_legend)

with open("src/components/WarehouseInventoryChart.tsx", "w") as f:
    f.write(content)
