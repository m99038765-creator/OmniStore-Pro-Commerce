import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Flame,
  Bot,
  RefreshCw,
  PackageCheck,
  ChevronRight,
  Filter,
  DollarSign,
  Activity,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { Product, Order, CategoryDepletionReport, CategoryDepletionInsight } from '../types';
import { calculateCategoryDepletionReport } from '../utils/aiSkuSuggestionEngine';

interface CategoryDepletionAiSectionProps {
  products: Product[];
  orders: Order[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  onOpenAdminRestock?: () => void;
}

export const CategoryDepletionAiSection: React.FC<CategoryDepletionAiSectionProps> = ({
  products,
  orders,
  selectedCategory,
  onSelectCategory,
  onOpenAdminRestock
}) => {
  const [report, setReport] = useState<CategoryDepletionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSynthesizing, setAiSynthesizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'at-risk'>('at-risk');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);

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

  const displayedCategories = useMemo(() => {
    if (!report) return [];
    if (activeTab === 'at-risk') {
      return report.categories.filter(c => c.runoutRiskLevel === 'critical' || c.runoutRiskLevel === 'high');
    }
    return report.categories;
  }, [report, activeTab]);

  if (!report) {
    return (
      <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/20 animate-pulse text-xs text-violet-300 flex items-center gap-2">
        <Sparkles className="w-4 h-4 animate-spin text-violet-400" />
        <span>Synthesizing real-time category sales velocities and depletion trajectories...</span>
      </div>
    );
  }

  const criticalCategories = report.categories.filter(c => c.runoutRiskLevel === 'critical');
  const highRiskCategories = report.categories.filter(c => c.runoutRiskLevel === 'high');

