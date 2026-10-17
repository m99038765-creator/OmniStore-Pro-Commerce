import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Flame,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  PackageCheck,
  TrendingDown,
  Sparkles
} from 'lucide-react';
import { Product, Order } from '../types';
import { calculateSkuAiSuggestions } from '../utils/aiSkuSuggestionEngine';
import { useStore } from '../context/StoreContext';

interface LowStockDashboardBannerProps {
  products: Product[];
  orders: Order[];
  onOpenPredictiveWidget?: () => void;
  onOpenProductDetail?: (product: Product) => void;
}

export const LowStockDashboardBanner: React.FC<LowStockDashboardBannerProps> = ({
  products,
  orders,
  onOpenPredictiveWidget,
  onOpenProductDetail
}) => {
  const { warehouseAuditLogs } = useStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showAllDrawer, setShowAllDrawer] = useState(false);

  // Compute stock-out risk within 7 days based on current daily outflow velocity
  const trendingStockouts = useMemo(() => {
    const aiResponse = calculateSkuAiSuggestions(products, orders, warehouseAuditLogs);
    const now = new Date();

    const items = products.map(product => {
      const suggestion = aiResponse.suggestions.find(s => s.productId === product.id);
      const baseDailyRate = suggestion?.dailyDepletionRate || 3.0;
      const velocityTrend = suggestion?.salesVelocityTrend || 'steady';
      const trendMultiplier = velocityTrend === 'accelerating' ? 1.15 : velocityTrend === 'cooling' ? 0.85 : 1.0;
      const effectiveDailyVelocity = Math.max(0.4, Math.round(baseDailyRate * trendMultiplier * 10) / 10);
      const availableStock = Math.max(0, product.stock - (product.reserved || 0));

      let projectedDays = 999;
      if (availableStock <= 0) {
        projectedDays = 0;
      } else {
        projectedDays = Math.round((availableStock / effectiveDailyVelocity) * 10) / 10;
      }

      return {
        product,
        availableStock,
        dailyVelocity: effectiveDailyVelocity,
        projectedDays,
        velocityTrend
      };
    });

    // Filter items trending towards stock-out within 7 days (projectedDays <= 7)
    const atRisk7Days = items.filter(i => i.projectedDays <= 7);
    // Sort by fewest days remaining (most urgent first)
    atRisk7Days.sort((a, b) => a.projectedDays - b.projectedDays);

    return atRisk7Days;
  }, [products, orders, warehouseAuditLogs]);

  if (isDismissed || trendingStockouts.length === 0) {
    return null;
  }

  const urgentItem = trendingStockouts[0];
  const remainingCount = trendingStockouts.length - 1;

  return (
    <div className="mb-6 rounded-2xl bg-gradient-to-r from-rose-950/90 via-amber-950/80 to-neutral-950 border border-rose-500/40 shadow-xl overflow-hidden text-neutral-100 relative animate-fade-in">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-80 h-24 bg-rose-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        
        {/* Left: Banner Title & Urgent Spotlight Item */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 shrink-0 shadow-inner animate-pulse">
            <Flame className="w-5 h-5 text-rose-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase tracking-wide">
                7-Day Stock-Out Warning
              </span>
              <span className="text-xs font-mono text-neutral-400">
                {trendingStockouts.length} SKU{trendingStockouts.length === 1 ? '' : 's'} trending to zero inventory
              </span>
            </div>

            {/* Spotlight Item Summary */}
            <div className="mt-2 flex items-center gap-3 bg-neutral-950/60 border border-neutral-800/80 rounded-xl p-2.5 max-w-xl">
              <img
                src={urgentItem.product.images[0] || ''}
                alt={urgentItem.product.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-lg object-cover bg-neutral-900 border border-neutral-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-mono font-bold text-sky-400">{urgentItem.product.sku}</span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-neutral-300 font-mono">Stock: <strong className="text-white">{urgentItem.availableStock}u</strong></span>
                  <span className="text-neutral-400">•</span>
                  <span className="text-amber-400 font-mono">Burn: -{urgentItem.dailyVelocity}u/d</span>
                </div>
                <div className="text-xs font-semibold text-white truncate mt-0.5">
                  {urgentItem.product.name}
                </div>
              </div>

              <div className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold shrink-0">
                {urgentItem.projectedDays <= 0 ? 'DEPLETED' : `~${Math.round(urgentItem.projectedDays * 24)}h left`}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Actions & Expandable List */}
        <div className="flex items-center gap-2.5 self-end lg:self-auto flex-wrap justify-end shrink-0">
          {remainingCount > 0 && (
            <button
              id="low-stock-banner-toggle-drawer-btn"
              onClick={() => setShowAllDrawer(!showAllDrawer)}
              className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-800 cursor-pointer"
            >
              <span>{showAllDrawer ? 'Hide List' : `View All (${trendingStockouts.length})`}</span>
              {showAllDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {onOpenProductDetail && (
            <button
              id="low-stock-banner-inspect-btn"
              onClick={() => onOpenProductDetail(urgentItem.product)}
              className="px-3.5 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-900 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700 cursor-pointer"
            >
              <span>Inspect SKU</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenPredictiveWidget && (
            <button
              id="low-stock-banner-open-simulator-btn"
              onClick={onOpenPredictiveWidget}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-rose-950/60 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Open Replenishment Simulator</span>
            </button>
          )}

          <button
            id="low-stock-banner-dismiss-btn"
            onClick={() => setIsDismissed(true)}
            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss warning banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable Drawer of all 7-day At-Risk SKUs */}
      {showAllDrawer && trendingStockouts.length > 1 && (
        <div className="px-5 py-3 bg-neutral-950 border-t border-rose-500/30 space-y-2 animate-fade-in">
          <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center justify-between">
            <span>Complete 7-Day Stock-Out Vulnerability List</span>
            <span>Sorted by urgency</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
            {trendingStockouts.map((item, idx) => (
              <div
                key={item.product.id}
                onClick={() => onOpenProductDetail && onOpenProductDetail(item.product)}
                className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-rose-500/40 flex items-center justify-between gap-3 cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[10px] text-neutral-500">#{idx + 1}</span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold text-sky-400 truncate">{item.product.sku}</div>
                    <div className="text-[11px] text-white truncate">{item.product.name}</div>
                  </div>
                </div>
                <div className="text-right font-mono shrink-0">
                  <div className="text-xs font-bold text-rose-400">
                    {item.projectedDays <= 0 ? 'Depleted' : `~${Math.round(item.projectedDays * 10) / 10} days`}
                  </div>
                  <div className="text-[10px] text-neutral-400">Stock: {item.availableStock}u</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
