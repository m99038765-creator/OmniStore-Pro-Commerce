import React, { useState, useRef, useEffect } from 'react';
import { Zap, Clock, ShieldCheck, AlertCircle, MapPin, CheckCircle2, ChevronDown, PackageCheck } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { calculateQuickShipReadiness } from '../utils/transitCalculator';

interface QuickShipIndicatorProps {
  product: Product;
  isSkuResultCard?: boolean;
  size?: 'sm' | 'md';
}

export const QuickShipIndicator: React.FC<QuickShipIndicatorProps> = ({
  product,
  isSkuResultCard = false,
  size = 'md',
}) => {
  const { customerDefaultWarehouse, isSafeModeEnabled, checkSkuSafety } = useStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const safety = isSafeModeEnabled ? checkSkuSafety(product.sku) : { isSafe: true };

  const readiness = calculateQuickShipReadiness(product, {
    customerWarehouse: customerDefaultWarehouse,
    isSafe: safety.isSafe,
  });

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsPopoverOpen(false);
      }
    }
    if (isPopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPopoverOpen]);

  const isSmall = size === 'sm';

  // Visual styling based on readiness status
  const badgeTheme = readiness.canDispatchWithin4Hours
    ? readiness.status === 'low_stock_ready'
      ? {
          bg: 'bg-amber-950/60 hover:bg-amber-950/80',
          border: 'border-amber-500/60 hover:border-amber-500/90 shadow-amber-950/40',
          text: 'text-amber-300',
          icon: 'text-amber-400 fill-amber-400/30',
          dot: 'bg-amber-400',
        }
      : {
          bg: 'bg-emerald-950/70 hover:bg-emerald-950/90',
          border: 'border-emerald-500/60 hover:border-emerald-500/90 shadow-emerald-950/40',
          text: 'text-emerald-300',
          icon: 'text-emerald-400 fill-emerald-400/30',
          dot: 'bg-emerald-400',
        }
    : readiness.status === 'quarantined'
    ? {
        bg: 'bg-rose-950/60 hover:bg-rose-950/80',
        border: 'border-rose-500/60 hover:border-rose-500/90 shadow-rose-950/40',
        text: 'text-rose-300',
        icon: 'text-rose-400',
        dot: 'bg-rose-500',
      }
    : {
        bg: 'bg-neutral-900/80 hover:bg-neutral-850',
        border: 'border-neutral-800 hover:border-neutral-700',
        text: 'text-neutral-400',
        icon: 'text-neutral-500',
        dot: 'bg-neutral-500',
      };

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Quick Ship Readiness Pill / Button */}
      <button
        type="button"
        id={`quick-ship-indicator-${product.id}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsPopoverOpen(prev => !prev);
        }}
        title={`Quick Ship Readiness: ${readiness.reason} - Click for 4-hour dispatch SLA breakdown`}
        aria-label={`Quick Ship: ${readiness.badgeLabel}`}
        aria-expanded={isPopoverOpen}
        className={`group/quickship inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none backdrop-blur-md shadow-xs ${
          badgeTheme.bg
        } ${badgeTheme.border} ${badgeTheme.text} ${
          isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } ${isSkuResultCard ? 'ring-1 ring-emerald-500/30 font-semibold' : ''}`}
      >
        <span className="relative flex h-2 w-2">
          {readiness.canDispatchWithin4Hours && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badgeTheme.dot}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badgeTheme.dot}`} />
        </span>

        <Zap className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover/quickship:scale-115 ${badgeTheme.icon}`} />

        <span className="font-semibold whitespace-nowrap">
          {isSmall ? readiness.shortBadgeLabel : readiness.badgeLabel}
        </span>

        {isSkuResultCard && readiness.canDispatchWithin4Hours && (
          <span className="hidden sm:inline-block text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold uppercase tracking-wider">
            Verified Hub Stock
          </span>
        )}

        <ChevronDown
          className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${
            isPopoverOpen ? 'rotate-180 text-white' : 'opacity-70 group-hover/quickship:opacity-100'
          }`}
        />
      </button>

      {/* Popover Breakdown Dialog */}
      {isPopoverOpen && (
        <div
          id={`quick-ship-popover-${product.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 sm:left-auto sm:right-0 mt-2 w-80 max-w-[90vw] p-4 bg-neutral-900/95 border border-neutral-700/90 rounded-2xl shadow-2xl backdrop-blur-xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5 font-bold text-white">
              <Zap className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
              <span>4-Hour Quick Ship Telemetry</span>
            </div>
            <span
              className={`font-mono text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                readiness.canDispatchWithin4Hours
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700'
              }`}
            >
              {readiness.dispatchWindow}
            </span>
          </div>

          {/* Regional Hub Availability Card */}
          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2 mb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-mono block">
                  Closest Regional Hub
                </span>
                <span className="font-semibold text-white flex items-center gap-1 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {readiness.closestHubName}
                </span>
                <span className="text-[10px] text-neutral-400 pl-4.5 block">
                  {readiness.closestHubCity}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-neutral-500 uppercase font-mono block">
                  Shelf Inventory
                </span>
                <span
                  className={`font-mono font-bold text-xs ${
                    readiness.availableUnits > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {readiness.availableUnits} Available
                </span>
              </div>
            </div>

            {/* SLA Pipeline Checklist */}
            <div className="pt-2 border-t border-neutral-800/80 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    readiness.availableUnits > 0 ? 'text-emerald-400' : 'text-neutral-600'
                  }`}
                />
                <span className={readiness.availableUnits > 0 ? 'text-neutral-200' : 'text-neutral-500'}>
                  Real-time stock verified in closest hub
                </span>
              </div>
              <div className="flex items-center gap-2">
                <PackageCheck
                  className={`w-3.5 h-3.5 shrink-0 ${
                    readiness.canDispatchWithin4Hours ? 'text-emerald-400' : 'text-neutral-600'
                  }`}
                />
                <span className={readiness.canDispatchWithin4Hours ? 'text-neutral-200' : 'text-neutral-500'}>
                  Automated pick & sort queue ready
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock
                  className={`w-3.5 h-3.5 shrink-0 ${
                    readiness.canDispatchWithin4Hours ? 'text-sky-400' : 'text-neutral-600'
                  }`}
                />
                <span className="text-neutral-300">
                  Carrier dispatch window: <strong className="text-white">&lt; 4 Hours</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Cutoff Countdown Banner */}
          <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] flex items-center gap-2 text-neutral-300 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="leading-tight">{readiness.cutoffCountdownText}</span>
          </div>

          {/* Reason / Narrative */}
          <p className="text-[10px] text-neutral-400 leading-relaxed mb-3">
            {readiness.reason}
          </p>

          {/* Footer */}
          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-500">
            <span>SLA: 4-Hour Fulfillment Protocol</span>
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
