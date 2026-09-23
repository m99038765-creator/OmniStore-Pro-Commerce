import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  Flame,
  Bot,
  RefreshCw,
  PackageCheck,
  Filter,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Gauge,
  ShoppingCart
} from 'lucide-react';
import { Product, Order, CategoryDepletionReport, CategoryDepletionInsight } from '../types';
import { calculateCategoryDepletionReport } from '../utils/aiSkuSuggestionEngine';

interface PredictiveInsightsWidgetProps {
  products: Product[];
  orders: Order[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onOpenBatchRestock?: (productIds: string[]) => void;
  onOpenAdminModal?: () => void;
}

export const PredictiveInsightsWidget: React.FC<PredictiveInsightsWidgetProps> = ({
  products,
  orders,
  selectedCategory,
  onSelectCategory,
  onOpenBatchRestock,
  onOpenAdminModal
}) => {
  const [report, setReport] = useState<CategoryDepletionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSynthesizing, setAiSynthesizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterMode, setFilterMode] = useState<'high-turnover' | 'all'>('high-turnover');
  const [appliedBatchSuccess, setAppliedBatchSuccess] = useState<string | null>(null);

  // Compute category depletion insights with live server-backed endpoint and local fallback
  const fetchDepletionReport = useCallback(async (withGemini = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/category-depletion${withGemini ? '?gemini=true' : ''}`);
      if (res.ok) {
        const data: CategoryDepletionReport = await res.json();
        setReport(data);
      } else {
        const local = calculateCategoryDepletionReport(products, orders, []);
        setReport(local);
      }
    } catch {
      const local = calculateCategoryDepletionReport(products, orders, []);
      setReport(local);
    } finally {
      setLoading(false);
    }
  }, [products, orders]);

  useEffect(() => {
    fetchDepletionReport(false);
  }, [fetchDepletionReport]);

  const handleSynthesizeGemini = async () => {
    setAiSynthesizing(true);
    await fetchDepletionReport(true);
    setAiSynthesizing(false);
  };

  // High turnover filter
  const displayedCategories = useMemo(() => {
    if (!report) return [];
    if (filterMode === 'high-turnover') {
      return report.categories.filter(
        c => c.turnoverSpeed === 'ultra-high' || c.turnoverSpeed === 'high' || c.runoutRiskLevel === 'critical' || c.runoutRiskLevel === 'high'
      );
    }
    return report.categories;
  }, [report, filterMode]);

  const handleTriggerCategoryReorder = (cat: CategoryDepletionInsight) => {
    const categorySkus = products.filter(p => p.category === cat.categoryId).map(p => p.id);
    if (onOpenBatchRestock && categorySkus.length > 0) {
      onOpenBatchRestock(categorySkus);
      setAppliedBatchSuccess(`Queued ${categorySkus.length} SKUs in "${cat.categoryLabel}" for +${cat.optimalReorderQuantity} unit replenishment`);
      setTimeout(() => setAppliedBatchSuccess(null), 3500);
    } else if (onOpenAdminModal) {
      onOpenAdminModal();
    }
  };

  if (!report) {
    return (
      <div className="mb-6 p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 animate-pulse flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
          <span>Computing warehouse category velocity turnover and optimal reorder models...</span>
        </div>
      </div>
    );
  }

  const highTurnoverCategories = report.categories.filter(
    c => c.turnoverSpeed === 'ultra-high' || c.turnoverSpeed === 'high'
  );

  return (
    <section
      id="predictive-insights-widget"
      className="mb-8 rounded-2xl bg-gradient-to-b from-neutral-900/90 via-neutral-950/95 to-neutral-950 border border-violet-500/30 overflow-hidden shadow-xl transition-all duration-300 relative"
    >
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-28 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 left-10 w-64 h-24 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Widget Header Bar */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-900/70 relative z-10">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300 shrink-0 shadow-inner">
            <Gauge className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Predictive Insights</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40 uppercase">
                  Velocity Turnover Engine
                </span>
              </h3>
              {highTurnoverCategories.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400 animate-pulse" />
                  <span>{highTurnoverCategories.length} High-Velocity Categories</span>
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Identifies high-turnover equipment sectors and calculates optimal replenishment purchase order sizes based on current sales patterns.
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {/* Gemini AI Synthesis Button */}
          <button
            id="predictive-widget-gemini-synth-btn"
            onClick={handleSynthesizeGemini}
            disabled={aiSynthesizing}
            className="px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Synthesize AI strategic executive restock briefing with Gemini"
          >
            <Bot className={`w-3.5 h-3.5 ${aiSynthesizing ? 'animate-spin text-sky-400' : 'text-violet-400'}`} />
            <span>{aiSynthesizing ? 'Synthesizing...' : 'Synthesize AI Directive'}</span>
          </button>

          {/* Quick Refresh */}
          <button
            id="predictive-widget-refresh-btn"
            onClick={() => fetchDepletionReport(false)}
            disabled={loading}
            className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Recalculate velocity metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Collapse Toggle */}
          <button
            id="predictive-widget-toggle-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand predictive insights' : 'Collapse predictive insights'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Applied Batch Success Toast */}
      {appliedBatchSuccess && (
        <div className="bg-emerald-950/80 border-b border-emerald-800/80 px-5 py-2.5 text-xs text-emerald-200 flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appliedBatchSuccess}</span>
          </div>
          <button
            onClick={() => onOpenAdminModal && onOpenAdminModal()}
            className="px-2.5 py-1 rounded bg-emerald-500 text-neutral-950 font-bold text-[11px] hover:bg-emerald-400 transition-colors"
          >
            Open Batch Adjuster
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4 relative z-10">
          {/* Executive Strategic Summary & KPI Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* AI Synthesis Narrative */}
            <div className="lg:col-span-3 p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 mt-0.5 shrink-0">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300 font-bold">
                    Executive Velocity & Optimal Replenishment Synthesis
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Highest Turnover: <strong className="text-violet-300">{report.highestTurnoverCategory}</strong>
                  </span>
                </div>
                <p className="text-xs text-neutral-200 mt-1 leading-relaxed">
                  {report.executiveAiSynthesis}
                </p>
              </div>
            </div>

            {/* Total Optimal Restock KPI Card */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Total Recommended Restock
              </span>
              <div className="my-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-white">
                    +{report.totalRecommendedOptimalReorderUnits}
                  </span>
                  <span className="text-xs text-neutral-400">units</span>
                </div>
                <span className="text-[11px] font-mono text-sky-400 font-semibold block">
                  ~${Math.round(report.totalEstimatedReorderCost / 1000)}k Estimated PO
                </span>
              </div>
              <span className="text-[10px] text-neutral-500">
                Guarantees 14-day supply buffer across all bays
              </span>
            </div>
          </div>

          {/* Filter Bar & Quick Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-neutral-400">Category Filter:</span>
              <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
                <button
                  id="predictive-filter-high-turnover-btn"
                  onClick={() => setFilterMode('high-turnover')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterMode === 'high-turnover'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Flame className="w-3 h-3 text-rose-400" />
                  <span>High Turnover Priority ({highTurnoverCategories.length})</span>
                </button>
                <button
                  id="predictive-filter-all-btn"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    filterMode === 'all'
                      ? 'bg-neutral-800 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <span>All Categories ({report.categories.length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono text-neutral-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Burn Velocity: <strong>{report.overallWarehouseDepletionVelocity}</strong> u/day</span>
              </span>
            </div>
          </div>

          {/* Category Cards Grid with Turnover Metrics & Optimal Reorders */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedCategories.map((cat) => {
              const isUltra = cat.turnoverSpeed === 'ultra-high';
              const isHigh = cat.turnoverSpeed === 'high';
              const isCritRunout = cat.runoutRiskLevel === 'critical';
              const isHighRunout = cat.runoutRiskLevel === 'high';
              const isFiltered = selectedCategory === cat.categoryId;

              let cardBorderClass = 'border-neutral-800 hover:border-neutral-700 bg-neutral-900/50';
              let badgeColorClass = 'bg-neutral-800 text-neutral-300 border-neutral-700';

              if (isUltra || isCritRunout) {
                cardBorderClass = 'border-rose-500/40 hover:border-rose-500/70 bg-rose-950/15 shadow-sm shadow-rose-950/20';
                badgeColorClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
              } else if (isHigh || isHighRunout) {
                cardBorderClass = 'border-amber-500/35 hover:border-amber-500/60 bg-amber-950/15';
                badgeColorClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              }

              return (
                <div
                  key={cat.categoryId}
                  id={`predictive-card-${cat.categoryId}`}
                  className={`p-4 rounded-xl border ${cardBorderClass} flex flex-col justify-between gap-3 transition-all relative ${
                    isFiltered ? 'ring-2 ring-sky-500/50' : ''
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white leading-tight">
                            {cat.categoryLabel}
                          </h4>
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {cat.skuCount} SKUs in Bay
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${badgeColorClass}`}>
                          {cat.turnoverSpeed === 'ultra-high'
                            ? 'ULTRA TURNOVER'
                            : cat.turnoverSpeed === 'high'
                            ? 'HIGH VELOCITY'
                            : `${cat.turnoverSpeed} SPEED`}
                        </span>
                        {cat.turnoverRatio > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                            {cat.turnoverRatio}x/yr
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Turnover & Sales Telemetry Box */}
                    <div className="grid grid-cols-3 gap-2 my-2.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-center font-mono">
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Daily Burn</span>
                        <span className="text-xs font-bold text-amber-300">
                          {cat.dailyBurnRate} <span className="text-[9px] text-neutral-500">u/d</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Stock On Hand</span>
                        <span className={`text-xs font-bold ${cat.availableStock <= 5 ? 'text-rose-400' : 'text-neutral-200'}`}>
                          {cat.availableStock} <span className="text-[9px] text-neutral-500">units</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Depletion In</span>
                        <span className={`text-xs font-bold ${isCritRunout ? 'text-rose-400 animate-pulse' : 'text-sky-300'}`}>
                          {cat.projectedDepletionHours <= 0
                            ? 'DEPLETED'
                            : cat.projectedDepletionHours < 48
                            ? `~${cat.projectedDepletionHours}h`
                            : `~${cat.projectedDepletionDays}d`}
                        </span>
                      </div>
                    </div>

                    {/* Optimal Reorder Suggestion Box */}
                    <div className="p-2.5 rounded-lg bg-violet-950/30 border border-violet-500/30 mb-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300 font-bold flex items-center gap-1">
                          <PackageCheck className="w-3 h-3 text-violet-400" />
                          <span>Optimal Reorder Qty:</span>
                        </span>
                        <span className="text-sm font-bold font-mono text-emerald-400">
                          +{cat.optimalReorderQuantity} units
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-1">
                        <span>Lead Time: ~{cat.suggestedPoLeadTimeDays}d buffer</span>
                        {cat.reorderCapitalNeeded > 0 && (
                          <span>Est. PO: ${cat.reorderCapitalNeeded.toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    {/* Lead Bottleneck SKU */}
                    {cat.topDepletingSku && (
                      <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-[11px] mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[9px] font-mono px-1 rounded bg-neutral-800 text-neutral-400 uppercase">
                            Fastest Drain:
                          </span>
                          <span className="font-mono font-bold text-white truncate">
                            {cat.topDepletingSku.sku}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-rose-400 font-semibold shrink-0">
                          {cat.topDepletingSku.hoursLeft <= 24 ? `<${cat.topDepletingSku.hoursLeft}h left` : `${cat.topDepletingSku.stock} units`}
                        </span>
                      </div>
                    )}

                    {/* AI Narrative */}
                    <p className="text-[11px] text-neutral-300 leading-relaxed italic line-clamp-2">
                      "{cat.aiPredictiveNarrative}"
                    </p>
                  </div>

                  {/* Card Bottom Controls */}
                  <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                    <button
                      id={`predictive-apply-reorder-btn-${cat.categoryId}`}
                      onClick={() => handleTriggerCategoryReorder(cat)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs active:scale-95 cursor-pointer"
                      title={`Queue optimal reorder of +${cat.optimalReorderQuantity} units for all ${cat.categoryLabel} items in Batch Adjuster`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>Reorder +{cat.optimalReorderQuantity}</span>
                    </button>

                    <button
                      id={`predictive-filter-view-btn-${cat.categoryId}`}
                      onClick={() => onSelectCategory(isFiltered ? 'all' : cat.categoryId)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                        isFiltered
                          ? 'bg-sky-500 text-white font-bold'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700'
                      }`}
                      title={`Filter catalog and chart to ${cat.categoryLabel}`}
                    >
                      <Filter className="w-3 h-3" />
                      <span>{isFiltered ? 'Filtered' : 'Filter View'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
