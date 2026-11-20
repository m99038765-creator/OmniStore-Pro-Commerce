import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Square,
  Search,
  AlertTriangle,
  GitCompareArrows,
  ShieldAlert,
  ClipboardCheck,
  Sparkles,
  Boxes,
  MapPin,
  Loader2,
  FileCheck2,
  Filter,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { getAllRegionalConflicts } from '../utils/inventoryConflicts';
import {
  ChartSkuDiscrepancy,
  DiscrepancyTypeTag,
  getChartSkuDiscrepancies
} from '../utils/warehouseZoneDiscrepancies';
import { VoiceDictationButton } from './VoiceDictationButton';

interface WarehouseBatchReconcileProps {
  onFinishedSuccess?: (message: string) => void;
  onSwitchToInventory?: () => void;
}

const AUDIT_NOTE_PRESETS = [
  'Physical cycle count verified & cross-hub warehouse ledgers reconciled.',
  'QA audit complete — quarantine/damage holds cleared and stock aligned.',
  'Inter-warehouse transfer manifest verified; regional count drift resolved.',
  'Supervisor spot-check confirmed authoritative inventory counts.'
];

const TYPE_META: Record<
  DiscrepancyTypeTag,
  { label: string; badgeClass: string }
> = {
  regional_conflict: {
    label: 'Regional Conflict',
    badgeClass: 'bg-orange-500/20 text-orange-200 border-orange-500/50'
  },
  quarantine_damaged: {
    label: 'Quarantine / Damaged',
    badgeClass: 'bg-rose-500/20 text-rose-200 border-rose-500/50'
  },
  cycle_variance: {
    label: 'Cycle Variance',
    badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-500/50'
  },
  pick_bin_shortage: {
    label: 'Pick-Bin Shortage',
    badgeClass: 'bg-sky-500/20 text-sky-200 border-sky-500/50'
  }
};