  return (
    <div
      id="category-depletion-ai-section"
      className="rounded-xl bg-gradient-to-b from-violet-950/25 via-neutral-950/60 to-neutral-950/90 border border-violet-500/30 p-4 sm:p-5 relative overflow-hidden"
    >
      {/* Background radial glow */}
      <div className="absolute top-0 right-10 w-72 h-24 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-500/20 pb-3 mb-4 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shrink-0 shadow-sm shadow-violet-500/20">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span>AI Predictive Category Depletion Insights</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-violet-500/25 text-violet-300 border border-violet-500/40">
                  VELOCITY RUNOUT MODEL
                </span>
              </h4>
              {report.categoriesAtRiskCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                  <Flame className="w-2.5 h-2.5 text-rose-400 animate-bounce" />
                  <span>{report.categoriesAtRiskCount} Categories Trending Toward Runout</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Forecasting equipment category stockout horizons based on live sales velocity and fulfillment drain.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Gemini Synthesis button */}
          <button
            id="category-ai-gemini-synth-btn"
            onClick={handleSynthesizeGemini}
            disabled={aiSynthesizing}
            className="px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Synthesize AI strategic executive summary using Gemini"
          >
            <Bot className={`w-3.5 h-3.5 ${aiSynthesizing ? 'animate-spin' : 'text-violet-400'}`} />
            <span className="text-[11px]">{aiSynthesizing ? 'Synthesizing...' : 'Synthesize AI Directive'}</span>
          </button>

          {/* Quick Refresh */}
          <button
            id="category-ai-refresh-btn"
            onClick={() => fetchDepletionReport(false)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Recalculate category burn velocity"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* AI Synthesis Directive Banner */}
      {report.executiveAiSynthesis && (
        <div
          id="category-ai-synthesis-card"
          className="mb-4 p-3 rounded-xl bg-violet-950/30 border border-violet-500/30 flex items-start gap-2.5 relative z-10"
        >
          <div className="p-1 rounded-md bg-violet-500/20 text-violet-300 mt-0.5 shrink-0">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-violet-300 font-bold">
                Strategic Velocity Directive
              </span>
              <span className="text-[9px] font-mono text-neutral-400">
                Overall Burn: {report.overallWarehouseDepletionVelocity} units/day
              </span>
            </div>
            <p className="text-xs text-neutral-200 mt-1 leading-relaxed">
              {report.executiveAiSynthesis}
            </p>
          </div>
        </div>
      )}

      {/* Risk Filter Toggle */}
      <div className="flex items-center justify-between gap-2 mb-3 relative z-10 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-neutral-400 mr-1 hidden sm:inline">Depletion Filter:</span>
          <button
            id="category-depletion-filter-at-risk-btn"
            onClick={() => setActiveTab('at-risk')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
              activeTab === 'at-risk'
                ? 'bg-rose-500/30 text-rose-200 font-bold border border-rose-500/60 shadow-xs'
                : 'bg-neutral-900/80 text-rose-300 hover:bg-rose-950/20 border border-neutral-800'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>Trending Toward Depletion ({report.categoriesAtRiskCount})</span>
          </button>

          <button
            id="category-depletion-filter-all-btn"
            onClick={() => setActiveTab('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                : 'bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            All Categories ({report.categories.length})
          </button>
        </div>

        {onOpenAdminRestock && (
          <button
            id="category-depletion-open-admin-btn"
            onClick={onOpenAdminRestock}
            className="text-[11px] font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
          >
            <span>Open Warehouse Restock Hub</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Category Depletion Predictive Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
        {displayedCategories.map((cat) => {
          const isCrit = cat.runoutRiskLevel === 'critical';
          const isHigh = cat.runoutRiskLevel === 'high';
          const isMod = cat.runoutRiskLevel === 'moderate';
          const isSelected = selectedCategory === cat.categoryId;

          const cardBorder = isCrit
            ? 'border-rose-500/40 bg-rose-950/10 hover:border-rose-500/70 shadow-sm shadow-rose-950/30'
            : isHigh
            ? 'border-amber-500/35 bg-amber-950/10 hover:border-amber-500/60'
            : 'border-neutral-800/80 bg-neutral-950/40 hover:border-neutral-700';

          const badgeBg = isCrit
            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
            : isHigh
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            : isMod
            ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

          return (
            <div
              key={cat.categoryId}
              id={`category-depletion-card-${cat.categoryId}`}
              className={`p-3.5 rounded-xl border ${cardBorder} flex flex-col justify-between gap-3 transition-all relative ${
                isSelected ? 'ring-2 ring-sky-500/50' : ''
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>{cat.categoryLabel}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ({cat.skuCount} SKUs)
                        </span>
                      </h5>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-bold border ${badgeBg}`}>
                      {cat.runoutRiskLevel === 'critical' ? 'CRITICAL RUNOUT' : `${cat.runoutRiskLevel} RISK`}
                    </span>
                    {cat.depletionVelocityTrend === 'accelerating' && (
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-0.5" title="Sales velocity accelerating">
                        <TrendingUp className="w-2.5 h-2.5" />
                        <span>ACCEL</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Velocity Telemetry Numbers */}
                <div className="grid grid-cols-3 gap-1.5 my-2.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-center font-mono">
                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Available</span>
                    <span className={`text-xs font-bold ${cat.availableStock <= 5 ? 'text-rose-400' : 'text-neutral-200'}`}>
                      {cat.availableStock}
                      <span className="text-[9px] text-neutral-500 font-normal"> units</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Daily Burn</span>
                    <span className="text-xs font-bold text-amber-300">
                      {cat.dailyBurnRate}/d
                    </span>
                  </div>

                  <div>
                    <span className="text-[9px] text-neutral-500 uppercase block">Depletion In</span>
                    <span className={`text-xs font-bold ${isCrit ? 'text-rose-400 animate-pulse' : 'text-sky-300'}`}>
                      {cat.projectedDepletionHours <= 0
                        ? 'DEPLETED'
                        : cat.projectedDepletionHours < 48
                        ? `~${cat.projectedDepletionHours}h`
                        : `~${cat.projectedDepletionDays}d`}
                    </span>
                  </div>
                </div>

                {/* Depletion Progress Gauge */}
                <div className="space-y-1 mb-2">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                    <span>Depletion Trajectory</span>
                    <span className={isCrit ? 'text-rose-400 font-bold' : 'text-neutral-300'}>
                      {cat.availableStock <= 0
                        ? '100% Depleted'
                        : isCrit
                        ? 'Imminent Stockout (<48h)'
                        : isHigh
                        ? 'High Velocity Runout'
                        : 'Sustained Runrate'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCrit
                          ? 'bg-rose-500'
                          : isHigh
                          ? 'bg-amber-500'
                          : isMod
                          ? 'bg-sky-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.min(100, Math.max(10, Math.round((cat.dailyBurnRate / Math.max(1, cat.availableStock + cat.dailyBurnRate)) * 100)))}%`
                      }}
                    />
                  </div>
                </div>

                {/* Top Depleting SKU Bottleneck Tag */}
                {cat.topDepletingSku && (
                  <div className="p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-[11px] mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[9px] font-mono px-1 rounded bg-neutral-800 text-neutral-400 uppercase">
                        Lead Bottleneck:
                      </span>
                      <span className="font-mono font-bold text-white truncate">
                        {cat.topDepletingSku.sku}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-rose-400 shrink-0 font-semibold">
                      {cat.topDepletingSku.hoursLeft <= 24 ? `<${cat.topDepletingSku.hoursLeft}h left` : `${cat.topDepletingSku.stock} units`}
                    </span>
                  </div>
                )}

                {/* Predictive AI Narrative */}
                <p className="text-[11px] text-neutral-300 leading-relaxed italic line-clamp-2">
                  "{cat.aiPredictiveNarrative}"
                </p>
              </div>

              {/* Bottom Card Controls */}
              <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[9px] font-mono text-neutral-500 uppercase block">Recommended PO</span>
                  <span className="font-bold text-white font-mono text-xs">
                    +{cat.recommendedPoUnits} units
                    {cat.reorderCapitalNeeded > 0 && (
                      <span className="text-[10px] font-mono text-neutral-400 font-normal ml-1">
                        (~${Math.round(cat.reorderCapitalNeeded / 1000)}k)
                      </span>
                    )}
                  </span>
                </div>

                <button
                  id={`category-filter-btn-${cat.categoryId}`}
                  onClick={() => onSelectCategory(isSelected ? 'all' : cat.categoryId)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-500 text-white shadow-xs'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700'
                  }`}
                  title={`Filter inventory view by ${cat.categoryLabel}`}
                >
                  <Filter className="w-3 h-3" />
                  <span>{isSelected ? 'Filtered' : 'Filter View'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
