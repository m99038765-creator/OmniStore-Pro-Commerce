import React from 'react';
import { Radio, ShieldCheck, Zap, Truck, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const LiveTickerBar: React.FC = () => {
  const { connectionStatus, recentActivity, metrics } = useStore();

  const latestPurchase = recentActivity[0];

  return (
    <div
      id="live-ticker-bar"
      className="bg-neutral-900/95 border-b border-neutral-800 text-xs py-2 px-4 select-none relative z-40"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Real-time Connection State */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-400'
                  : connectionStatus === 'fallback'
                  ? 'bg-sky-400'
                  : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500'
                  : connectionStatus === 'fallback'
                  ? 'bg-sky-500'
                  : 'bg-amber-500'
              }`}
            />
          </span>
          <span className="font-mono text-[11px] font-medium tracking-tight text-neutral-300">
            {connectionStatus === 'connected' && 'LIVE WEBSOCKET SYNCED'}
            {connectionStatus === 'fallback' && 'LIVE SSE SYNCED'}
            {connectionStatus === 'reconnecting' && 'RECONNECTING FEED...'}
          </span>
          <span className="hidden sm:inline-block text-neutral-600">|</span>
          <span className="hidden md:inline-flex items-center gap-1.5 text-neutral-400 font-mono text-[11px]">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Active SKU Feed ({metrics.unitsInStock} units across 3 hubs)</span>
          </span>
        </div>

        {/* Center: Live Order Activity Pulse */}
        <div className="hidden lg:flex items-center gap-2 text-neutral-300">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-neutral-400">Live Dispatch:</span>
          {latestPurchase ? (
            <span className="font-medium text-neutral-200 truncate max-w-md">
              1x {latestPurchase.productName.substring(0, 32)}... shipped to {latestPurchase.city}
            </span>
          ) : (
            <span className="text-neutral-400">Automated fulfillment running across Newark & Bay Area</span>
          )}
        </div>

        {/* Right: Security & Shipping Guarantee */}
        <div className="flex items-center gap-4 text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">256-Bit Vault Checkout</span>
            <span className="sm:hidden">Vault Secure</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-neutral-300">
            <Truck className="w-3.5 h-3.5 text-sky-400" />
            <span>Free Priority on $500+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
