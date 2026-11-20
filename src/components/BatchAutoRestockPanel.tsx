import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  PackagePlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface BatchAutoRestockPanelProps {
  onSelectBelowCapacitySkus: (productIds: string[]) => void;
  onFulfillSuccess?: (message: string) => void;
}

export const BatchAutoRestockPanel: React.FC<BatchAutoRestockPanelProps> = ({
  onSelectBelowCapacitySkus,
  onFulfillSuccess
}) => {
  const {
    products,
    isBatchAutoRestockEnabled,
    setBatchAutoRestockEnabled,
    autoRestockRequests,
    sku30DayCapacityMap,
    fulfillAutoRestockRequest,
    fulfillAllPendingAutoRestockRequests,
    updateAutoRestockRequestQty,
    dismissAutoRestockRequest
  } = useStore();

  const [fulfillingId, setFulfillingId] = useState<string | null>(null);
  const [isFulfillingAll, setIsFulfillingAll] = useState(false);
  const [showFulfilledHistory, setShowFulfilledHistory] = useState(false);

  const below20Products = useMemo(
    () => products.filter(p => sku30DayCapacityMap[p.id]?.isBelow20Pct),
    [products, sku30DayCapacityMap]
  );

  const pendingRequests = useMemo(
    () => autoRestockRequests.filter(r => r.status === 'pending'),
    [autoRestockRequests]
  );

  const fulfilledRequests = useMemo(
    () => autoRestockRequests.filter(r => r.status === 'fulfilled'),
    [autoRestockRequests]
  );

  const totalPendingUnits = useMemo(
    () => pendingRequests.reduce((sum, r) => sum + r.requestedQuantity, 0),
    [pendingRequests]
  );

  const totalPendingCost = useMemo(
    () => pendingRequests.reduce((sum, r) => sum + r.estimatedCost, 0),
    [pendingRequests]
  );

  const handleFulfillSingle = async (requestId: string, sku: string, qty: number) => {
    if (fulfillingId || isFulfillingAll) return;
    setFulfillingId(requestId);
    const ok = await fulfillAutoRestockRequest(requestId);
    setFulfillingId(null);
    if (ok && onFulfillSuccess) {
      onFulfillSuccess(`Auto-Restock request fulfilled: +${qty} units added to ${sku}.`);
    }
  };

  const handleFulfillAll = async () => {
    if (isFulfillingAll || pendingRequests.length === 0) return;
    setIsFulfillingAll(true);
    const result = await fulfillAllPendingAutoRestockRequests();
    setIsFulfillingAll(false);
    if (result.fulfilledCount > 0 && onFulfillSuccess) {
      onFulfillSuccess(
        `Fulfilled ${result.fulfilledCount} Auto-Restock request(s) totaling +${result.totalUnits} units.`
      );
    }
  };

  return (
    <div
      id="batch-auto-restock-panel"
      className={`rounded-2xl border transition-all overflow-hidden ${
        isBatchAutoRestockEnabled
          ? 'bg-gradient-to-br from-emerald-950/40 via-neutral-900/90 to-neutral-950 border-emerald-500/45 shadow-md shadow-emerald-950/30'
          : 'bg-neutral-900/60 border-neutral-800'
      }`}
    >
      {/* Top Control Header */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
              isBatchAutoRestockEnabled
                ? 'bg-emerald-500/20 border-emerald-500/45 text-emerald-400'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-400'
            }`}
          >
            <PackagePlus className="w-4 h-4 stroke-[2.25]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Auto-Restock Automation
              </h4>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                  isBatchAutoRestockEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                &lt;20% OF 30-DAY MAX CAPACITY
              </span>
              {isBatchAutoRestockEnabled && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE WATCH
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Automatically generates restock requests whenever a SKU falls below 20% of its maximum recorded capacity over the last 30 days.
            </p>
          </div>
        </div>

        {/* Toggle Switch Control */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            id="batch-auto-restock-toggle"
            type="button"
            role="switch"
            aria-checked={isBatchAutoRestockEnabled}
            aria-label="Toggle Auto-Restock for stock below 20% of 30-day maximum capacity"
            onClick={() => setBatchAutoRestockEnabled(!isBatchAutoRestockEnabled)}
            className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isBatchAutoRestockEnabled
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/30'
                : 'bg-neutral-950 border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:text-white'
            }`}
          >
            <span className="font-mono text-[11px] font-bold">
              Auto-Restock: {isBatchAutoRestockEnabled ? 'ON' : 'OFF'}
            </span>
            <span
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isBatchAutoRestockEnabled ? 'bg-emerald-500' : 'bg-neutral-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                  isBatchAutoRestockEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Telemetry Summary Strip */}
      <div className="px-4 py-2.5 bg-neutral-950/50 border-b border-neutral-800/70 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <div className="flex flex-wrap items-center gap-4 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Below 20% Cap:</span>
            <span
              className={`font-bold ${
                below20Products.length > 0 ? 'text-rose-300' : 'text-emerald-400'
              }`}
            >
              {below20Products.length} / {products.length} SKUs
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Pending Requests:</span>
            <span
              className={`font-bold ${
                pendingRequests.length > 0 ? 'text-amber-300' : 'text-neutral-300'
              }`}
            >
              {pendingRequests.length}
              {pendingRequests.length > 0 && (
                <span className="text-neutral-400 font-normal ml-1">
                  (+{totalPendingUnits}u · ${totalPendingCost.toLocaleString()})
                </span>
              )}
            </span>
          </div>

          {fulfilledRequests.length > 0 && (
            <button
              id="batch-auto-restock-history-toggle"
              type="button"
              onClick={() => setShowFulfilledHistory(prev => !prev)}
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{fulfilledRequests.length} Fulfilled</span>
              {showFulfilledHistory ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {below20Products.length > 0 && (
            <button
              id="batch-select-below-20-cap-btn"
              type="button"
              onClick={() => onSelectBelowCapacitySkus(below20Products.map(p => p.id))}
              className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Select all SKUs currently below 20% of their 30-day maximum recorded capacity in the Batch Adjuster"
            >
              <Layers className="w-3 h-3 text-rose-400" />
              <span>Select &lt;20% SKUs ({below20Products.length})</span>
            </button>
          )}

          {pendingRequests.length > 0 && (
            <button
              id="batch-auto-restock-fulfill-all-btn"
              type="button"
              disabled={isFulfillingAll}
              onClick={handleFulfillAll}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              {isFulfillingAll ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Fulfilling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Fulfill All ({pendingRequests.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pending Auto-Generated Restock Requests Queue */}
      {pendingRequests.length > 0 ? (
        <div id="batch-auto-restock-requests-list" className="p-3 space-y-2 max-h-60 overflow-y-auto">
          {pendingRequests.map(req => {
            const liveProd = products.find(p => p.id === req.productId);
            const liveCap = sku30DayCapacityMap[req.productId];
            const liveStock = liveProd ? liveProd.stock : req.currentStock;
            const maxCap = liveCap ? liveCap.maxCapacity30d : req.maxCapacity30d;
            const pct = liveCap ? liveCap.capacityRatioPercent : req.capacityRatioPercent;
            const barWidth = Math.max(2, Math.min(100, pct));
            const isCurrentlyBelow = liveCap ? liveCap.isBelow20Pct : pct < 20;
            const isBusy = fulfillingId === req.id || isFulfillingAll;

            return (
              <div
                key={req.id}
                id={`auto-restock-request-row-${req.sku}`}
                className="p-2.5 rounded-xl bg-neutral-950/90 border border-neutral-800 hover:border-amber-500/40 transition-colors flex flex-wrap items-center justify-between gap-3"
              >
                {/* SKU & Capacity Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {req.productImage ? (
                    <img
                      src={req.productImage}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover border border-neutral-800 bg-neutral-900 shrink-0"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {req.requestNumber}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-sky-400">
                        {req.sku}
                      </span>
                      <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                        {req.productName}
                      </span>
                    </div>

                    {/* 30-Day Capacity Progress Bar with 20% Trigger Line */}
                    <div className="mt-1.5 flex items-center gap-2.5 flex-wrap">
                      <div
                        className="relative w-24 h-1.5 rounded-full bg-neutral-800 overflow-hidden shrink-0"
                        title={`Live stock ${liveStock} / ${maxCap} max 30d capacity (${pct.toFixed(1)}%). 20% auto-restock line marked.`}
                      >
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCurrentlyBelow ? 'bg-rose-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                        <div
                          className="absolute top-0 bottom-0 w-[1.5px] bg-amber-300"
                          style={{ left: '20%' }}
                        />
                      </div>

                      <span className="text-[10px] font-mono text-neutral-400">
                        Stock{' '}
                        <strong className={isCurrentlyBelow ? 'text-rose-300' : 'text-emerald-300'}>
                          {liveStock}u
                        </strong>{' '}
                        / 30d Max <strong className="text-neutral-200">{maxCap}u</strong>{' '}
                        <span className={isCurrentlyBelow ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                          ({pct.toFixed(1)}%)
                        </span>
                        <span className="text-neutral-500 ml-1">
                          · Trigger &lt;{req.thresholdUnits20Pct}u
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Editable Quantity & Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1">
                    <span className="text-[10px] font-mono text-neutral-500">Req:</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={req.requestedQuantity}
                      onChange={e =>
                        updateAutoRestockRequestQty(req.id, parseInt(e.target.value, 10) || 1)
                      }
                      aria-label={`Restock quantity for ${req.sku}`}
                      className="w-12 bg-transparent text-xs font-mono font-bold text-emerald-300 text-center focus:outline-none"
                    />
                    <span className="text-[10px] font-mono text-neutral-500">u</span>
                  </div>

                  <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">
                    ${req.estimatedCost.toLocaleString()}
                  </span>

                  <button
                    id={`fulfill-auto-restock-${req.sku}`}
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleFulfillSingle(req.id, req.sku, req.requestedQuantity)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {fulfillingId === req.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                    )}
                    <span>Restock</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => dismissAutoRestockRequest(req.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                    title="Dismiss restock request"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : isBatchAutoRestockEnabled ? (
        <div className="px-4 py-2.5 text-[11px] text-emerald-300/90 flex items-center gap-2 bg-emerald-950/20">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            All {products.length} monitored SKUs are currently at or above 20% of their 30-day maximum recorded capacity. New restock requests will auto-generate immediately if any SKU drops below 20%.
          </span>
        </div>
      ) : below20Products.length > 0 ? (
        <div className="px-4 py-2.5 text-[11px] text-amber-200/90 flex items-center justify-between gap-2 bg-amber-950/20">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">
              <strong>{below20Products.length}</strong> SKU{below20Products.length === 1 ? '' : 's'} currently below 20% of 30-day max capacity (
              {below20Products
                .slice(0, 3)
                .map(p => p.sku)
                .join(', ')}
              {below20Products.length > 3 ? ` +${below20Products.length - 3} more` : ''}). Toggle Auto-Restock ON to automatically generate restock requests.
            </span>
          </div>
        </div>
      ) : null}

      {/* Recently Fulfilled History */}
      {showFulfilledHistory && fulfilledRequests.length > 0 && (
        <div className="px-4 py-2.5 border-t border-neutral-800/80 bg-neutral-950/70 space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Recently Fulfilled Auto-Restock Requests</span>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {fulfilledRequests.slice(0, 6).map(req => (
              <div
                key={req.id}
                className="flex items-center justify-between text-[11px] font-mono text-neutral-400 py-1 border-b border-neutral-900 last:border-0"
              >
                <div className="flex items-center gap-2 truncate">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span className="text-emerald-300 font-semibold">{req.requestNumber}</span>
                  <span className="text-neutral-200">{req.sku}</span>
                  <span className="text-neutral-500 truncate">
                    (triggered at {req.currentStock}/{req.maxCapacity30d}u · {req.capacityRatioPercent.toFixed(1)}%)
                  </span>
                </div>
                <span className="text-emerald-400 font-bold shrink-0">
                  +{req.requestedQuantity}u
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
