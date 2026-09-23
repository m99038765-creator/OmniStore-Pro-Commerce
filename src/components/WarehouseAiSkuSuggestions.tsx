import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PackagePlus,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  ChevronRight,
  BarChart3,
  Flame,
  Check,
  Filter,
  DollarSign,
  Activity,
  Sliders,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { Product, SkuAiSuggestion, AiSuggestionEngineResponse } from '../types';
import { calculateSkuAiSuggestions } from '../utils/aiSkuSuggestionEngine';

interface WarehouseAiSkuSuggestionsProps {
  products: Product[];
  onOpenStockAdjust?: (product: Product) => void;
  onOpenSkuDetails?: (product: Product) => void;
  onQuickRestockSuccess?: (message: string) => void;
  onBatchSelectSkus?: (productIds: string[]) => void;
}

export const WarehouseAiSkuSuggestions: React.FC<WarehouseAiSkuSuggestionsProps> = ({
  products,
  onOpenStockAdjust,
  onOpenSkuDetails,
  onQuickRestockSuccess,
  onBatchSelectSkus
}) => {
  const [suggestionData, setSuggestionData] = useState<AiSuggestionEngineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'high' | 'moderate'>('all');
  const [restockingSku, setRestockingSku] = useState<string | null>(null);
  const [batchRestocking, setBatchRestocking] = useState(false);
  const [appliedRestocks, setAppliedRestocks] = useState<Record<string, number>>({});
  const [briefing, setBriefing] = useState<string | null>(null);
  const [isSynthesizingAi, setIsSynthesizingAi] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Compute suggestions via predictive engine (server with local fallback)
  const fetchSuggestions = useCallback(async (withGemini = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/inventory/ai-suggestions${withGemini ? '?gemini=true' : ''}`);
      if (response.ok) {
        const data: AiSuggestionEngineResponse = await response.json();
        setSuggestionData(data);
        if (data.executiveBriefing) {
          setBriefing(data.executiveBriefing);
        }
      } else {
        // Local calculation fallback
        const fallback = calculateSkuAiSuggestions(products, []);
        setSuggestionData(fallback);
        if (fallback.executiveBriefing) setBriefing(fallback.executiveBriefing);
      }
    } catch {
      // Local calculation fallback
      const fallback = calculateSkuAiSuggestions(products, []);
      setSuggestionData(fallback);
      if (fallback.executiveBriefing) setBriefing(fallback.executiveBriefing);
    } finally {
      setLoading(false);
    }
  }, [products]);

  // Initial load and sync on products update
  useEffect(() => {
    fetchSuggestions(false);
  }, [fetchSuggestions]);

  // Synthesize AI Strategic Executive Briefing with Gemini
  const handleGenerateGeminiBriefing = async () => {
    setIsSynthesizingAi(true);
    try {
      const res = await fetch('/api/inventory/ai-suggestions/generate-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.briefing) {
          setBriefing(data.briefing);
        }
      }
    } catch (err) {
      console.warn('Briefing generation error:', err);
    } finally {
      setIsSynthesizingAi(false);
    }
  };

  // One-click quick restock based on AI recommended quantity
  const handleApplyRestock = async (item: SkuAiSuggestion) => {
    setRestockingSku(item.sku);
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: item.productId,
          quantity: item.recommendedRestockQty
        })
      });

      if (res.ok) {
        setAppliedRestocks(prev => ({
          ...prev,
          [item.sku]: (prev[item.sku] || 0) + item.recommendedRestockQty
        }));
        onQuickRestockSuccess?.(
          `AI Reorder Applied: Restocked +${item.recommendedRestockQty} units of ${item.sku} (${item.name})!`
        );
        // Refresh calculations
        await fetchSuggestions(false);
      }
    } catch (err) {
      console.error('Failed to restock item:', err);
    } finally {
      setRestockingSku(null);
    }
  };

  // Restock all urgent (Critical + High) in one click
  const handleRestockAllUrgent = async () => {
    if (!suggestionData) return;
    const urgentItems = suggestionData.suggestions.filter(
      s => s.urgency === 'critical' || s.urgency === 'high'
    );
    if (urgentItems.length === 0) return;

    setBatchRestocking(true);
    let count = 0;
    for (const item of urgentItems) {
      try {
        await fetch('/api/inventory/restock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: item.productId,
            quantity: item.recommendedRestockQty
          })
        });
        count++;
        setAppliedRestocks(prev => ({
          ...prev,
          [item.sku]: (prev[item.sku] || 0) + item.recommendedRestockQty
        }));
      } catch (err) {
        console.error('Batch item error:', err);
      }
    }
    setBatchRestocking(false);
    onQuickRestockSuccess?.(
      `AI Auto-Replenishment complete! Reordered stock across ${count} urgent SKUs.`
    );
    await fetchSuggestions(false);
  };

  // Filter items
  const filteredSuggestions = useMemo(() => {
    if (!suggestionData) return [];
    if (activeFilter === 'all') return suggestionData.suggestions;
    return suggestionData.suggestions.filter(s => s.urgency === activeFilter);
  }, [suggestionData, activeFilter]);

  const criticalCount = suggestionData?.suggestions.filter(s => s.urgency === 'critical').length || 0;
  const highCount = suggestionData?.suggestions.filter(s => s.urgency === 'high').length || 0;
  const urgentCount = criticalCount + highCount;

  if (!suggestionData) {
    return (
      <div className="mb-5 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 animate-pulse flex items-center justify-center gap-2 text-neutral-400 text-xs">
        <Sparkles className="w-4 h-4 text-violet-400 animate-spin" />
        <span>Initializing OmniStore Predictive SKU Suggestion Engine...</span>
      </div>
    );
  }

  return (
    <div
      id="ai-sku-suggestions-container"
      className="mb-6 rounded-2xl bg-gradient-to-b from-neutral-900/90 via-neutral-900/60 to-neutral-950/80 border border-violet-500/30 shadow-xl shadow-violet-950/20 relative overflow-hidden"
    >
      {/* Subtle background ambient glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-10 w-80 h-24 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Banner & Control Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-400 shadow-md shadow-violet-500/20 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>AI-Powered SKU Suggestion Engine</span>
                <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/40">
                  PREDICTIVE REORDER v2.4
                </span>
              </h3>
              {urgentCount > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400 animate-bounce" />
                  <span>{urgentCount} Urgent Restocks</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Machine-driven restock recommendations synthesized from real-time depletion rates, sales velocity, and fulfillment burn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Executive Briefing Synthesizer */}
          <button
            id="ai-sku-gemini-briefing-btn"
            onClick={handleGenerateGeminiBriefing}
            disabled={isSynthesizingAi}
            className="px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Generate AI executive strategic inventory directive using Gemini"
          >
            <Bot className={`w-3.5 h-3.5 ${isSynthesizingAi ? 'animate-spin' : 'text-violet-400'}`} />
            <span>{isSynthesizingAi ? 'Synthesizing AI Brief...' : 'AI Strategic Directive'}</span>
          </button>

          {/* Quick Refresh */}
          <button
            id="ai-sku-refresh-btn"
            onClick={() => fetchSuggestions(false)}
            disabled={loading}
            className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
            title="Recalculate live stockout predictions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            id="ai-sku-toggle-expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-300 font-mono transition-colors cursor-pointer"
          >
            {isExpanded ? 'Minimize' : 'View Insights'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 relative z-10">
          {/* Executive Strategic Summary Card */}
          {briefing && (
            <div
              id="ai-sku-executive-briefing-box"
              className="p-3.5 sm:p-4 rounded-xl bg-violet-950/30 border border-violet-500/30 flex items-start gap-3 relative"
            >
              <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/40 flex items-center justify-center text-violet-300 shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-violet-300 font-bold flex items-center gap-1.5">
                    Executive Supply Chain Directive
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-violet-500/30 text-violet-200">
                      LIVE REAL-TIME
                    </span>
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Confidence: {(suggestionData.suggestions[0]?.confidenceScore * 100 || 94).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-neutral-200 mt-1 leading-relaxed">
                  {briefing}
                </p>
              </div>
            </div>
          )}

          {/* Predictive Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">Analyzed SKUs</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-white font-mono">{suggestionData.totalSkusAnalyzed}</span>
                <span className="text-[11px] text-neutral-500">units</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-rose-500/30 bg-rose-950/10">
              <span className="text-[10px] font-mono uppercase text-rose-300 block">Critical Runouts</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-rose-400 font-mono">{urgentCount}</span>
                <span className="text-[11px] text-rose-300/80">&lt; 72h burn</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">Avg Burn Velocity</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-amber-300 font-mono">
                  {suggestionData.averageDailyDepletionAll}
                </span>
                <span className="text-[11px] text-neutral-500">units/day</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">Recommended Capital</span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  ${suggestionData.totalCapitalRecommended.toLocaleString()}
                </span>
                <span className="text-[11px] text-neutral-500">14d buffer</span>
              </div>
            </div>
          </div>

          {/* Filter Chips & Batch Action Trigger */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <span className="text-[11px] font-mono text-neutral-400 mr-1 hidden sm:inline">Filter Risk:</span>
              <button
                id="ai-sku-filter-all-btn"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-neutral-800 text-white font-bold border border-neutral-700'
                    : 'bg-neutral-900/80 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                }`}
              >
                All Recommendations ({suggestionData.suggestions.length})
              </button>

              <button
                id="ai-sku-filter-critical-btn"
                onClick={() => setActiveFilter('critical')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'critical'
                    ? 'bg-rose-500/30 text-rose-200 font-bold border border-rose-500/60'
                    : 'bg-neutral-900/80 text-rose-400 hover:bg-rose-950/30 border border-neutral-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                <span>Critical ({criticalCount})</span>
              </button>

              <button
                id="ai-sku-filter-high-btn"
                onClick={() => setActiveFilter('high')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                  activeFilter === 'high'
                    ? 'bg-amber-500/30 text-amber-200 font-bold border border-amber-500/60'
                    : 'bg-neutral-900/80 text-amber-400 hover:bg-amber-950/30 border border-neutral-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>High Risk ({highCount})</span>
              </button>

              <button
                id="ai-sku-filter-moderate-btn"
                onClick={() => setActiveFilter('moderate')}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeFilter === 'moderate'
                    ? 'bg-sky-500/30 text-sky-200 font-bold border border-sky-500/60'
                    : 'bg-neutral-900/80 text-sky-400 hover:bg-sky-950/30 border border-neutral-800'
                }`}
              >
                Moderate Buffer
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Batch Reorder All Urgent */}
              {urgentCount > 0 && (
                <button
                  id="ai-sku-restock-all-urgent-btn"
                  onClick={handleRestockAllUrgent}
                  disabled={batchRestocking}
                  className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-950/50 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  title="Execute recommended replenishment across all critical and high-risk SKUs"
                >
                  <PackagePlus className={`w-3.5 h-3.5 ${batchRestocking ? 'animate-spin' : ''}`} />
                  <span>{batchRestocking ? 'Replenishing...' : `Auto-Restock All Urgent (${urgentCount})`}</span>
                </button>
              )}

              {/* Push into Batch Adjuster */}
              {onBatchSelectSkus && (
                <button
                  id="ai-sku-select-all-batch-btn"
                  onClick={() => {
                    const ids = filteredSuggestions.map(s => s.productId);
                    onBatchSelectSkus(ids);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Load suggested items into Batch Adjuster"
                >
                  <Layers className="w-3.5 h-3.5 text-sky-400" />
                  <span>Load in Batch Editor</span>
                </button>
              )}
            </div>
          </div>

          {/* Suggestions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSuggestions.map((item) => {
              const productObj = products.find(p => p.id === item.productId);
              const isCrit = item.urgency === 'critical';
              const isHigh = item.urgency === 'high';
              const isMod = item.urgency === 'moderate';

              const urgencyBadgeColor = isCrit
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isHigh
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : isMod
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700';

              const cardBorder = isCrit
                ? 'border-rose-500/40 hover:border-rose-500/70 bg-rose-950/10'
                : isHigh
                ? 'border-amber-500/30 hover:border-amber-500/60 bg-amber-950/5'
                : 'border-neutral-800/80 hover:border-neutral-700 bg-neutral-950/40';

              return (
                <div
                  key={item.sku}
                  id={`ai-suggestion-card-${item.sku}`}
                  className={`p-3.5 rounded-xl border ${cardBorder} flex flex-col justify-between gap-3 transition-all relative group`}
                >
                  {/* Card Header: Product Info & Badges */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-mono font-bold text-white tracking-wide">
                            {item.sku}
                          </span>
                          <span className={`text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold border ${urgencyBadgeColor}`}>
                            {item.urgency}
                          </span>
                          {item.salesVelocityTrend === 'accelerating' && (
                            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-0.5">
                              <TrendingUp className="w-2.5 h-2.5" />
                              <span>ACCEL</span>
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-semibold text-neutral-200 truncate mt-1">
                          {item.name}
                        </h4>
                      </div>

                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0"
                        />
                      )}
                    </div>

                    {/* Stockout Timeline & Velocity Telemetry */}
                    <div className="grid grid-cols-3 gap-1.5 my-2.5 p-2 rounded-lg bg-neutral-950 border border-neutral-850 text-center font-mono">
                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">On Hand</span>
                        <span className={`text-xs font-bold ${item.availableStock <= 0 ? 'text-rose-400' : 'text-neutral-200'}`}>
                          {item.availableStock}
                          {item.reserved > 0 && (
                            <span className="text-[9px] text-neutral-500 font-normal"> (-{item.reserved} res)</span>
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Burn Rate</span>
                        <span className="text-xs font-bold text-amber-300">
                          {item.dailyDepletionRate}/d
                        </span>
                      </div>

                      <div>
                        <span className="text-[9px] text-neutral-500 uppercase block">Stockout In</span>
                        <span className={`text-xs font-bold ${
                          item.projectedStockoutHours <= 24 ? 'text-rose-400 animate-pulse' : 'text-sky-300'
                        }`}>
                          {item.projectedStockoutHours <= 0
                            ? 'DEPLETED'
                            : item.projectedStockoutHours < 24
                            ? `${item.projectedStockoutHours}h`
                            : `${item.projectedStockoutDays}d`}
                        </span>
                      </div>
                    </div>

                    {/* Predictive AI Rationale */}
                    <p className="text-[11px] text-neutral-400 line-clamp-2 leading-relaxed italic">
                      "{item.reasoning}"
                    </p>
                  </div>

                  {/* Recommendation Action Strip */}
                  <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-neutral-500 block uppercase">Recommended PO</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-bold text-white font-mono text-xs">
                          +{item.recommendedRestockQty} units
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          (~${item.estimatedRestockCost.toLocaleString()})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* One-click Restock Button */}
                      <button
                        id={`ai-quick-restock-btn-${item.sku}`}
                        onClick={() => handleApplyRestock(item)}
                        disabled={restockingSku === item.sku}
                        className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                        title={`Restock +${item.recommendedRestockQty} units directly`}
                      >
                        <PackagePlus className={`w-3 h-3 ${restockingSku === item.sku ? 'animate-spin' : ''}`} />
                        <span>Restock +{item.recommendedRestockQty}</span>
                      </button>

                      {/* Open Custom Adjust Modal */}
                      {productObj && onOpenStockAdjust && (
                        <button
                          onClick={() => onOpenStockAdjust(productObj)}
                          className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
                          title="Custom stock adjustment parameters"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
