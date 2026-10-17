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
  ShoppingCart,
  Sliders,
  FileText,
  Calculator,
  Play,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Building2,
  TrendingDown,
  Activity,
  PackagePlus,
  Eye
} from 'lucide-react';
import {
  Product,
  Order,
  CategoryDepletionReport,
  CategoryDepletionInsight,
  RestockProcurementItem,
  RestockProcurementDraft
} from '../types';
import {
  calculateCategoryDepletionReport,
  calculateSkuAiSuggestions
} from '../utils/aiSkuSuggestionEngine';
import { useStore } from '../context/StoreContext';
import { RestockProcurementDraftModal } from './RestockProcurementDraftModal';

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
  const { batchAdjustStock, addAlert, warehouseAuditLogs } = useStore();

  const [report, setReport] = useState<CategoryDepletionReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiSynthesizing, setAiSynthesizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterMode, setFilterMode] = useState<'high-turnover' | 'all'>('high-turnover');
  const [appliedBatchSuccess, setAppliedBatchSuccess] = useState<string | null>(null);

  // Widget View Mode: Turnover Velocity Insights vs Automated Replenishment Simulator
  const [widgetView, setWidgetView] = useState<'turnover' | 'replenishment-simulation'>('turnover');

  // Simulation Engine Parameters
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.25); // Demand velocity surge factor
  const [leadTimeDays, setLeadTimeDays] = useState<number>(5);           // Supplier lead time buffer in days
  const [safetyBufferDays, setSafetyBufferDays] = useState<number>(14);   // Target safety stock buffer
  const [simRiskFilter, setSimRiskFilter] = useState<'at-risk' | 'critical' | 'all'>('at-risk');
  const [simWarehouseFilter, setSimWarehouseFilter] = useState<string>('all');

  // Restock Procurement Draft Modal State
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [procurementDraft, setProcurementDraft] = useState<RestockProcurementDraft | null>(null);

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

  // High turnover filter for category view
  const displayedCategories = useMemo(() => {
    if (!report) return [];
    if (filterMode === 'high-turnover') {
      return report.categories.filter(
        c => c.turnoverSpeed === 'ultra-high' || c.turnoverSpeed === 'high' || c.runoutRiskLevel === 'critical' || c.runoutRiskLevel === 'high'
      );
    }
    return report.categories;
  }, [report, filterMode]);

  // Automated Replenishment Simulation Engine:
  // Projects exact stock-out dates, calculates lead time breaches, and determines optimal order batches
  const { simulatedItems, simMetrics } = useMemo(() => {
    const aiResponse = calculateSkuAiSuggestions(products, orders, warehouseAuditLogs);
    const now = new Date();

    const items: RestockProcurementItem[] = products.map(product => {
      const suggestion = aiResponse.suggestions.find(s => s.productId === product.id);
      const baseDailyRate = suggestion?.dailyDepletionRate || 3.0;
      const velocityTrend = suggestion?.salesVelocityTrend || 'steady';

      // Factor in velocity trend modifier and user demand surge multiplier
      const trendMultiplier = velocityTrend === 'accelerating' ? 1.15 : velocityTrend === 'cooling' ? 0.85 : 1.0;
      const effectiveDailyVelocity = Math.max(0.4, Math.round(baseDailyRate * surgeMultiplier * trendMultiplier * 10) / 10);
      const hourlyRate = effectiveDailyVelocity / 24;

      const availableStock = Math.max(0, product.stock - (product.reserved || 0));

      let projectedStockoutHours = 0;
      let projectedStockoutDays = 0;
      let stockoutDate: Date;

      if (availableStock <= 0) {
        projectedStockoutHours = 0;
        projectedStockoutDays = 0;
        stockoutDate = new Date(now);
      } else {
        projectedStockoutHours = Math.round((availableStock / hourlyRate) * 10) / 10;
        projectedStockoutDays = Math.round((projectedStockoutHours / 24) * 10) / 10;
        stockoutDate = new Date(now.getTime() + projectedStockoutHours * 60 * 60 * 1000);
      }

      // Format projected stock-out date label
      let projectedStockoutDateLabel = '';
      if (availableStock <= 0) {
        projectedStockoutDateLabel = 'DEPLETED (Immediate)';
      } else if (projectedStockoutHours < 24) {
        const timeStr = stockoutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        projectedStockoutDateLabel = `Today/Tomorrow • ${timeStr} (${Math.round(projectedStockoutHours)}h)`;
      } else {
        const dateStr = stockoutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
        const timeStr = stockoutDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        projectedStockoutDateLabel = `${dateStr} • ${timeStr} (~${projectedStockoutDays}d)`;
      }

      // Lead time collision check:
      // If stockout occurs before lead time arrival, it is CRITICAL
      let urgency: 'critical' | 'high' | 'moderate' | 'stable';
      if (availableStock === 0 || projectedStockoutDays <= leadTimeDays) {
        urgency = 'critical';
      } else if (projectedStockoutDays <= leadTimeDays + (safetyBufferDays / 2) || availableStock <= product.lowStockThreshold) {
        urgency = 'high';
      } else if (projectedStockoutDays <= leadTimeDays + safetyBufferDays) {
        urgency = 'moderate';
      } else {
        urgency = 'stable';
      }

      // Target stock units needed to cover Lead Time + Safety Buffer
      const targetCoverDays = leadTimeDays + safetyBufferDays;
      const targetStockUnits = Math.ceil(effectiveDailyVelocity * targetCoverDays);
      const netDeficitUnits = Math.max(0, targetStockUnits - availableStock);
      // Clean multiples of 5, minimum 5 units
      const recommendedOrderQty = Math.max(5, Math.ceil(Math.max(5, netDeficitUnits) / 5) * 5);
      const unitWholesaleCost = Math.round(product.price * 0.62);
      const totalCost = recommendedOrderQty * unitWholesaleCost;

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        image: product.images[0] || '',
        category: product.category,
        warehouse: product.warehouse,
        currentStock: product.stock,
        reserved: product.reserved || 0,
        availableStock,
        dailyVelocity: effectiveDailyVelocity,
        velocityTrend,
        projectedStockoutHours,
        projectedStockoutDays,
        projectedStockoutDate: stockoutDate.toISOString(),
        projectedStockoutDateLabel,
        recommendedOrderQty,
        unitWholesaleCost,
        totalCost,
        leadTimeDays,
        urgency,
        includedInDraft: urgency === 'critical' || urgency === 'high' || urgency === 'moderate'
      };
    });

    // Sort by projected stockout hours ascending (most critical first)
    items.sort((a, b) => a.projectedStockoutHours - b.projectedStockoutHours);

    // Compute key telemetry summary metrics
    const criticalItems = items.filter(i => i.urgency === 'critical');
    const highRiskItems = items.filter(i => i.urgency === 'high');
    const atRiskItems = items.filter(i => i.urgency === 'critical' || i.urgency === 'high');
    const totalSimReorderUnits = atRiskItems.reduce((acc, i) => acc + i.recommendedOrderQty, 0);
    const totalSimCost = atRiskItems.reduce((acc, i) => acc + i.totalCost, 0);
    const earliestStockoutItem = items[0] || null;

    return {
      simulatedItems: items,
      simMetrics: {
        criticalCount: criticalItems.length,
        highRiskCount: highRiskItems.length,
        atRiskCount: atRiskItems.length,
        totalSimReorderUnits,
        totalSimCost,
        earliestStockoutItem
      }
    };
  }, [products, orders, warehouseAuditLogs, surgeMultiplier, leadTimeDays, safetyBufferDays]);

  // Filter simulated items for presentation
  const filteredSimulatedItems = useMemo(() => {
    return simulatedItems.filter(item => {
      if (simWarehouseFilter !== 'all' && item.warehouse !== simWarehouseFilter) {
        return false;
      }
      if (simRiskFilter === 'critical') {
        return item.urgency === 'critical';
      }
      if (simRiskFilter === 'at-risk') {
        return item.urgency === 'critical' || item.urgency === 'high' || item.urgency === 'moderate';
      }
      return true;
    });
  }, [simulatedItems, simRiskFilter, simWarehouseFilter]);

  // Generate One-Click 'Restock Procurement' Draft for Warehouse Managers
  const handleGenerateProcurementDraft = () => {
    // Draft candidates: all items that have urgency critical, high, or moderate
    const candidates = simulatedItems.filter(i => i.urgency === 'critical' || i.urgency === 'high' || i.urgency === 'moderate');
    const targetItems = candidates.length > 0 ? candidates : simulatedItems.slice(0, 5);

    const now = new Date();
    const poNumber = `PO-${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Calculate target delivery date: 1 day before earliest stockout or now + leadTimeDays
    const targetDelivery = new Date(now);
    targetDelivery.setDate(targetDelivery.getDate() + leadTimeDays);
    const targetDeliveryDateStr = targetDelivery.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      year: 'numeric'
    });

    const totalUnits = targetItems.reduce((acc, i) => acc + i.recommendedOrderQty, 0);
    const totalEstimatedCost = targetItems.reduce((acc, i) => acc + i.totalCost, 0);

    const draft: RestockProcurementDraft = {
      poNumber,
      createdAt: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      targetWarehouse: simWarehouseFilter === 'all' ? 'All Warehouse Bays' : simWarehouseFilter,
      targetDeliveryDate: targetDeliveryDateStr,
      items: targetItems.map(item => ({ ...item, includedInDraft: true })),
      totalUnits,
      totalEstimatedCost,
      status: 'draft',
      simulationParameters: {
        surgeMultiplier,
        leadTimeDays,
        safetyBufferDays
      }
    };

    setProcurementDraft(draft);
    setIsDraftModalOpen(true);
  };

  // Draft item quantity adjustment in modal
  const handleUpdateDraftItemQty = (productId: string, newQty: number) => {
    if (!procurementDraft) return;
    setProcurementDraft(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            recommendedOrderQty: newQty,
            totalCost: newQty * item.unitWholesaleCost
          };
        }
        return item;
      });
      return {
        ...prev,
        items: updatedItems,
        totalUnits: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.recommendedOrderQty, 0),
        totalEstimatedCost: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.totalCost, 0)
      };
    });
  };

  // Toggle item include/exclude in PO draft
  const handleToggleItemInclude = (productId: string) => {
    if (!procurementDraft) return;
    setProcurementDraft(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.map(item => {
        if (item.productId === productId) {
          return { ...item, includedInDraft: !item.includedInDraft };
        }
        return item;
      });
      return {
        ...prev,
        items: updatedItems,
        totalUnits: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.recommendedOrderQty, 0),
        totalEstimatedCost: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.totalCost, 0)
      };
    });
  };

  // Remove item from draft
  const handleRemoveItemFromDraft = (productId: string) => {
    if (!procurementDraft) return;
    setProcurementDraft(prev => {
      if (!prev) return null;
      const updatedItems = prev.items.filter(item => item.productId !== productId);
      return {
        ...prev,
        items: updatedItems,
        totalUnits: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.recommendedOrderQty, 0),
        totalEstimatedCost: updatedItems.filter(i => i.includedInDraft).reduce((acc, i) => acc + i.totalCost, 0)
      };
    });
  };

  // Execute Restock PO Approval
  const handleApproveDraft = async (draftToApprove: RestockProcurementDraft) => {
    const activeItems = draftToApprove.items.filter(i => i.includedInDraft);
    if (activeItems.length === 0) return;

    // Apply stock adjustments for each approved item
    for (const item of activeItems) {
      await batchAdjustStock({
        productIds: [item.productId],
        adjustmentType: 'add',
        quantity: item.recommendedOrderQty,
        reason: `Automated Replenishment PO #${draftToApprove.poNumber}`
      });
    }

    addAlert(
      'success',
      `📦 Restock PO #${draftToApprove.poNumber} Approved`,
      `Successfully restocked +${draftToApprove.totalUnits} units across ${activeItems.length} SKUs.`
    );
  };

  // Queue draft items to Warehouse Admin Batch Stock Update
  const handleQueueToBatchAdjuster = (productIds: string[]) => {
    if (onOpenBatchRestock && productIds.length > 0) {
      onOpenBatchRestock(productIds);
      setAppliedBatchSuccess(`Queued ${productIds.length} replenishment SKUs into Warehouse Batch Adjuster`);
      setTimeout(() => setAppliedBatchSuccess(null), 3500);
    } else if (onOpenAdminModal) {
      onOpenAdminModal();
    }
  };

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
                  Replenishment Engine
                </span>
              </h3>
              {simMetrics.criticalCount > 0 ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1 animate-pulse">
                  <Flame className="w-3 h-3 text-rose-400" />
                  <span>{simMetrics.criticalCount} Stockouts Before Lead Arrival</span>
                </span>
              ) : highTurnoverCategories.length > 0 ? (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>{highTurnoverCategories.length} High-Velocity Categories</span>
                </span>
              ) : null}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Simulates automated replenishment runways, projects exact stock-out dates, and generates one-click procurement drafts.
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
          {/* View Mode Toggle: Turnover Insights vs Replenishment Simulation */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              id="predictive-tab-turnover-btn"
              onClick={() => setWidgetView('turnover')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                widgetView === 'turnover'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <span>Turnover Insights</span>
            </button>
            <button
              id="predictive-tab-simulation-btn"
              onClick={() => setWidgetView('replenishment-simulation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                widgetView === 'replenishment-simulation'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-emerald-300'
              }`}
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-400" />
              <span>Replenishment Simulator</span>
              {simMetrics.criticalCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>

          {/* Quick 1-Click PO Draft Button in Header */}
          <button
            id="predictive-header-draft-btn"
            onClick={handleGenerateProcurementDraft}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-950/60 cursor-pointer active:scale-95"
            title="Generate One-Click Restock Procurement Order Draft"
          >
            <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Restock PO Draft</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-neutral-950 text-emerald-400 font-mono">
              {simMetrics.atRiskCount}
            </span>
          </button>

          {/* Gemini AI Synthesis Button */}
          <button
            id="predictive-widget-gemini-synth-btn"
            onClick={handleSynthesizeGemini}
            disabled={aiSynthesizing}
            className="px-2.5 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-violet-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Synthesize AI strategic executive restock briefing with Gemini"
          >
            <Bot className={`w-3.5 h-3.5 ${aiSynthesizing ? 'animate-spin text-sky-400' : 'text-violet-400'}`} />
            <span className="hidden md:inline">{aiSynthesizing ? 'Synthesizing...' : 'AI Directive'}</span>
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
            className="px-2.5 py-1 rounded bg-emerald-500 text-neutral-950 font-bold text-[11px] hover:bg-emerald-400 transition-colors cursor-pointer"
          >
            Open Batch Adjuster
          </button>
        </div>
      )}

      {!isCollapsed && (
        <div className="p-4 sm:p-5 space-y-4 relative z-10">
          {/* ========================================================================= */}
          {/* VIEW MODE 1: REPLENISHMENT SIMULATOR & AUTOMATED STOCK-OUT DRAFT          */}
          {/* ========================================================================= */}
          {widgetView === 'replenishment-simulation' ? (
            <div className="space-y-4">
              {/* Simulation Configuration Bar */}
              <div className="p-4 rounded-xl bg-neutral-950/80 border border-emerald-500/30 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                      <Calculator className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>Automated Replenishment Simulation Parameters</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                          Active Model
                        </span>
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Adjust demand surge multipliers and freight lead times to project exact stock-out dates and generate procurement requisitions.
                      </p>
                    </div>
                  </div>

                  {/* One-Click Restock Procurement Draft CTA */}
                  <button
                    id="generate-restock-procurement-draft-btn"
                    onClick={handleGenerateProcurementDraft}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-all shadow-lg shadow-emerald-950/70 cursor-pointer active:scale-95 shrink-0"
                  >
                    <FileText className="w-4 h-4 stroke-[2.5]" />
                    <span>Generate Restock Procurement Draft</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-neutral-900 text-emerald-400 font-mono">
                      +{simMetrics.totalSimReorderUnits} units
                    </span>
                  </button>
                </div>

                {/* Simulation Control Knobs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/80 text-xs">
                  {/* Demand Surge Multiplier */}
                  <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                      Demand Outflow Surge:
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: '1.0x Normal', val: 1.0 },
                        { label: '1.25x High', val: 1.25 },
                        { label: '1.5x Promo', val: 1.5 },
                        { label: '2.0x Peak', val: 2.0 },
                      ].map(s => (
                        <button
                          key={s.val}
                          type="button"
                          onClick={() => setSurgeMultiplier(s.val)}
                          className={`flex-1 py-1 px-1 rounded text-[10px] font-mono transition-colors border ${
                            surgeMultiplier === s.val
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Supplier Freight Lead Time */}
                  <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                      Supplier Lead Time Buffer:
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: '2d Express', val: 2 },
                        { label: '5d Standard', val: 5 },
                        { label: '10d Freight', val: 10 },
                      ].map(lt => (
                        <button
                          key={lt.val}
                          type="button"
                          onClick={() => setLeadTimeDays(lt.val)}
                          className={`flex-1 py-1 px-1 rounded text-[10px] font-mono transition-colors border ${
                            leadTimeDays === lt.val
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                          }`}
                        >
                          {lt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Safety Buffer Days */}
                  <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                      Target Safety Runway:
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: '7 Days', val: 7 },
                        { label: '14 Days', val: 14 },
                        { label: '21 Days', val: 21 },
                      ].map(sb => (
                        <button
                          key={sb.val}
                          type="button"
                          onClick={() => setSafetyBufferDays(sb.val)}
                          className={`flex-1 py-1 px-1 rounded text-[10px] font-mono transition-colors border ${
                            safetyBufferDays === sb.val
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                          }`}
                        >
                          {sb.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filter Knobs */}
                  <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                      Display Urgency:
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { label: 'At-Risk', val: 'at-risk' },
                        { label: 'Critical Only', val: 'critical' },
                        { label: 'All SKUs', val: 'all' },
                      ].map(f => (
                        <button
                          key={f.val}
                          type="button"
                          onClick={() => setSimRiskFilter(f.val as any)}
                          className={`flex-1 py-1 px-1 rounded text-[10px] font-mono transition-colors border ${
                            simRiskFilter === f.val
                              ? 'bg-neutral-800 text-white font-bold border-neutral-700'
                              : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Simulation KPI Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-rose-500/40 bg-rose-950/15 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                      Stockout Before Lead Time
                    </span>
                    <Clock className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                  </div>
                  <div className="my-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-rose-400">
                        {simMetrics.criticalCount}
                      </span>
                      <span className="text-xs text-neutral-400">critical SKUs</span>
                    </div>
                    <span className="text-[10px] text-rose-300 block">
                      Will exhaust stock before {leadTimeDays}d freight arrival
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                      Earliest Stock-Out
                    </span>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="my-1">
                    <div className="text-sm font-bold font-mono text-amber-300 truncate">
                      {simMetrics.earliestStockoutItem ? simMetrics.earliestStockoutItem.projectedStockoutDateLabel : 'N/A'}
                    </div>
                    <span className="text-[10px] text-neutral-400 block truncate">
                      {simMetrics.earliestStockoutItem ? `${simMetrics.earliestStockoutItem.sku} (${simMetrics.earliestStockoutItem.name})` : ''}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                      Total PO Reorder Volume
                    </span>
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="my-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-emerald-400">
                        +{simMetrics.totalSimReorderUnits}
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">units PO</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block">
                      Secures full {leadTimeDays + safetyBufferDays}-day operating runway
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                      Estimated PO Capital
                    </span>
                    <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="my-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold font-mono text-sky-400">
                        ${Math.round(simMetrics.totalSimCost / 1000)}k
                      </span>
                      <span className="text-xs text-neutral-400 font-mono">wholesale</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 block font-mono">
                      Exact: ${simMetrics.totalSimCost.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Projected Stock-Out Timeline Table & Restock Directives */}
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">
                      Projected SKU Stock-Out Timelines ({filteredSimulatedItems.length} items shown)
                    </span>
                    <span className="text-[11px] font-mono text-neutral-500">
                      Calculated from observed burn velocity @ {surgeMultiplier}x
                    </span>
                  </div>

                  <button
                    id="simulation-generate-po-btn"
                    onClick={handleGenerateProcurementDraft}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Draft Procurement PO</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  {filteredSimulatedItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-900/40 rounded-xl">
                      No items matched the current filter.
                    </div>
                  ) : (
                    filteredSimulatedItems.map(item => {
                      const isCritical = item.urgency === 'critical';
                      const isHigh = item.urgency === 'high';

                      return (
                        <div
                          key={item.productId}
                          id={`sim-item-row-${item.productId}`}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isCritical
                              ? 'bg-rose-950/20 border-rose-500/40'
                              : isHigh
                              ? 'bg-amber-950/15 border-amber-500/30'
                              : 'bg-neutral-900/60 border-neutral-800'
                          }`}
                        >
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Product Info */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <img
                                src={item.image}
                                alt={item.name}
                                referrerPolicy="no-referrer"
                                className="w-11 h-11 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-sky-400">
                                    {item.sku}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                                    {item.warehouse}
                                  </span>
                                  {item.velocityTrend === 'accelerating' ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-0.5">
                                      <Flame className="w-2.5 h-2.5 text-rose-400" /> Accelerating Outflow
                                    </span>
                                  ) : item.velocityTrend === 'cooling' ? (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-0.5">
                                      <TrendingDown className="w-2.5 h-2.5 text-sky-400" /> Cooling Outflow
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 flex items-center gap-0.5">
                                      <Activity className="w-2.5 h-2.5 text-emerald-400" /> Steady
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-semibold text-white truncate mt-0.5">
                                  {item.name}
                                </h4>
                              </div>
                            </div>

                            {/* Telemetry Metrics Grid */}
                            <div className="grid grid-cols-3 gap-2 text-xs font-mono lg:w-96 shrink-0 text-center">
                              {/* Stock & Outflow */}
                              <div className="p-2 rounded-lg bg-neutral-950/80 border border-neutral-800">
                                <span className="text-[9px] text-neutral-500 uppercase block">Outflow Burn</span>
                                <span className="text-xs font-bold text-amber-300">
                                  {item.dailyVelocity} <span className="text-[9px] text-neutral-500">u/d</span>
                                </span>
                                <span className="text-[10px] text-neutral-400 block mt-0.5">
                                  Stock: {item.availableStock} u
                                </span>
                              </div>

                              {/* Projected Stockout Date */}
                              <div className={`p-2 rounded-lg border ${
                                isCritical
                                  ? 'bg-rose-950/50 border-rose-500/50 text-rose-300 font-bold'
                                  : 'bg-neutral-950/80 border-neutral-800 text-sky-300'
                              }`}>
                                <span className="text-[9px] text-neutral-400 uppercase block flex items-center justify-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Stock-Out</span>
                                </span>
                                <span className="text-[11px] block truncate">
                                  {item.projectedStockoutDateLabel}
                                </span>
                                <span className="text-[9px] opacity-80 block truncate">
                                  {item.projectedStockoutHours <= 0
                                    ? 'Zero on Hand'
                                    : item.projectedStockoutDays <= leadTimeDays
                                    ? `Breaches ${leadTimeDays}d lead!`
                                    : `~${item.projectedStockoutDays}d buffer`}
                                </span>
                              </div>

                              {/* Reorder Recommendation */}
                              <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400">
                                <span className="text-[9px] text-neutral-400 uppercase block">Reorder PO</span>
                                <span className="text-xs font-bold block">
                                  +{item.recommendedOrderQty} u
                                </span>
                                <span className="text-[10px] text-neutral-400 block mt-0.5">
                                  ${item.totalCost.toLocaleString()}
                                </span>
                              </div>
                            </div>

                            {/* Direct Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                id={`sim-queue-single-btn-${item.productId}`}
                                onClick={() => handleQueueToBatchAdjuster([item.productId])}
                                className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-neutral-700"
                                title="Open this item in Batch Adjuster"
                              >
                                <Sliders className="w-3 h-3 text-sky-400" />
                                <span>Adjust</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE 2: CATEGORY TURNOVER OVERVIEW & AI SYNTHESIS                    */
            /* ========================================================================= */
            <>
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

              {/* Replenishment Simulation Promotion Bar */}
              <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/30 via-sky-950/20 to-neutral-900/40 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300">
                    <Calculator className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <span className="font-semibold text-white">Automated Replenishment Simulation: </span>
                    <span className="text-neutral-300">
                      {simMetrics.criticalCount} SKUs are projected to stock out before supplier freight arrival.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    id="predictive-open-simulator-btn"
                    onClick={() => setWidgetView('replenishment-simulation')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-700"
                  >
                    <span>Open Simulator</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    id="predictive-quick-draft-btn"
                    onClick={handleGenerateProcurementDraft}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    <FileText className="w-3 h-3 stroke-[2.5]" />
                    <span>Generate PO Draft</span>
                  </button>
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
            </>
          )}
        </div>
      )}

      {/* Restock Procurement Draft Modal */}
      <RestockProcurementDraftModal
        isOpen={isDraftModalOpen}
        onClose={() => setIsDraftModalOpen(false)}
        draft={procurementDraft}
        onUpdateDraftItemQty={handleUpdateDraftItemQty}
        onToggleItemInclude={handleToggleItemInclude}
        onRemoveItemFromDraft={handleRemoveItemFromDraft}
        onApproveAndRestock={handleApproveDraft}
        onQueueToBatchAdjuster={handleQueueToBatchAdjuster}
      />
    </section>
  );
};
