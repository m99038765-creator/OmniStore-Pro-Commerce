import React, { useState, useRef, useEffect } from 'react';
import { Truck, MapPin, ChevronDown, Check, Info, Calendar, ArrowRight, ShieldCheck } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { calculateTransitEstimation, REGIONAL_HUBS } from '../utils/transitCalculator';

interface TransitEstimationBadgeProps {
  product: Product;
  size?: 'sm' | 'md';
  showPopoverOnClick?: boolean;
}

export const TransitEstimationBadge: React.FC<TransitEstimationBadgeProps> = ({
  product,
  size = 'md',
  showPopoverOnClick = true,
}) => {
  const { customerDefaultWarehouse, setCustomerDefaultWarehouse, addAlert } = useStore();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const transit = calculateTransitEstimation(
    product.warehouse,
    customerDefaultWarehouse,
    product.stock
  );

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

  const handleWarehouseChange = (hubName: string) => {
    setCustomerDefaultWarehouse(hubName);
    addAlert(
      'info',
      'Default Warehouse Updated',
      `Transit estimation now calculated from "${hubName.split('(')[0].trim()}".`
    );
  };

  const isSmall = size === 'sm';

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Transit Estimation Badge Trigger */}
      <button
        type="button"
        id={`transit-badge-${product.id}`}
        onClick={(e) => {
          e.stopPropagation();
          if (showPopoverOnClick) {
            setIsPopoverOpen(prev => !prev);
          }
        }}
        title={`Transit Estimation: ${transit.daysLabel} based on default warehouse (${customerDefaultWarehouse.split('(')[0].trim()}) - Click for logistics breakdown`}
        aria-label={`Transit Estimation: ${transit.daysLabel}`}
        aria-expanded={isPopoverOpen}
        className={`group/transit inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer select-none backdrop-blur-md shadow-xs ${
          transit.badgeColorClass.bg
        } ${transit.badgeColorClass.border} ${transit.badgeColorClass.text} ${
          isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        }`}
      >
        <Truck className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover/transit:scale-110 ${transit.badgeColorClass.icon}`} />
        <span className="font-medium whitespace-nowrap">
          {isSmall ? transit.shortDaysLabel : `Transit: ${transit.shortDaysLabel}`}
        </span>

        {transit.isSameWarehouse && (
          <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono uppercase tracking-wide font-bold">
            Local Hub
          </span>
        )}

        {showPopoverOnClick && (
          <ChevronDown
            className={`w-3 h-3 text-neutral-400 transition-transform duration-200 ${
              isPopoverOpen ? 'rotate-180 text-white' : 'opacity-70 group-hover/transit:opacity-100'
            }`}
          />
        )}
      </button>

      {/* Interactive Transit Estimation Breakdown Popover */}
      {isPopoverOpen && (
        <div
          id={`transit-popover-${product.id}`}
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 left-0 sm:left-auto sm:right-0 mt-2 w-80 max-w-[90vw] p-4 bg-neutral-900/95 border border-neutral-700/90 rounded-2xl shadow-2xl backdrop-blur-xl text-xs text-neutral-200 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>Transit Estimation Details</span>
            </div>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-medium">
              {transit.shortDaysLabel}
            </span>
          </div>

          {/* Route Card */}
          <div className="p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800 space-y-2 mb-3">
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex flex-col">
                <span className="text-[10px] text-neutral-500 uppercase font-mono">Origin Warehouse</span>
                <span className="font-medium text-neutral-200 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-400" />
                  {product.warehouse.split('(')[0].trim()}
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-500 shrink-0 mx-2" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-emerald-400/90 uppercase font-mono">Default Hub (You)</span>
                <span className="font-medium text-emerald-300 flex items-center gap-1 justify-end">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  {customerDefaultWarehouse.split('(')[0].trim()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t border-neutral-800/80 text-[10px] font-mono text-neutral-400">
              <span>Fulfillment Route Distance:</span>
              <span className="text-white font-semibold">
                {transit.isSameWarehouse ? '0 mi (Same-facility dispatch)' : `${transit.distanceMiles} miles`}
              </span>
            </div>
          </div>

          {/* Delivery Window & SLA */}
          <div className="space-y-1.5 text-[11px] mb-3">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-sky-400" />
                Estimated Arrival:
              </span>
              <span className="font-medium text-white font-mono">{transit.estimatedDeliveryDate}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Logistics Tier:</span>
              <span className="text-neutral-300 font-mono capitalize">
                {transit.transitTier.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Customer Default Warehouse Quick Selector */}
          <div className="pt-2.5 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={`default-wh-select-${product.id}`} className="text-[10px] uppercase font-mono text-neutral-400">
                Customer's Default Warehouse:
              </label>
              <span className="text-[10px] text-neutral-500">Affects all catalog transit</span>
            </div>
            <div className="relative">
              <select
                id={`default-wh-select-${product.id}`}
                value={customerDefaultWarehouse}
                onChange={(e) => handleWarehouseChange(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700/80 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {REGIONAL_HUBS.map(hub => (
                  <option key={hub.id} value={hub.name}>
                    {hub.name} ({hub.region})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Close hint */}
          <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Calculated from real-time hub availability</span>
            <button
              onClick={() => setIsPopoverOpen(false)}
              className="text-neutral-400 hover:text-white underline cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
