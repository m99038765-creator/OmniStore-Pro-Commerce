import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeftRight,
  Truck,
  CheckCircle2,
  CheckSquare,
  Square,
  RefreshCw,
  Sparkles,
  Building2,
  MapPin,
  Loader2,
  Minus,
  Plus,
  GitCompareArrows,
  AlertTriangle,
  Scale,
  FileCheck2
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  computeAutomatedStockRebalancePlan,
  RebalancePriority,
  RebalanceTransferProposal
} from '../utils/automatedStockRebalance';

interface AutomatedStockRebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const AutomatedStockRebalanceModal: React.FC<AutomatedStockRebalanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const {
    products,
    orders,
    warehouseAuditLogs,
    warehouseConflicts,
    resolvedRegionalConflictSkus,
    executeStockRebalanceTransfers
  } = useStore();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({});
  const [deselectedIds, setDeselectedIds] = useState<string[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [isExecutingAll, setIsExecutingAll] = useState(false);
  const [receipt, setReceipt] = useState<{
    executedCount: number;
    totalUnitsTransferred: number;
    timestamp: string;
    routes: { sku: string; from: string; to: string; qty: number }[];
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsAnalyzing(true);
    setReceipt(null);
    const t = setTimeout(() => setIsAnalyzing(false), 320);
    return () => clearTimeout(t);
  }, [isOpen]);

  const plan = useMemo(
    () =>
      computeAutomatedStockRebalancePlan(
        products,
        orders,
        warehouseAuditLogs,
        warehouseConflicts,
        resolvedRegionalConflictSkus,
        qtyOverrides
      ),
    [
      products,
      orders,
      warehouseAuditLogs,
      warehouseConflicts,
      resolvedRegionalConflictSkus,
      qtyOverrides
    ]
  );

  const selectedTransfers = useMemo(
    () => plan.transfers.filter((t) => !deselectedIds.includes(t.id)),
    [plan.transfers, deselectedIds]
  );

  const selectedUnitsTotal = useMemo(
    () => selectedTransfers.reduce((acc, t) => acc + t.suggestedQty, 0),
    [selectedTransfers]
  );

  if (!isOpen) return null;

  const toggleTransferSelection = (id: string) => {
    setDeselectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAdjustQty = (proposal: RebalanceTransferProposal, nextQty: number) => {
    const clamped = Math.max(1, Math.min(proposal.maxTransferableQty, Math.round(nextQty)));
    setQtyOverrides((prev) => ({ ...prev, [proposal.id]: clamped }));
  };

  const handleReAnalyze = () => {
    setQtyOverrides({});
    setDeselectedIds([]);
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 320);
  };

  const handleExecuteSingle = async (proposal: RebalanceTransferProposal) => {
    if (executingId || isExecutingAll) return;
    setExecutingId(proposal.id);
    try {
      const res = await executeStockRebalanceTransfers([
        {
          productId: proposal.productId,
          sku: proposal.sku,
          productName: proposal.productName,
          sourceWarehouse: proposal.sourceWarehouse,
          destWarehouse: proposal.destWarehouse,
          quantity: proposal.suggestedQty,
          affectsPrimaryProductStock: proposal.affectsPrimaryProductStock
        }
      ]);
      if (res.success) {
        const msg = `Dispatched transfer of ${proposal.suggestedQty}u of ${proposal.sku} from ${proposal.sourceShortName} to ${proposal.destShortName}.`;
        setReceipt({
          executedCount: res.executedCount,
          totalUnitsTransferred: res.totalUnitsTransferred,
          timestamp: new Date(res.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          routes: [
            {
              sku: proposal.sku,
              from: proposal.sourceShortName,
              to: proposal.destShortName,
              qty: proposal.suggestedQty
            }
          ]
        });
        onSuccess?.(msg);
      }
    } finally {
      setExecutingId(null);
    }
  };

  const handleExecuteSelected = async () => {
    if (selectedTransfers.length === 0 || isExecutingAll || executingId) return;
    setIsExecutingAll(true);
    try {
      const payload = selectedTransfers.map((t) => ({
        productId: t.productId,
        sku: t.sku,
        productName: t.productName,
        sourceWarehouse: t.sourceWarehouse,
        destWarehouse: t.destWarehouse,
        quantity: t.suggestedQty,
        affectsPrimaryProductStock: t.affectsPrimaryProductStock
      }));
      const res = await executeStockRebalanceTransfers(payload);
      if (res.success) {
        const msg = `Automated Stock Rebalance executed ${res.executedCount} inter-warehouse transfers (${res.totalUnitsTransferred} units) across regional hubs.`;
        setReceipt({
          executedCount: res.executedCount,
          totalUnitsTransferred: res.totalUnitsTransferred,
          timestamp: new Date(res.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          routes: selectedTransfers.map((t) => ({
            sku: t.sku,
            from: t.sourceShortName,
            to: t.destShortName,
            qty: t.suggestedQty
          }))
        });
        onSuccess?.(msg);
      }
    } finally {
      setIsExecutingAll(false);
    }
  };

  const renderPriorityBadge = (priority: RebalancePriority) => {
    if (priority === 'critical') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-rose-500/25 text-rose-200 border border-rose-500/50">
          Critical
        </span>
      );
    }
    if (priority === 'high') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/20 text-amber-200 border border-amber-500/45">
          High
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-200 border border-indigo-500/45">
        Normalize
      </span>
    );
  };

  return (
    <div
      id="automated-stock-rebalance-modal-backdrop"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="automated-stock-rebalance-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-950 border border-violet-500/40 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-950/75 via-neutral-900 to-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/45 text-violet-300 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Automated Stock Rebalance Engine
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-violet-500/20 text-violet-200 border border-violet-400/45">
                  {plan.totalTransfers} Suggested Transfer{plan.totalTransfers === 1 ? '' : 's'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Analyzes regional ledger conflicts and low-stock deficits to recommend optimal inter-warehouse transfer quantities that normalize inventory across all hubs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="rebalance-reanalyze-btn"
              onClick={handleReAnalyze}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-violet-400 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Re-Analyze</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
              aria-label="Close Automated Stock Rebalance"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Executive Rebalance Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3.5 bg-neutral-900/40 border-b border-neutral-800">
          <div className="p-3 rounded-xl bg-neutral-950/90 border border-violet-500/35">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Regional Equilibrium
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5 font-mono">
              <span className="text-sm text-neutral-400">{plan.balanceScoreBefore}%</span>
              <ArrowRight className="w-3 h-3 text-violet-400" />
              <span className="text-xl font-bold text-emerald-400">{plan.balanceScoreAfter}%</span>
              {plan.normalizationGain > 0 && (
                <span className="text-[10px] font-bold text-emerald-300">
                  (+{plan.normalizationGain}%)
                </span>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Selected Transfer Volume
            </span>
            <div className="flex items-baseline gap-2 mt-0.5 font-mono">
              <span className="text-xl font-bold text-violet-300">
                {selectedUnitsTotal} u
              </span>
              <span className="text-[10px] text-neutral-400">
                across {selectedTransfers.length} route{selectedTransfers.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Discrepancies Normalized
            </span>
            <div className="flex items-baseline gap-2 mt-0.5 font-mono">
              <span className="text-xl font-bold text-amber-300">
                {plan.conflictsAddressedCount + plan.deficitsAddressedCount}
              </span>
              <span className="text-[10px] text-neutral-400">
                {plan.conflictsAddressedCount} conflicts · {plan.deficitsAddressedCount} deficits
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Est. Inter-Hub Transit
            </span>
            <div className="flex items-baseline gap-2 mt-0.5 font-mono">
              <span className="text-xl font-bold text-sky-400">
                {plan.avgTransitDays > 0 ? `${plan.avgTransitDays}d` : '0d'}
              </span>
              <span className="text-[10px] text-neutral-400">
                {plan.regions.length} regional hubs
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isAnalyzing ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-violet-300">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <p className="text-sm font-bold text-white">
                Analyzing Regional Inventory Discrepancies...
              </p>
              <p className="text-xs text-neutral-400 max-w-md">
                Computing cross-hub stock deltas, safety floor deficits, and shortest-distance inter-warehouse transfer routes.
              </p>
            </div>
          ) : (
            <>
              {/* Execution Receipt Banner */}
              {receipt && (
                <div
                  id="rebalance-execution-receipt"
                  className="p-4 rounded-2xl bg-emerald-950/35 border border-emerald-500/45 space-y-2 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                      <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Dispatched {receipt.executedCount} Inter-Warehouse Transfer{receipt.executedCount === 1 ? '' : 's'} ({receipt.totalUnitsTransferred} units) at {receipt.timestamp}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReceipt(null)}
                      className="text-[10px] font-mono text-neutral-400 hover:text-white cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {receipt.routes.map((r, i) => (
                      <span
                        key={`${r.sku}-${i}`}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-200 border border-emerald-500/35"
                      >
                        ✓ {r.sku}: {r.qty}u ({r.from} → {r.to})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Regional Stock Normalization Overview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-violet-400" />
                    <span>Regional Stock Normalization Preview</span>
                  </h3>
                  <span className="text-[10px] font-mono text-neutral-500">
                    Current → Projected after suggested transfers
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {plan.regions.map((reg) => {
                    const isOutbound = reg.netTransferDelta < 0;
                    const isInbound = reg.netTransferDelta > 0;
                    const fillPct = Math.min(
                      100,
                      Math.round(
                        (reg.projectedStock / Math.max(1, reg.targetNormalizedStock)) * 100
                      )
                    );

                    return (
                      <div
                        key={reg.warehouseName}
                        className="p-3 rounded-xl bg-neutral-900/75 border border-neutral-800 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="text-xs font-bold text-white truncate" title={reg.warehouseName}>
                            {reg.shortName}
                          </span>
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                              isInbound
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : isOutbound
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                            }`}
                          >
                            {isInbound
                              ? `+${reg.netTransferDelta}u In`
                              : isOutbound
                              ? `${reg.netTransferDelta}u Out`
                              : 'Balanced'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-neutral-400">
                            {reg.currentStock}u →{' '}
                            <strong className="text-white">{reg.projectedStock}u</strong>
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            Target ~{reg.targetNormalizedStock}u
                          </span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isInbound
                                ? 'bg-emerald-400'
                                : isOutbound
                                ? 'bg-sky-400'
                                : 'bg-violet-400'
                            }`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Suggested Inter-Warehouse Transfers List */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-violet-400" />
                    <span>Recommended Inter-Warehouse Transfers ({plan.transfers.length})</span>
                  </h3>
                  {plan.transfers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTransfers.length === plan.transfers.length) {
                          setDeselectedIds(plan.transfers.map((t) => t.id));
                        } else {
                          setDeselectedIds([]);
                        }
                      }}
                      className="text-[11px] font-mono text-violet-300 hover:text-violet-200 underline cursor-pointer"
                    >
                      {selectedTransfers.length === plan.transfers.length
                        ? 'Deselect All'
                        : `Select All (${plan.transfers.length})`}
                    </button>
                  )}
                </div>

                {plan.transfers.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">
                      All Regional Warehouses Are Normalized
                    </h4>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      No cross-regional stock conflicts or low-stock regional deficits require inter-warehouse transfers right now.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {plan.transfers.map((tr) => {
                      const isSelected = !deselectedIds.includes(tr.id);
                      const isRowExecuting = executingId === tr.id;

                      return (
                        <div
                          key={tr.id}
                          id={`rebalance-transfer-row-${tr.sku}`}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-violet-950/20 border-violet-500/45'
                              : 'bg-neutral-900/50 border-neutral-800/80 opacity-70'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => toggleTransferSelection(tr.id)}
                              className="mt-0.5 text-violet-300 hover:text-white cursor-pointer shrink-0"
                              aria-label={`Select transfer for ${tr.sku}`}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-violet-400" />
                              ) : (
                                <Square className="w-4 h-4 text-neutral-600" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-sky-300">
                                  {tr.sku}
                                </span>
                                {renderPriorityBadge(tr.priority)}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border inline-flex items-center gap-1 ${
                                    tr.triggerSource === 'regional_conflict'
                                      ? 'bg-orange-500/20 text-orange-200 border-orange-500/45'
                                      : tr.triggerSource === 'deficit_normalization'
                                      ? 'bg-rose-500/15 text-rose-200 border-rose-500/40'
                                      : 'bg-sky-500/15 text-sky-200 border-sky-500/40'
                                  }`}
                                >
                                  {tr.triggerSource === 'regional_conflict' ? (
                                    <>
                                      <GitCompareArrows className="w-2.5 h-2.5" />
                                      <span>Regional Conflict</span>
                                    </>
                                  ) : tr.triggerSource === 'deficit_normalization' ? (
                                    <>
                                      <AlertTriangle className="w-2.5 h-2.5" />
                                      <span>Regional Deficit</span>
                                    </>
                                  ) : (
                                    <>
                                      <Scale className="w-2.5 h-2.5" />
                                      <span>Surplus Equalization</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-xs font-semibold text-white truncate">
                                  {tr.productName}
                                </span>
                              </div>

                              {/* Inter-Warehouse Transfer Route Visual */}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200">
                                  <MapPin className="w-3 h-3 text-sky-400" />
                                  <span>{tr.sourceShortName}</span>
                                  <span className="text-neutral-500">
                                    ({tr.sourceStockBefore}→{tr.sourceStockAfter}u)
                                  </span>
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-900 border border-emerald-500/35 text-emerald-200">
                                  <MapPin className="w-3 h-3 text-emerald-400" />
                                  <span>{tr.destShortName}</span>
                                  <span className="text-emerald-400/80">
                                    ({tr.destStockBefore}→{tr.destStockAfter}u)
                                  </span>
                                </span>
                                <span className="text-[10px] text-neutral-400">
                                  · {tr.transitDaysLabel} ({tr.distanceMiles.toLocaleString()} mi)
                                </span>
                              </div>

                              <p className="text-[11px] text-neutral-400 leading-snug">
                                {tr.rationale}
                              </p>
                            </div>
                          </div>

                          {/* Quantity Stepper & Single Execute Action */}
                          <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                            <div className="flex items-center rounded-xl bg-neutral-900 border border-neutral-700 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => handleAdjustQty(tr, tr.suggestedQty - 1)}
                                disabled={tr.suggestedQty <= 1}
                                className="px-2 py-1.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                                aria-label="Decrease transfer quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2.5 py-1 text-xs font-mono font-bold text-white min-w-[46px] text-center">
                                {tr.suggestedQty}u
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAdjustQty(tr, tr.suggestedQty + 1)}
                                disabled={tr.suggestedQty >= tr.maxTransferableQty}
                                className="px-2 py-1.5 text-neutral-300 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                                aria-label="Increase transfer quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              type="button"
                              id={`rebalance-execute-single-btn-${tr.sku}`}
                              disabled={Boolean(executingId) || isExecutingAll}
                              onClick={() => handleExecuteSingle(tr)}
                              className="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 disabled:opacity-50 text-violet-200 border border-violet-400/50 text-xs font-mono font-bold inline-flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              {isRowExecuting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Truck className="w-3 h-3" />
                              )}
                              <span>Transfer</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Execution Bar */}
        <div className="px-5 py-3.5 bg-neutral-900/80 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>
              Transfer quantities are editable; executing updates regional ledgers, resolves linked conflicts, and logs immutable transfer audits.
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              id="execute-stock-rebalance-btn"
              disabled={selectedTransfers.length === 0 || isExecutingAll || Boolean(executingId)}
              onClick={handleExecuteSelected}
              className="px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-[0.99]"
            >
              {isExecutingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing Transfers...</span>
                </>
              ) : (
                <>
                  <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>
                    Execute Rebalance ({selectedTransfers.length} Route{selectedTransfers.length === 1 ? '' : 's'} · {selectedUnitsTotal}u)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
