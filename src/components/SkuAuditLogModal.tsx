import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  UserCheck,
  Calendar,
  Clock,
  Warehouse,
  Boxes,
  Sliders,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Download,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Printer,
  ShieldAlert,
  Loader2,
  MessageSquarePlus,
  Activity
} from 'lucide-react';
import { Product, SkuAuditLogEntry } from '../types';
import { getAuditLogsForSku } from '../data/initialAuditLogs';
import { AuditLogExportModal } from './AuditLogExportModal';
import { SkuVarianceHistoryChart, buildSkuVarianceTimeline } from './SkuVarianceHistoryChart';
import { useStore } from '../context/StoreContext';
import {
  checkSkuAuditLogSafety,
  isAuditEntryQuarantineOrDamaged,
  isAuditEntryDamagedClearance,
  isAuditEntryQuarantineClearance
} from '../utils/skuAuditSafety';

interface SkuAuditLogModalProps {
  product?: Product | null;
  sku?: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenStockAdjust?: (product: Product) => void;
}

export const SkuAuditLogModal: React.FC<SkuAuditLogModalProps> = ({
  product,
  sku,
  isOpen,
  onClose,
  onOpenStockAdjust
}) => {
  const activeSku = (product?.sku || sku || '').trim();
  const productName = product?.name || 'Hardware Component';
  const currentStock = product?.stock ?? 0;
  const warehouse = product?.warehouse || 'Central Logistics Hub (WH-01)';

  const { warehouseAuditLogs, clearSkuAuditFlags, userProfile } = useStore();
  const [logs, setLogs] = useState<SkuAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClearingFlag, setIsClearingFlag] = useState<boolean>(false);
  const [isQuickClearOpen, setIsQuickClearOpen] = useState<boolean>(false);
  const [resolvedNoteInput, setResolvedNoteInput] = useState<string>('');
  const [quickClearTargetEntryId, setQuickClearTargetEntryId] = useState<string | null>(null);
  const [justClearedInfo, setJustClearedInfo] = useState<{ note: string; timestamp: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'positive' | 'negative' | 'cycle_count' | 'last_8h'>('all');
  const [copiedSku, setCopiedSku] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'ledger' | 'variance'>('ledger');

  const RESOLVED_NOTE_PRESETS = [
    'Resolved: Physical QA inspection passed — packaging replaced & verified intact.',
    'Resolved: Quarantine hold lifted after calibration and serial verification.',
    'Resolved: Damaged units isolated; remaining warehouse stock verified sellable.'
  ];

  // Evaluate safety status across the merged modal logs so both backend and store flags are detected
  const skuSafety = useMemo(
    () => checkSkuAuditLogSafety(activeSku, logs.length > 0 ? logs : warehouseAuditLogs),
    [activeSku, logs, warehouseAuditLogs]
  );

  const activeFlaggedEntryIds = useMemo(
    () => new Set(skuSafety.flaggedEntries.map(e => e.id)),
    [skuSafety.flaggedEntries]
  );

  const hasClearanceEntry = useMemo(
    () =>
      logs.some(
        entry =>
          isAuditEntryDamagedClearance(entry) || isAuditEntryQuarantineClearance(entry)
      ),
    [logs]
  );

  const mergeWithStoreLogs = (fetchedLogs: SkuAuditLogEntry[]): SkuAuditLogEntry[] => {
    const cleanActive = activeSku.toUpperCase().replace(/[-\s_]/g, '');
    const matchingStoreLogs = warehouseAuditLogs.filter(
      l =>
        l.sku.toUpperCase() === activeSku.toUpperCase() ||
        l.sku.toUpperCase().replace(/[-\s_]/g, '') === cleanActive
    );
    const byId = new Map<string, SkuAuditLogEntry>();
    for (const l of fetchedLogs) byId.set(l.id, l);
    for (const l of matchingStoreLogs) byId.set(l.id, l);
    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };

  // Fetch audit logs from server API or local fallback
  const fetchAuditLogs = async () => {
    if (!activeSku) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/inventory/audit-logs/${encodeURIComponent(activeSku)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(mergeWithStoreLogs(data.logs));
          setIsLoading(false);
          return;
        }
      }
      // Fallback if API returns empty or non-200
      const fallbackLogs = getAuditLogsForSku(activeSku, currentStock, productName);
      setLogs(mergeWithStoreLogs(fallbackLogs));
    } catch (err: any) {
      // Local fallback on fetch failure (offline / sandboxed)
      const fallbackLogs = getAuditLogsForSku(activeSku, currentStock, productName);
      setLogs(mergeWithStoreLogs(fallbackLogs));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeSku) {
      fetchAuditLogs();
    }
  }, [isOpen, activeSku, warehouseAuditLogs]);

  // Reset inline quick-clear composer & tab when modal closes or SKU changes
  useEffect(() => {
    if (!isOpen) {
      setIsQuickClearOpen(false);
      setResolvedNoteInput('');
      setQuickClearTargetEntryId(null);
      setJustClearedInfo(null);
      setActiveTab('ledger');
    }
  }, [isOpen, activeSku]);

  const openQuickClearPanel = (entry?: SkuAuditLogEntry) => {
    setQuickClearTargetEntryId(entry?.id || null);
    if (!resolvedNoteInput.trim()) {
      const flagCheck = entry ? isAuditEntryQuarantineOrDamaged(entry) : null;
      const defaultNote =
        flagCheck?.isQuarantine && !flagCheck?.isDamaged
          ? 'Resolved: Quarantine inspection passed; SKU verified compliant and cleared for active fulfillment.'
          : flagCheck?.isDamaged && !flagCheck?.isQuarantine
          ? 'Resolved: Damaged unit isolated and verified; remaining inventory cleared for release.'
          : 'Resolved: Manager verified item condition and cleared Quarantine / Damage flags.';
      setResolvedNoteInput(defaultNote);
    }
    setIsQuickClearOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('quick-clear-resolved-note-input')?.focus();
    });
  };

  const handleConfirmQuickClear = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSku || isClearingFlag) return;

    const noteToAppend =
      resolvedNoteInput.trim() ||
      'Resolved: Manager verified item condition and cleared Quarantine / Damage flags.';
    const managerName = userProfile?.displayName || 'Warehouse Manager';

    setIsClearingFlag(true);
    const ok = await clearSkuAuditFlags(activeSku, managerName, noteToAppend);
    setIsClearingFlag(false);

    if (ok) {
      const formattedNote = noteToAppend.toLowerCase().startsWith('resolved')
        ? noteToAppend
        : `Resolved: ${noteToAppend}`;
      setJustClearedInfo({
        note: formattedNote,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      setIsQuickClearOpen(false);
      setResolvedNoteInput('');
      setQuickClearTargetEntryId(null);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Copy SKU helper
  const handleCopySku = () => {
    if (!activeSku) return;
    navigator.clipboard.writeText(activeSku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  // Copy CSV export
  const handleCopyCsv = () => {
    if (logs.length === 0) return;
    const headers = 'Timestamp,SKU,OperatorID,AdjustmentValue,PreviousStock,NewStock,Reason,Warehouse,Batch\n';
    const rows = logs
      .map(
        l =>
          `"${l.timestamp}","${l.sku}","${l.operatorId}",${l.adjustmentValue},${l.previousStock},${l.newStock},"${l.reason}","${l.warehouse}","${l.batchNumber || ''}"`
      )
      .join('\n');
    navigator.clipboard.writeText(headers + rows);
    setCopiedCsv(true);
    setTimeout(() => setCopiedCsv(false), 2500);
  };

  // Download JSON audit history for compliance reporting
  const handleDownloadJson = () => {
    if (logs.length === 0) return;
    const payload = {
      sku: activeSku,
      productName,
      warehouse,
      generatedAt: new Date().toISOString(),
      totalEntries: logs.length,
      auditLedgerEntries: logs
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sku-audit-history-${activeSku.toLowerCase().replace(/[^a-z0-9]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open granular export modal allowing Compact Summary or Full Forensic Log
  const handleExportPdf = () => {
    if (logs.length === 0) return;
    setIsExportModalOpen(true);
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Type filtering
      if (typeFilter === 'positive' && log.adjustmentValue <= 0) return false;
      if (typeFilter === 'negative' && log.adjustmentValue >= 0) return false;
      if (typeFilter === 'cycle_count' && log.adjustmentType !== 'cycle_count') return false;
      if (typeFilter === 'last_8h') {
        const logTime = new Date(log.timestamp).getTime();
        const eightHoursAgo = Date.now() - 8 * 60 * 60 * 1000;
        // If timestamp is invalid or older than 8 hours, exclude (with fallback for demo logs)
        if (!isNaN(logTime) && logTime < eightHoursAgo) return false;
      }

      // Text query filtering
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        log.operatorId.toLowerCase().includes(q) ||
        (log.operatorName && log.operatorName.toLowerCase().includes(q)) ||
        log.reason.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q)) ||
        (log.batchNumber && log.batchNumber.toLowerCase().includes(q))
      );
    });
  }, [logs, typeFilter, searchFilter]);

  // Metrics calculations
  const totalNetDelta = useMemo(() => {
    return logs.reduce((acc, curr) => acc + curr.adjustmentValue, 0);
  }, [logs]);

  const varianceDiscrepancyCount = useMemo(() => {
    return buildSkuVarianceTimeline(logs, currentStock).filter(p => p.isDiscrepancyEvent).length;
  }, [logs, currentStock]);

  if (!isOpen) return null;

  return (
    <div
      id="sku-audit-log-backdrop"
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="sku-audit-log-modal"
        className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-tight">
                  SKU Stock Adjustment Audit Log
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                  Verified Ledger
                </span>
                {!skuSafety.isSafe ? (
                  <span
                    id="audit-modal-status-badge"
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/45 flex items-center gap-1"
                  >
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    Status: {skuSafety.statusLabel}
                  </span>
                ) : hasClearanceEntry || justClearedInfo ? (
                  <span
                    id="audit-modal-status-badge"
                    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/45 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Status: Cleared
                  </span>
                ) : (
                  <span
                    id="audit-modal-status-badge"
                    className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Status: Clean
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <button
                  type="button"
                  id="audit-modal-copy-sku-btn"
                  onClick={handleCopySku}
                  className="inline-flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors cursor-pointer"
                  title="Click to copy SKU"
                >
                  <span>{activeSku || 'NO-SKU'}</span>
                  {copiedSku ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-sky-400" />
                  )}
                </button>
                <span className="text-xs text-neutral-400 truncate max-w-[280px] sm:max-w-md">
                  {productName}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!skuSafety.isSafe && (
              <button
                type="button"
                id="quick-clear-flagged-sku-btn"
                onClick={() => openQuickClearPanel(skuSafety.primaryFlaggedEntry)}
                disabled={isClearingFlag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-neutral-950 font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-95"
                title={`Append a Resolved note and automatically update ${activeSku} audit status to Cleared`}
              >
                <ShieldCheck className="w-3.5 h-3.5 stroke-[2.25]" />
                <span>Quick-Clear Flagged SKU</span>
              </button>
            )}
            <button
              id="refresh-audit-log-btn"
              type="button"
              onClick={fetchAuditLogs}
              disabled={isLoading}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Refresh audit records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              id="close-sku-audit-log-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Flagged SKU Inline Quick-Clear Banner & Resolved Note Composer */}
        {!skuSafety.isSafe && (
          <div
            id="quick-clear-flagged-banner"
            className="px-4 sm:px-5 py-3 bg-rose-950/35 border-b border-rose-500/35 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-rose-200 font-semibold">
                  Active Audit Flag: <strong className="text-white">{skuSafety.statusLabel}</strong>
                </span>
                <span className="text-[11px] font-mono text-rose-300/80 hidden sm:inline">
                  ({skuSafety.flaggedEntries.length} flagged entr{skuSafety.flaggedEntries.length === 1 ? 'y' : 'ies'})
                </span>
              </div>

              {!isQuickClearOpen && (
                <button
                  type="button"
                  id="banner-quick-clear-flagged-sku-btn"
                  onClick={() => openQuickClearPanel(skuSafety.primaryFlaggedEntry)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/45 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Quick-Clear Flagged SKU</span>
                </button>
              )}
            </div>

            {isQuickClearOpen && (
              <form
                id="quick-clear-resolved-note-form"
                onSubmit={handleConfirmQuickClear}
                className="p-3 rounded-xl bg-neutral-950/90 border border-emerald-500/40 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="quick-clear-resolved-note-input"
                    className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Append &lsquo;Resolved&rsquo; Note &amp; Update Status to Cleared</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsQuickClearOpen(false);
                      setQuickClearTargetEntryId(null);
                    }}
                    className="text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <textarea
                  id="quick-clear-resolved-note-input"
                  rows={2}
                  value={resolvedNoteInput}
                  onChange={e => setResolvedNoteInput(e.target.value)}
                  placeholder="Resolved: Enter verification details to clear quarantine or damage status..."
                  required
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-neutral-500">Quick presets:</span>
                  {RESOLVED_NOTE_PRESETS.map((preset, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setResolvedNoteInput(preset)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 transition-colors cursor-pointer truncate max-w-[230px]"
                      title={preset}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[10px] font-mono text-neutral-400">
                    Clearing as: <strong className="text-neutral-200">{userProfile?.displayName || 'Warehouse Manager'}</strong>
                  </span>
                  <button
                    type="submit"
                    id="confirm-quick-clear-sku-btn"
                    disabled={isClearingFlag || !resolvedNoteInput.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition-all cursor-pointer active:scale-95"
                  >
                    {isClearingFlag ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Status...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.25]" />
                        <span>Save Resolved Note &amp; Mark Cleared</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Confirmation Banner After Quick-Clear Succeeds */}
        {justClearedInfo && skuSafety.isSafe && (
          <div
            id="quick-clear-success-banner"
            className="px-4 sm:px-5 py-2.5 bg-emerald-950/50 border-b border-emerald-500/40 flex items-center justify-between gap-2 text-xs text-emerald-200"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">
                <strong className="text-emerald-300">Audit Status Updated to Cleared</strong> — {justClearedInfo.note}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJustClearedInfo(null)}
              className="text-[11px] text-emerald-300 hover:text-white shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Quick Metrics Bar */}
        <div className="p-3 sm:px-5 bg-neutral-950/40 border-b border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">Current Stock</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-mono font-bold text-white">{currentStock}</span>
              <span className="text-[10px] text-neutral-400">units</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">Audit Entries</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-mono font-bold text-amber-400">{logs.length}</span>
              <span className="text-[10px] text-neutral-400">recorded</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">Net Audit Delta</span>
            <div className="flex items-baseline gap-1 mt-0.5 font-mono font-bold">
              <span className={`text-base ${totalNetDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalNetDelta >= 0 ? `+${totalNetDelta}` : totalNetDelta}
              </span>
              <span className="text-[10px] font-sans font-normal text-neutral-400">units</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
            <span className="text-[10px] uppercase font-mono text-neutral-500 block">Fulfillment Hub</span>
            <div className="flex items-center gap-1 mt-1 text-neutral-300 font-medium truncate">
              <Warehouse className="w-3 h-3 text-neutral-400 shrink-0" />
              <span className="truncate text-[11px]">{warehouse.split('(')[0].trim()}</span>
            </div>
          </div>
        </div>

        {/* Modal View Tabs: Audit Ledger vs. Variance History */}
        <div
          id="sku-audit-modal-tabs"
          className="px-4 sm:px-5 pt-2.5 bg-neutral-950/60 border-b border-neutral-800 flex items-center justify-between gap-2 flex-wrap"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              id="sku-audit-tab-ledger"
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'ledger'
                  ? 'border-amber-400 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <ClipboardList className={`w-3.5 h-3.5 ${activeTab === 'ledger' ? 'text-amber-400' : 'text-neutral-500'}`} />
              <span>Audit Ledger</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                {logs.length}
              </span>
            </button>

            <button
              type="button"
              id="sku-audit-tab-variance"
              onClick={() => setActiveTab('variance')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'variance'
                  ? 'border-sky-400 text-white'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Activity className={`w-3.5 h-3.5 ${activeTab === 'variance' ? 'text-sky-400' : 'text-neutral-500'}`} />
              <span>Variance History</span>
              {varianceDiscrepancyCount > 0 ? (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/45">
                  {varianceDiscrepancyCount}
                </span>
              ) : (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                  0
                </span>
              )}
            </button>
          </div>

          <span className="text-[10px] font-mono text-neutral-500 pb-2 hidden sm:inline">
            {activeTab === 'variance'
              ? 'Recharts dual-axis stock count vs. discrepancy timeline'
              : 'Filterable chronological adjustment records'}
          </span>
        </div>

        {activeTab === 'variance' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <SkuVarianceHistoryChart
              sku={activeSku}
              logs={logs}
              currentStock={currentStock}
              lowStockThreshold={product?.lowStockThreshold}
              isLoading={isLoading}
            />
          </div>
        ) : (
          <>
        {/* Filter & Search Bar */}
        <div className="p-3 sm:px-5 border-b border-neutral-800 bg-neutral-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              id="sku-audit-search-input"
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search by Operator ID (e.g. OP-8821), reason, batch..."
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-neutral-950 p-0.5 rounded-xl border border-neutral-800 text-[11px]">
              <button
                type="button"
                id="filter-audit-all-btn"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                All ({logs.length})
              </button>
              <button
                type="button"
                id="filter-audit-positive-btn"
                onClick={() => setTypeFilter('positive')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'positive'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-emerald-400'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>Added</span>
              </button>
              <button
                type="button"
                id="filter-audit-negative-btn"
                onClick={() => setTypeFilter('negative')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'negative'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-rose-400'
                }`}
              >
                <TrendingDown className="w-3 h-3" />
                <span>Reduced</span>
              </button>
              <button
                type="button"
                id="filter-audit-cycle-count-btn"
                onClick={() => setTypeFilter('cycle_count')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                  typeFilter === 'cycle_count'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-amber-400'
                }`}
              >
                Cycle Count
              </button>
              <button
                type="button"
                id="filter-audit-last-8h-btn"
                onClick={() => setTypeFilter('last_8h')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  typeFilter === 'last_8h'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
                    : 'text-neutral-400 hover:text-sky-400'
                }`}
                title="View modifications that occurred within the last 8 hours (Current Shift)"
              >
                <Clock className="w-3 h-3 text-sky-400" />
                <span>Last 8 Hours</span>
              </button>
            </div>

            <button
              type="button"
              id="export-audit-csv-btn"
              onClick={handleCopyCsv}
              className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-850 text-neutral-400 hover:text-neutral-200 transition-colors text-xs flex items-center gap-1 cursor-pointer"
              title="Copy CSV to clipboard"
            >
              {copiedCsv ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-[10px] hidden sm:inline">CSV</span>
                </>
              )}
            </button>

            <button
              type="button"
              id="download-audit-json-btn"
              onClick={handleDownloadJson}
              className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors text-xs flex items-center gap-1.5 cursor-pointer font-medium"
              title="Download full audit history ledger as a JSON file for compliance reporting"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px]">Download Audit History (JSON)</span>
            </button>
          </div>
        </div>

        {/* Scrollable Audit Log Entries List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
              <p className="text-xs text-neutral-400 font-mono">
                Fetching authoritative stock adjustment ledger for SKU: {activeSku}...
              </p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2 p-6 rounded-2xl bg-neutral-950/60 border border-neutral-800/80">
              <AlertCircle className="w-8 h-8 text-neutral-500 mb-1" />
              <h4 className="text-sm font-semibold text-neutral-300">No Adjustment Records Found</h4>
              <p className="text-xs text-neutral-500 max-w-sm">
                No stock adjustments match your active filters. Clear search or filter to see all historical entries.
              </p>
              {(searchFilter || typeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchFilter('');
                    setTypeFilter('all');
                  }}
                  className="mt-2 text-xs font-medium text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Reset search & filters
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((entry, index) => {
              const isPositive = entry.adjustmentValue > 0;
              const isNegative = entry.adjustmentValue < 0;
              const entryFlag = isAuditEntryQuarantineOrDamaged(entry);
              const isClearanceRecord =
                isAuditEntryDamagedClearance(entry) || isAuditEntryQuarantineClearance(entry);
              const isActivelyFlaggedEntry =
                entryFlag.isFlagged && activeFlaggedEntryIds.has(entry.id);
              const isPreviouslyClearedFlag =
                entryFlag.isFlagged && !activeFlaggedEntryIds.has(entry.id);

              const formattedDate = new Date(entry.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              return (
                <div
                  key={`${entry.id}-${index}`}
                  id={`audit-log-entry-${entry.id}`}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all space-y-3 shadow-xs ${
                    isActivelyFlaggedEntry
                      ? 'bg-rose-950/20 border-rose-500/45 hover:border-rose-400/70'
                      : isClearanceRecord
                      ? 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400/60'
                      : 'bg-neutral-950 border-neutral-800/90 hover:border-neutral-700'
                  }`}
                >
                  {/* Row 1: Adjustment Value + Flag/Cleared Status + Timestamp */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Adjustment Value Badge */}
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-lg border ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : isNegative
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isNegative ? (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        ) : (
                          <Boxes className="w-3.5 h-3.5 text-neutral-400" />
                        )}
                        <span>
                          {isPositive ? `+${entry.adjustmentValue}` : entry.adjustmentValue} units
                        </span>
                      </span>

                      {/* Previous to New Stock Progression */}
                      <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                        <span className="bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                          {entry.previousStock}
                        </span>
                        <ArrowRight className="w-3 h-3 text-neutral-500" />
                        <span className="bg-neutral-900 text-white font-bold px-1.5 py-0.5 rounded border border-neutral-800">
                          {entry.newStock}
                        </span>
                      </div>

                      {/* Quarantine / Damage / Cleared Status Pill */}
                      {isActivelyFlaggedEntry && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/45">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>{entryFlag.statusLabel}</span>
                        </span>
                      )}
                      {isPreviouslyClearedFlag && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          <span>{entryFlag.statusLabel} · Cleared</span>
                        </span>
                      )}
                      {isClearanceRecord && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/45">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>Cleared</span>
                        </span>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-400">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  {/* Row 2: Warehouse Operator ID & Reason */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-neutral-850">
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block">
                          Warehouse Operator ID
                        </span>
                        <span className="font-mono text-xs font-semibold text-neutral-200">
                          {entry.operatorId}
                        </span>
                        {entry.operatorName && (
                          <span className="text-[11px] text-neutral-400 block">
                            {entry.operatorName}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 shrink-0 mt-0.5">
                        <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-mono block">
                          Reason / Trigger
                        </span>
                        <span className="text-xs text-neutral-200 font-medium">
                          {entry.reason}
                        </span>
                        {entry.batchNumber && (
                          <span className="text-[10px] font-mono text-neutral-500 block">
                            Batch: {entry.batchNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes / Details if any */}
                  {entry.notes && (
                    <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-2 rounded-lg border border-neutral-850">
                      <span className="text-neutral-500 font-mono mr-1">Audit Note:</span>
                      {entry.notes}
                    </div>
                  )}

                  {/* Per-Entry Quick-Clear Action for Active Quarantine / Damage Flags */}
                  {isActivelyFlaggedEntry && (
                    <div className="pt-2 border-t border-rose-500/25 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-rose-300/90">
                        Flagged entry requires manager resolution to restore Cleared status.
                      </span>
                      <button
                        type="button"
                        id={`quick-clear-entry-btn-${entry.id}`}
                        onClick={() => openQuickClearPanel(entry)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                          quickClearTargetEntryId === entry.id && isQuickClearOpen
                            ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/60'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-xs'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 stroke-[2.25]" />
                        <span>Quick-Clear Flagged SKU</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
          </>
        )}

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Immutable warehouse cycle audit trail</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="sku-audit-export-pdf-btn"
              onClick={handleExportPdf}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Generate comprehensive PDF report containing historical modifications, quarantine flags, and staff notes"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Audit Log (PDF)</span>
            </button>

            {product && onOpenStockAdjust && (
              <button
                type="button"
                id="audit-adjust-stock-now-btn"
                onClick={() => {
                  onClose();
                  onOpenStockAdjust(product);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3 h-3 text-emerald-400" />
                <span>Adjust Stock</span>
              </button>
            )}

            <button
              type="button"
              id="close-audit-modal-footer-btn"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Granular Audit Log Export Modal */}
      <AuditLogExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        sku={activeSku}
        productName={productName}
        warehouse={warehouse}
        logs={logs}
      />
    </div>
  );
};
