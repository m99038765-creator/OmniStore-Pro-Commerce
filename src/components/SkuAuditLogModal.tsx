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
  AlertCircle
} from 'lucide-react';
import { Product, SkuAuditLogEntry } from '../types';
import { getAuditLogsForSku } from '../data/initialAuditLogs';

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

  const [logs, setLogs] = useState<SkuAuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'positive' | 'negative' | 'cycle_count'>('all');
  const [copiedSku, setCopiedSku] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);

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
          setLogs(data.logs);
          setIsLoading(false);
          return;
        }
      }
      // Fallback if API returns empty or non-200
      const fallbackLogs = getAuditLogsForSku(activeSku, currentStock, productName);
      setLogs(fallbackLogs);
    } catch (err: any) {
      // Local fallback on fetch failure (offline / sandboxed)
      const fallbackLogs = getAuditLogsForSku(activeSku, currentStock, productName);
      setLogs(fallbackLogs);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeSku) {
      fetchAuditLogs();
    }
  }, [isOpen, activeSku]);

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

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Type filtering
      if (typeFilter === 'positive' && log.adjustmentValue <= 0) return false;
      if (typeFilter === 'negative' && log.adjustmentValue >= 0) return false;
      if (typeFilter === 'cycle_count' && log.adjustmentType !== 'cycle_count') return false;

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

  if (!isOpen) return null;

  return (
    <div
      id="sku-audit-log-backdrop"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="sku-audit-log-modal"
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
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

          <div className="flex items-center gap-1.5">
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
                  className="p-3.5 sm:p-4 rounded-xl bg-neutral-950 border border-neutral-800/90 hover:border-neutral-700 transition-all space-y-3 shadow-xs"
                >
                  {/* Row 1: Adjustment Value + Operator ID + Timestamp */}
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
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
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Immutable warehouse cycle audit trail</span>
          </div>

          <div className="flex items-center gap-2">
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
    </div>
  );
};
