import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Plus,
  Trash2,
  Loader2,
  TrendingDown,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  MapPin
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface AutoReplenishmentControlProps {
  product: Product;
}

export const AutoReplenishmentControl: React.FC<AutoReplenishmentControlProps> = ({
  product
}) => {
  const {
    products,
    customerDefaultWarehouse,
    autoReplenishmentRules,
    autoReplenishmentDraftPOs,
    setAutoReplenishmentRule,
    approveAutoReplenishmentDraftPO,
    updateAutoReplenishmentDraftPOQty,
    dismissAutoReplenishmentDraftPO,
    simulateExternalPurchase
  } = useStore();

  const liveProduct = useMemo(
    () => products.find(p => p.id === product.id) || product,
    [products, product]
  );

  const rule = autoReplenishmentRules[liveProduct.id];
  const isEnabled = Boolean(rule?.enabled);

  // Suggested default target stock when enabling for the first time
  const suggestedDefaultTarget = useMemo(() => {
    const base = Math.max(
      liveProduct.lowStockThreshold * 3,
      liveProduct.stock + 5,
      15
    );
    return Math.min(500, base);
  }, [liveProduct.lowStockThreshold, liveProduct.stock]);

  const [targetInput, setTargetInput] = useState<string>(
    String(rule?.targetStock ?? suggestedDefaultTarget)
  );
  const [approvingPoId, setApprovingPoId] = useState<string | null>(null);
  const [isSimulatingDrop, setIsSimulatingDrop] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Keep input synced when switching products or when saved rule target changes externally
  useEffect(() => {
    setTargetInput(String(rule?.targetStock ?? suggestedDefaultTarget));
  }, [liveProduct.id, rule?.targetStock]);

  const parsedTarget = useMemo(() => {
    const num = parseInt(targetInput, 10);
    if (isNaN(num) || num < 1) return 1;
    return Math.min(9999, num);
  }, [targetInput]);

  const activeTarget = rule?.targetStock ?? parsedTarget;
  const hasUnsavedTargetChange = isEnabled && rule && parsedTarget !== rule.targetStock;

  const productDraftPOs = useMemo(
    () =>
      autoReplenishmentDraftPOs.filter(
        po => po.productId === liveProduct.id && po.status === 'draft'
      ),
    [autoReplenishmentDraftPOs, liveProduct.id]
  );

  const productApprovedPOs = useMemo(
    () =>
      autoReplenishmentDraftPOs.filter(
        po => po.productId === liveProduct.id && po.status === 'approved'
      ),
    [autoReplenishmentDraftPOs, liveProduct.id]
  );

  const isBelowTarget = liveProduct.stock < activeTarget;
  const shortfallUnits = Math.max(0, activeTarget - liveProduct.stock);
  const bufferUnits = Math.max(0, liveProduct.stock - activeTarget);
  const fillPercent = Math.min(
    100,
    Math.round((liveProduct.stock / Math.max(1, activeTarget)) * 100)
  );

  const activeWarehouse = rule?.warehouse || customerDefaultWarehouse || liveProduct.warehouse;

  const handleToggleEnabled = () => {
    const nextEnabled = !isEnabled;
    const targetToUse = rule?.targetStock ?? parsedTarget;
    setAutoReplenishmentRule(liveProduct, {
      enabled: nextEnabled,
      targetStock: targetToUse,
      warehouse: activeWarehouse
    });
  };

  const handleSaveTarget = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAutoReplenishmentRule(liveProduct, {
      enabled: true,
      targetStock: parsedTarget,
      warehouse: activeWarehouse
    });
  };

  const handleQuickPreset = (val: number) => {
    const clamped = Math.max(1, Math.min(9999, val));
    setTargetInput(String(clamped));
    if (isEnabled) {
      setAutoReplenishmentRule(liveProduct, {
        enabled: true,
        targetStock: clamped,
        warehouse: activeWarehouse
      });
    }
  };

  const handleApproveDraftPO = async (poId: string) => {
    if (approvingPoId) return;
    setApprovingPoId(poId);
    await approveAutoReplenishmentDraftPO(poId);
    setApprovingPoId(null);
  };

  const handleSimulateStockDrop = async () => {
    if (isSimulatingDrop || liveProduct.stock <= 0) return;
    setIsSimulatingDrop(true);
    await simulateExternalPurchase(liveProduct.id);
    setIsSimulatingDrop(false);
  };

  const formatTimestamp = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Just now';
    }
  };

  const presets = useMemo(() => {
    const lowFloor = Math.max(2, liveProduct.lowStockThreshold * 2);
    const plusFive = liveProduct.stock + 5;
    const doubleStock = Math.max(10, liveProduct.stock * 2);
    const items = [
      { label: `Floor (${lowFloor}u)`, value: lowFloor },
      { label: `Stock +5 (${plusFive}u)`, value: plusFive },
      { label: `2× Stock (${doubleStock}u)`, value: doubleStock },
      { label: '50u Buffer', value: 50 }
    ];
    // Deduplicate identical preset values while preserving order
    const seen = new Set<number>();
    return items.filter(item => {
      if (seen.has(item.value)) return false;
      seen.add(item.value);
      return true;
    });
  }, [liveProduct.lowStockThreshold, liveProduct.stock]);

  return (
    <div
      id={`modal-auto-replenishment-panel-${liveProduct.id}`}
      className={`mt-3 p-3.5 rounded-xl border transition-all ${
        isEnabled && productDraftPOs.length > 0
          ? 'bg-amber-950/20 border-amber-500/45'
          : isEnabled
          ? 'bg-emerald-950/15 border-emerald-500/35'
          : 'bg-neutral-950/60 border-neutral-800'
      }`}
    >
      {/* Header Row + Accessible Toggle Switch */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              isEnabled && productDraftPOs.length > 0
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : isEnabled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isEnabled ? 'text-current' : ''}`} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-white">Auto-Replenishment</span>
              {isEnabled ? (
                productDraftPOs.length > 0 ? (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Draft PO Triggered
                  </span>
                ) : (
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35">
                    Active · Target {activeTarget}u
                  </span>
                )
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
                  Off
                </span>
              )}
            </div>
            <span className="text-[11px] text-neutral-400 block truncate">
              {isEnabled
                ? isBelowTarget
                  ? `Stock (${liveProduct.stock}u) is below target (${activeTarget}u) — draft PO ready`
                  : `Auto-drafts a purchase order if stock drops below ${activeTarget} units`
                : 'Set a target stock level to auto-draft purchase orders on drops'}
            </span>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label="Toggle Auto-Replenishment"
          id={`modal-auto-replenishment-toggle-${liveProduct.id}`}
          onClick={handleToggleEnabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${
            isEnabled
              ? 'bg-emerald-500 border-emerald-400'
              : 'bg-neutral-800 border-neutral-700 hover:bg-neutral-700'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5 ${
              isEnabled ? 'translate-x-5.5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Expanded Target Stock Configuration & Status when Enabled */}
      {isEnabled && (
        <div className="mt-3 pt-3 border-t border-neutral-800/80 space-y-3">
          {/* Target Stock Input + Stepper + Save */}
          <form onSubmit={handleSaveTarget} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={`modal-auto-replenish-target-input-${liveProduct.id}`}
                className="text-[11px] font-semibold text-neutral-300"
              >
                Target Stock Threshold (units)
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                <MapPin className="w-3 h-3 text-emerald-400" />
                {activeWarehouse}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center border border-neutral-700 bg-neutral-900 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleQuickPreset(Math.max(1, parsedTarget - 1))}
                  className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  aria-label="Decrease target stock"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  id={`modal-auto-replenish-target-input-${liveProduct.id}`}
                  type="number"
                  min={1}
                  max={9999}
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  className="w-20 bg-transparent text-center text-xs font-mono font-bold text-white focus:outline-none py-1.5"
                />
                <button
                  type="button"
                  onClick={() => handleQuickPreset(Math.min(9999, parsedTarget + 1))}
                  className="px-2.5 py-1.5 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  aria-label="Increase target stock"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                type="submit"
                id={`modal-auto-replenish-save-target-btn-${liveProduct.id}`}
                disabled={!hasUnsavedTargetChange}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  hasUnsavedTargetChange
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-xs'
                    : 'bg-neutral-800/80 text-neutral-500 border border-neutral-800 cursor-default'
                }`}
              >
                {hasUnsavedTargetChange ? 'Apply Target' : 'Target Saved'}
              </button>

              {liveProduct.stock > 0 && (
                <button
                  type="button"
                  id={`modal-auto-replenish-simulate-drop-btn-${liveProduct.id}`}
                  onClick={handleSimulateStockDrop}
                  disabled={isSimulatingDrop}
                  className="ml-auto px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-neutral-900 hover:bg-neutral-800 text-sky-300 border border-sky-500/30 transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Simulate 1 unit sold to test automatic draft purchase order triggering"
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>{isSimulatingDrop ? 'Updating...' : 'Test -1 Sale'}</span>
                </button>
              )}
            </div>

            {/* Quick Threshold Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-neutral-500">Quick set:</span>
              {presets.map(preset => {
                const isSelected = activeTarget === preset.value && !hasUnsavedTargetChange;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => handleQuickPreset(preset.value)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </form>

          {/* Threshold Progress Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-neutral-400">
                Current Stock vs. Target
              </span>
              <span
                className={`font-bold ${
                  isBelowTarget ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {liveProduct.stock} / {activeTarget}u{' '}
                {isBelowTarget
                  ? `(Deficit: -${shortfallUnits}u)`
                  : `(+${bufferUnits}u buffer)`}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  liveProduct.stock === 0
                    ? 'bg-rose-500'
                    : isBelowTarget
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${fillPercent}%` }}
              />
            </div>
          </div>

          {/* Active Auto-Generated Draft Purchase Order(s) */}
          {productDraftPOs.length > 0 && (
            <div className="space-y-2 pt-1">
              {productDraftPOs.map(po => {
                const isApproving = approvingPoId === po.id;
                return (
                  <div
                    key={po.id}
                    id={`auto-replenish-draft-po-${po.id}`}
                    className="p-3 rounded-xl bg-neutral-950/90 border border-amber-500/50 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-bold text-white">
                              {po.poNumber}
                            </span>
                            <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              Draft PO
                            </span>
                            <span className="text-[10px] font-mono text-neutral-500">
                              {formatTimestamp(po.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>
                              Auto-triggered: stock ({liveProduct.stock}u) below target ({po.targetStock}u)
                            </span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => dismissAutoReplenishmentDraftPO(po.id)}
                        className="p-1 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
                        title="Dismiss draft purchase order"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Editable Qty + Wholesale Estimate + Approve CTA */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/80">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono text-neutral-400">
                          PO Qty:
                        </span>
                        <div className="flex items-center border border-neutral-700 bg-neutral-900 rounded-lg overflow-hidden">
                          <button
                            type="button"
                            onClick={() =>
                              updateAutoReplenishmentDraftPOQty(
                                po.id,
                                Math.max(1, po.orderQuantity - 1)
                              )
                            }
                            className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
                            aria-label="Decrease PO quantity"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="px-2.5 py-1 text-[11px] font-mono font-bold text-white">
                            +{po.orderQuantity}u
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateAutoReplenishmentDraftPOQty(
                                po.id,
                                po.orderQuantity + 1
                              )
                            }
                            className="px-2 py-1 text-neutral-300 hover:text-white hover:bg-neutral-800 cursor-pointer"
                            aria-label="Increase PO quantity"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        <span className="text-[11px] font-mono text-neutral-300">
                          Est.{' '}
                          <strong className="text-white">
                            ${po.estimatedTotalCost.toLocaleString()}
                          </strong>
                        </span>
                      </div>

                      <button
                        type="button"
                        id={`approve-auto-po-btn-${po.id}`}
                        disabled={isApproving}
                        onClick={() => handleApproveDraftPO(po.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-[11px] transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        {isApproving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <PackageCheck className="w-3.5 h-3.5 stroke-[2.25]" />
                        )}
                        <span>
                          {isApproving
                            ? 'Approving...'
                            : `Approve & Restock (+${po.orderQuantity})`}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Approved Auto-PO History (Collapsible) */}
          {productApprovedPOs.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowHistory(prev => !prev)}
                className="flex items-center justify-between w-full text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {productApprovedPOs.length} Approved Auto-Replenishment PO
                    {productApprovedPOs.length === 1 ? '' : 's'}
                  </span>
                </span>
                {showHistory ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showHistory && (
                <div className="mt-2 space-y-1.5">
                  {productApprovedPOs.slice(0, 4).map(po => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-800 text-[11px] font-mono"
                    >
                      <span className="text-neutral-200 font-semibold">
                        {po.poNumber}
                      </span>
                      <span className="text-emerald-400">
                        +{po.orderQuantity}u (Target {po.targetStock}u)
                      </span>
                      <span className="text-neutral-500">
                        {formatTimestamp(po.approvedAt || po.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
