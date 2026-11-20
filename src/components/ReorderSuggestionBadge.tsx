import React, { useMemo, useState } from 'react';
import {
  PackagePlus,
  Truck,
  Activity,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sliders,
  MapPin,
  Sparkles,
  Loader2
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import {
  calculateTransitEstimation,
  REGIONAL_HUBS,
  getRegionalHubByName
} from '../utils/transitCalculator';
import { calculateSkuAiSuggestions } from '../utils/aiSkuSuggestionEngine';

interface ReorderSuggestionBadgeProps {
  product: Product;
}

export const ReorderSuggestionBadge: React.FC<ReorderSuggestionBadgeProps> = ({ product }) => {
  const {
    products,
    orders,
    warehouseAuditLogs,
    customerDefaultWarehouse,
    setCustomerDefaultWarehouse,
    restockProduct,
    openAdminForProduct,
    setQuickViewProduct,
    addAlert
  } = useStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isApplyingRestock, setIsApplyingRestock] = useState(false);
  const [justRestockedQty, setJustRestockedQty] = useState<number | null>(null);

  // Use freshest product reference from store so badge recalculates immediately after restocking
  const liveProduct = useMemo(
    () => products.find((p) => p.id === product.id) || product,
    [products, product]
  );

  const selectedWarehouse = customerDefaultWarehouse || liveProduct.warehouse;
  const selectedHub = useMemo(
    () => getRegionalHubByName(selectedWarehouse),
    [selectedWarehouse]
  );

  const metrics = useMemo(() => {
    const transit = calculateTransitEstimation(
      liveProduct.warehouse,
      selectedWarehouse,
      liveProduct.stock
    );
    const leadTimeDays = Math.max(1, Math.ceil((transit.daysMin + transit.daysMax) / 2));

    const velocityResp = calculateSkuAiSuggestions([liveProduct], orders, warehouseAuditLogs);
    const vel = velocityResp.suggestions[0];

    const dailyVelocity = vel?.dailyDepletionRate ?? 2.5;
    const availableStock = Math.max(0, liveProduct.stock - (liveProduct.reserved || 0));
    const projectedStockoutDays =
      availableStock <= 0
        ? 0
        : Math.round((availableStock / Math.max(0.1, dailyVelocity)) * 10) / 10;

    // Combine transit lead-time demand + safety buffer + target cycle coverage for current warehouse
    const leadTimeDemand = Math.ceil(dailyVelocity * leadTimeDays);
    const safetyBufferUnits = Math.max(
      liveProduct.lowStockThreshold,
      Math.ceil(dailyVelocity * 3)
    );
    const cycleCoverageDays = vel?.targetBufferDays ?? 10;
    const targetWarehouseLevel = Math.max(
      safetyBufferUnits + leadTimeDemand,
      Math.ceil(dailyVelocity * (cycleCoverageDays + leadTimeDays))
    );

    const deficit = Math.max(0, targetWarehouseLevel - availableStock);
    const optimalReplenishQty = deficit > 0 ? deficit : 0;
    const fillPercent = Math.min(
      100,
      Math.round((availableStock / Math.max(1, targetWarehouseLevel)) * 100)
    );
    const estimatedWholesaleCost =
      optimalReplenishQty * Math.round(liveProduct.price * 0.62);

    let urgency: 'critical' | 'high' | 'moderate' | 'optimal' = 'optimal';
    if (optimalReplenishQty === 0) {
      urgency = 'optimal';
    } else if (availableStock === 0 || projectedStockoutDays <= leadTimeDays) {
      urgency = 'critical';
    } else if (
      availableStock <= liveProduct.lowStockThreshold ||
      projectedStockoutDays <= leadTimeDays + 3
    ) {
      urgency = 'high';
    } else {
      urgency = 'moderate';
    }

    return {
      transit,
      leadTimeDays,
      leadTimeDemand,
      dailyVelocity,
      salesVelocityTrend: vel?.salesVelocityTrend ?? 'steady',
      availableStock,
      projectedStockoutDays,
      safetyBufferUnits,
      targetWarehouseLevel,
      optimalReplenishQty,
      fillPercent,
      estimatedWholesaleCost,
      urgency
    };
  }, [liveProduct, orders, warehouseAuditLogs, selectedWarehouse]);

  const handleApplyReplenishment = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (metrics.optimalReplenishQty <= 0 || isApplyingRestock) return;
    setIsApplyingRestock(true);
    const qtyToOrder = metrics.optimalReplenishQty;
    const ok = await restockProduct(liveProduct.id, qtyToOrder);
    setIsApplyingRestock(false);
    if (ok) {
      setJustRestockedQty(qtyToOrder);
      addAlert(
        'success',
        'Replenishment Dispatched',
        `Added +${qtyToOrder} units of ${liveProduct.sku} for ${selectedHub.name} (Target: ${metrics.targetWarehouseLevel} units).`
      );
      setTimeout(() => setJustRestockedQty(null), 3500);
    }
  };

  const badgeTone =
    metrics.urgency === 'critical'
      ? 'bg-rose-950/75 hover:bg-rose-900/80 border-rose-500/60 text-rose-200'
      : metrics.urgency === 'high'
      ? 'bg-amber-950/75 hover:bg-amber-900/80 border-amber-500/60 text-amber-200'
      : metrics.urgency === 'moderate'
      ? 'bg-violet-950/70 hover:bg-violet-900/75 border-violet-500/50 text-violet-200'
      : 'bg-emerald-950/60 hover:bg-emerald-900/65 border-emerald-500/50 text-emerald-200';

  const iconTone =
    metrics.urgency === 'critical'
      ? 'text-rose-400'
      : metrics.urgency === 'high'
      ? 'text-amber-400'
      : metrics.urgency === 'moderate'
      ? 'text-violet-400'
      : 'text-emerald-400';

  const pillTone =
    metrics.urgency === 'critical'
      ? 'bg-rose-500/25 text-rose-200 border-rose-500/40'
      : metrics.urgency === 'high'
      ? 'bg-amber-500/25 text-amber-200 border-amber-500/40'
      : metrics.urgency === 'moderate'
      ? 'bg-violet-500/25 text-violet-200 border-violet-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  const barColor =
    metrics.urgency === 'critical'
      ? 'bg-rose-500'
      : metrics.urgency === 'high'
      ? 'bg-amber-500'
      : metrics.urgency === 'moderate'
      ? 'bg-violet-500'
      : 'bg-emerald-500';

  return (
    <div className="w-full space-y-2">
      {/* Compact Reorder Suggestion Badge Trigger */}
      <button
        type="button"
        id={`modal-reorder-suggestion-badge-${liveProduct.id}`}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
        className={`w-full sm:w-auto inline-flex items-center justify-between sm:justify-start gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer shadow-xs ${badgeTone}`}
        title={`Reorder Suggestion for ${selectedHub.name}: ${
          metrics.optimalReplenishQty > 0
            ? `+${metrics.optimalReplenishQty} units (Current stock: ${liveProduct.stock}, Velocity: ${metrics.dailyVelocity}/day, Transit: ${metrics.transit.shortDaysLabel}) to reach target of ${metrics.targetWarehouseLevel} units`
            : `Stock (${liveProduct.stock}) is already at or above target level (${metrics.targetWarehouseLevel}) for ${selectedHub.name}`
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          {metrics.optimalReplenishQty > 0 ? (
            <PackagePlus className={`w-3.5 h-3.5 shrink-0 ${iconTone}`} />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          )}
          <span className="font-semibold tracking-tight">Reorder Suggestion:</span>
          <span
            className={`font-mono text-[11px] font-bold px-1.5 py-0.2 rounded-md border ${pillTone}`}
          >
            {metrics.optimalReplenishQty > 0
              ? `+${metrics.optimalReplenishQty} units`
              : 'At Target'}
          </span>
        </span>

        <span className="hidden sm:inline text-[10px] font-mono opacity-80">
          {selectedHub.code} · {metrics.dailyVelocity}/day · {metrics.leadTimeDays}d transit
        </span>

        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 opacity-80 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0" />
        )}
      </button>

      {/* Expandable Replenishment Telemetry Breakdown */}
      {isExpanded && (
        <div
          id={`modal-reorder-suggestion-details-${liveProduct.id}`}
          className="p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800 space-y-3 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
            <div className="flex items-center gap-1.5 text-neutral-200 font-semibold">
              <Sparkles className={`w-3.5 h-3.5 ${iconTone}`} />
              <span>Optimal Replenishment Plan</span>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-400">
              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="sr-only">Selected Warehouse</span>
              <select
                id={`modal-reorder-warehouse-select-${liveProduct.id}`}
                value={selectedHub.name}
                onChange={(e) => setCustomerDefaultWarehouse(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-md px-2 py-0.5 text-[10px] font-mono text-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Switch target warehouse to recalculate transit lead time and optimal replenishment volume"
              >
                {REGIONAL_HUBS.map((hub) => (
                  <option key={hub.id} value={hub.name}>
                    {hub.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Target Level Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-neutral-400">
                Available vs. Warehouse Target
              </span>
              <span className="text-neutral-200 font-bold">
                {metrics.availableStock} / {metrics.targetWarehouseLevel} units ({metrics.fillPercent}%)
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                style={{ width: `${metrics.fillPercent}%` }}
              />
            </div>
          </div>

          {/* Velocity & Transit Metrics Grid */}
          <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
              <span className="text-neutral-500 flex items-center gap-1 uppercase">
                <Activity className="w-2.5 h-2.5 text-sky-400" />
                Velocity
              </span>
              <span className="text-xs font-bold text-white block mt-0.5">
                {metrics.dailyVelocity}/day
              </span>
              <span className="text-[9px] text-neutral-400">
                ~{metrics.projectedStockoutDays}d runway
              </span>
            </div>

            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
              <span className="text-neutral-500 flex items-center gap-1 uppercase">
                <Truck className="w-2.5 h-2.5 text-amber-400" />
                Transit Window
              </span>
              <span className="text-xs font-bold text-white block mt-0.5">
                {metrics.transit.shortDaysLabel}
              </span>
              <span className="text-[9px] text-neutral-400">
                +{metrics.leadTimeDemand} in-transit burn
              </span>
            </div>

            <div className="p-2 rounded-lg bg-neutral-900/90 border border-neutral-800/80">
              <span className="text-neutral-500 flex items-center gap-1 uppercase">
                <PackagePlus className={`w-2.5 h-2.5 ${iconTone}`} />
                Suggested Qty
              </span>
              <span className="text-xs font-bold text-white block mt-0.5">
                {metrics.optimalReplenishQty > 0
                  ? `+${metrics.optimalReplenishQty} units`
                  : '0 needed'}
              </span>
              <span className="text-[9px] text-neutral-400">
                {metrics.optimalReplenishQty > 0
                  ? `Est. $${metrics.estimatedWholesaleCost.toLocaleString()}`
                  : 'Buffer healthy'}
              </span>
            </div>
          </div>

          {/* One-click Warehouse Replenishment Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {justRestockedQty ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Replenished +{justRestockedQty} units for {selectedHub.name.split('(')[0].trim()}
              </span>
            ) : (
              <span className="text-[10px] text-neutral-400">
                Safety floor: <strong className="text-neutral-200 font-mono">{metrics.safetyBufferUnits}</strong> units · Lead-time factor: <strong className="text-neutral-200 font-mono">{metrics.leadTimeDays}d</strong>
              </span>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              {metrics.optimalReplenishQty > 0 && (
                <button
                  type="button"
                  id={`modal-apply-reorder-btn-${liveProduct.id}`}
                  disabled={isApplyingRestock}
                  onClick={handleApplyReplenishment}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {isApplyingRestock ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <PackagePlus className="w-3 h-3 stroke-[2.5]" />
                  )}
                  <span>
                    {isApplyingRestock
                      ? 'Restocking...'
                      : `Restock +${metrics.optimalReplenishQty} Units`}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQuickViewProduct(null);
                  openAdminForProduct(liveProduct);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 border border-neutral-700 text-[11px] font-semibold transition-colors cursor-pointer"
                title="Open SKU in Warehouse Admin for custom stock adjustment"
              >
                <Sliders className="w-3 h-3" />
                <span>Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