export const WarehouseBatchReconcile: React.FC<WarehouseBatchReconcileProps> = ({
  onFinishedSuccess,
  onSwitchToInventory
}) => {
  const {
    products,
    warehouseAuditLogs,
    warehouseConflicts,
    resolvedRegionalConflictSkus,
    reconciledDiscrepancySkus,
    selectedDiscrepancySkus,
    setSelectedDiscrepancySkus,
    toggleDiscrepancySkuSelection,
    batchClearAndReconcileDiscrepancies
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DiscrepancyTypeTag>('all');
  const [auditNote, setAuditNote] = useState(AUDIT_NOTE_PRESETS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    reconciledCount: number;
    skus: string[];
    auditNote: string;
    timestamp: string;
  } | null>(null);

  const allRegionalConflicts = useMemo(
    () =>
      getAllRegionalConflicts(
        products,
        warehouseAuditLogs,
        warehouseConflicts,
        resolvedRegionalConflictSkus
      ),
    [products, warehouseAuditLogs, warehouseConflicts, resolvedRegionalConflictSkus]
  );

  const activeDiscrepancies = useMemo(
    () =>
      getChartSkuDiscrepancies(
        products,
        warehouseAuditLogs,
        allRegionalConflicts,
        reconciledDiscrepancySkus
      ),
    [products, warehouseAuditLogs, allRegionalConflicts, reconciledDiscrepancySkus]
  );

  const filteredDiscrepancies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeDiscrepancies.filter((item) => {
      if (typeFilter !== 'all' && !item.discrepancyTypes.includes(typeFilter)) {
        return false;
      }
      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.productName.toLowerCase().includes(q) ||
        item.warehouse.toLowerCase().includes(q) ||
        item.summaryReason.toLowerCase().includes(q)
      );
    });
  }, [activeDiscrepancies, searchQuery, typeFilter]);

  const activeSkuSet = useMemo(
    () => new Set(activeDiscrepancies.map((d) => d.sku.trim().toUpperCase())),
    [activeDiscrepancies]
  );

  const validSelectedSkus = useMemo(
    () => selectedDiscrepancySkus.filter((s) => activeSkuSet.has(s.trim().toUpperCase())),
    [selectedDiscrepancySkus, activeSkuSet]
  );

  const selectedItems = useMemo(() => {
    const set = new Set(validSelectedSkus.map((s) => s.trim().toUpperCase()));
    return activeDiscrepancies.filter((d) => set.has(d.sku.trim().toUpperCase()));
  }, [activeDiscrepancies, validSelectedSkus]);

  const totalSelectedVariance = useMemo(
    () => selectedItems.reduce((acc, item) => acc + item.varianceUnits, 0),
    [selectedItems]
  );

  const handleSelectAllVisible = () => {
    const visibleSkus = filteredDiscrepancies.map((d) => d.sku.trim().toUpperCase());
    setSelectedDiscrepancySkus((prev) => Array.from(new Set([...prev, ...visibleSkus])));
  };

  const handleSelectCritical = () => {
    const criticalSkus = activeDiscrepancies
      .filter((d) => d.severity === 'critical')
      .map((d) => d.sku.trim().toUpperCase());
    setSelectedDiscrepancySkus(criticalSkus);
  };

  const handleClearSelection = () => {
    setSelectedDiscrepancySkus([]);
  };

  const handleExecuteBatchReconcile = async () => {
    if (validSelectedSkus.length === 0 || !auditNote.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await batchClearAndReconcileDiscrepancies(
        validSelectedSkus,
        auditNote.trim()
      );
      if (result.success) {
        setReceipt({
          reconciledCount: result.reconciledCount,
          skus: result.skus,
          auditNote: result.auditNote,
          timestamp: new Date(result.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        });
        onFinishedSuccess?.(
          `Batch Clear & Reconcile completed for ${result.reconciledCount} SKU(s) with audit note: "${result.auditNote}".`
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSeverityPill = (severity: ChartSkuDiscrepancy['severity']) => {
    if (severity === 'critical') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-rose-500/25 text-rose-200 border border-rose-500/50">
          Critical
        </span>
      );
    }
    if (severity === 'high') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-orange-500/20 text-orange-200 border border-orange-500/45">
          High
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-200 border border-amber-500/40">
        Elevated
      </span>
    );
  };

  return (
    <div id="warehouse-batch-reconcile-panel" className="space-y-5">
      {/* Banner Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-950/35 via-neutral-900/90 to-neutral-900 border border-orange-500/35 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/40 text-orange-400 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-tight">
                Batch Reconcile Utility
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-orange-500/20 text-orange-200 border border-orange-500/40">
                {activeDiscrepancies.length} Chart Discrepanc{activeDiscrepancies.length === 1 ? 'y' : 'ies'} Active
              </span>
              {validSelectedSkus.length > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {validSelectedSkus.length} Selected for Bulk Clear
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select multiple SKU discrepancies flagged in the Warehouse Inventory Chart and clear regional conflicts, QA holds, and cycle variances together under one unified audit note.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-center">
            <span className="block text-[9px] text-neutral-500 uppercase">Selected SKUs</span>
            <span className="text-sm font-bold text-emerald-400">{validSelectedSkus.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-center">
            <span className="block text-[9px] text-neutral-500 uppercase">Variance Scope</span>
            <span className="text-sm font-bold text-orange-300">±{totalSelectedVariance}u</span>
          </div>
        </div>
      </div>

      {/* Confirmation Receipt Banner */}
      {receipt && (
        <div
          id="batch-reconcile-receipt-banner"
          className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/45 space-y-2 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Bulk Clear &amp; Reconcile Applied ({receipt.reconciledCount} SKU{receipt.reconciledCount === 1 ? '' : 's'})
              </span>
              <span className="text-[10px] font-mono text-emerald-400/80">
                at {receipt.timestamp}
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
          <p className="text-xs text-neutral-200">
            <strong className="text-emerald-300">Audit Note Recorded:</strong> &ldquo;{receipt.auditNote}&rdquo;
          </p>
          <div className="flex flex-wrap gap-1.5">
            {receipt.skus.map((sku) => (
              <span
                key={`rec-${sku}`}
                className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/15 text-emerald-200 border border-emerald-500/35"
              >
                ✓ {sku}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeDiscrepancies.length === 0 ? (
        <div className="p-10 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">
            All Inventory Chart Discrepancies Reconciled
          </h4>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Zero unresolved regional conflicts, quarantine/damaged holds, or cycle-count variances remain across the warehouse network.
          </p>
          {onSwitchToInventory && (
            <button
              type="button"
              onClick={onSwitchToInventory}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-emerald-400" />
              <span>Return to Inventory &amp; SKUs</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Selectable Chart SKU Discrepancies */}
          <div className="lg:col-span-7 space-y-3">
            {/* Search & Quick Selection Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="batch-reconcile-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter discrepancy SKUs, warehouse, or reason..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/60"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="batch-reconcile-select-all-btn"
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] font-mono text-neutral-200 cursor-pointer transition-colors"
                >
                  Select All ({filteredDiscrepancies.length})
                </button>
                <button
                  type="button"
                  id="batch-reconcile-select-critical-btn"
                  onClick={handleSelectCritical}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-[11px] font-mono text-rose-200 cursor-pointer transition-colors"
                >
                  Critical Only
                </button>
                {validSelectedSkus.length > 0 && (
                  <button
                    type="button"
                    id="batch-reconcile-clear-selection-btn"
                    onClick={handleClearSelection}
                    className="px-2 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[11px] font-mono text-neutral-400 hover:text-white cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Type Filter Chips */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
              <span className="text-neutral-500 inline-flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" />
                Type:
              </span>
              {(['all', 'regional_conflict', 'quarantine_damaged', 'cycle_variance', 'pick_bin_shortage'] as const).map(
                (tKey) => {
                  const isActive = typeFilter === tKey;
                  const label = tKey === 'all' ? 'All Discrepancies' : TYPE_META[tKey].label;
                  return (
                    <button
                      key={tKey}
                      type="button"
                      onClick={() => setTypeFilter(tKey)}
                      className={`px-2 py-1 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-orange-500/20 text-orange-200 border-orange-500/50 font-bold'
                          : 'bg-neutral-900/70 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                      }`}
                    >
                      {label}
                    </button>
                  );
                }
              )}
            </div>

            {/* Discrepancy Checklist */}
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredDiscrepancies.length === 0 ? (
                <div className="p-6 rounded-xl bg-neutral-900/50 border border-neutral-800 text-center text-xs text-neutral-400">
                  No discrepancies match your current filter.
                </div>
              ) : (
                filteredDiscrepancies.map((item) => {
                  const isChecked = validSelectedSkus.includes(item.sku.trim().toUpperCase());
                  return (
                    <div
                      key={item.sku}
                      role="checkbox"
                      aria-checked={isChecked}
                      tabIndex={0}
                      id={`batch-reconcile-sku-row-${item.sku}`}
                      onClick={() => toggleDiscrepancySkuSelection(item.sku)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleDiscrepancySkuSelection(item.sku);
                        }
                      }}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? 'bg-orange-950/30 border-orange-500/65 ring-1 ring-orange-500/30'
                          : 'bg-neutral-900/60 hover:bg-neutral-900 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="pt-0.5 shrink-0">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-orange-400" />
                        ) : (
                          <Square className="w-4 h-4 text-neutral-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-sky-300">
                              {item.sku}
                            </span>
                            {renderSeverityPill(item.severity)}
                            {item.zones.map((z) => (
                              <span
                                key={`${item.sku}-${z}`}
                                className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700"
                              >
                                {z}
                              </span>
                            ))}
                          </div>
                          <span className="text-[10px] font-mono text-orange-300 font-bold">
                            ±{item.varianceUnits}u · {item.discrepancyCount} event{item.discrepancyCount === 1 ? '' : 's'}
                          </span>
                        </div>

                        <div className="text-xs font-semibold text-white truncate">
                          {item.productName}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {item.discrepancyTypes.map((dt) => (
                            <span
                              key={`${item.sku}-${dt}`}
                              className={`px-1.5 py-0.2 rounded border text-[9px] font-mono font-semibold ${TYPE_META[dt].badgeClass}`}
                            >
                              {TYPE_META[dt].label}
                            </span>
                          ))}
                          <span className="text-[10px] font-mono text-neutral-400 inline-flex items-center gap-1 ml-auto">
                            <MapPin className="w-2.5 h-2.5 text-neutral-500" />
                            {item.shortWarehouse}
                          </span>
                        </div>

                        <p className="text-[11px] text-neutral-400 leading-snug line-clamp-2">
                          {item.summaryReason}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Unified Audit Note & Bulk Clear & Reconcile Execution */}
          <div className="lg:col-span-5 flex flex-col justify-between p-4 rounded-2xl bg-neutral-900/75 border border-neutral-800 space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Bulk Clear &amp; Reconcile Action
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-neutral-400">
                  Single Audit Entry / SKU
                </span>
              </div>

              {/* What will be cleared summary */}
              <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800/90 space-y-2 text-[11px]">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <GitCompareArrows className="w-3.5 h-3.5 text-orange-400" />
                    Regional Ledger Conflicts
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedItems.filter((i) => i.discrepancyTypes.includes('regional_conflict')).length} SKU(s)
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    Quarantine / Damaged Holds
                  </span>
                  <span className="font-mono font-bold text-white">
                    {selectedItems.filter((i) => i.discrepancyTypes.includes('quarantine_damaged')).length} SKU(s)
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    Cycle / Bin Variances
                  </span>
                  <span className="font-mono font-bold text-white">
                    {
                      selectedItems.filter(
                        (i) =>
                          i.discrepancyTypes.includes('cycle_variance') ||
                          i.discrepancyTypes.includes('pick_bin_shortage')
                      ).length
                    }{' '}
                    SKU(s)
                  </span>
                </div>
              </div>

              {/* Single Audit Note Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="batch-reconcile-audit-note-input"
                    className="text-xs font-semibold text-neutral-200"
                  >
                    Unified Compliance Audit Note <span className="text-rose-400">*</span>
                  </label>
                  <VoiceDictationButton
                    onTranscript={(text) =>
                      setAuditNote((prev) => (prev ? `${prev} ${text}` : text))
                    }
                  />
                </div>

                <textarea
                  id="batch-reconcile-audit-note-input"
                  rows={3}
                  value={auditNote}
                  onChange={(e) => setAuditNote(e.target.value)}
                  placeholder="Enter a single reconciliation audit note applied to all selected SKUs..."
                  className="w-full p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 focus:border-emerald-500/70 text-xs text-white placeholder-neutral-500 focus:outline-none resize-none"
                />

                {/* Quick Audit Note Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase block">
                    Quick Audit Note Templates
                  </span>
                  <div className="flex flex-col gap-1">
                    {AUDIT_NOTE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAuditNote(preset)}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] border transition-colors cursor-pointer truncate ${
                          auditNote === preset
                            ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/45 font-semibold'
                            : 'bg-neutral-950/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800'
                        }`}
                        title={preset}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Bulk Clear & Reconcile Button */}
            <div className="space-y-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                id="batch-reconcile-submit-btn"
                disabled={validSelectedSkus.length === 0 || !auditNote.trim() || isSubmitting}
                onClick={handleExecuteBatchReconcile}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-500 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Clearing &amp; Reconciling...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      Clear &amp; Reconcile{' '}
                      {validSelectedSkus.length > 0
                        ? `(${validSelectedSkus.length} SKU${validSelectedSkus.length === 1 ? '' : 's'})`
                        : 'Selected'}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              <p className="text-[10px] text-neutral-500 text-center">
                Logs an immutable reconciliation entry per SKU, clears Quarantine/Damaged flags, and syncs the Inventory Chart heatmap.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
