import React, { useState } from 'react';
import {
  FileText,
  X,
  Printer,
  Download,
  ShieldCheck,
  Layers,
  Sparkles,
  CheckCircle2,
  Sliders
} from 'lucide-react';
import { SkuAuditLogEntry } from '../types';

interface AuditLogExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sku: string;
  productName: string;
  warehouse: string;
  logs: SkuAuditLogEntry[];
}

export const AuditLogExportModal: React.FC<AuditLogExportModalProps> = ({
  isOpen,
  onClose,
  sku,
  productName,
  warehouse,
  logs
}) => {
  const [granularity, setGranularity] = useState<'compact' | 'full-forensic'>('compact');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const generatedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const reportRef = `ALX-${Math.floor(100000 + Math.random() * 900000)}`;

  const handleExecuteExport = (actionType: 'print' | 'json' | 'csv') => {
    if (actionType === 'print') {
      window.print();
      setSuccessMsg(`Initiated ${granularity === 'compact' ? 'Compact Summary' : 'Full Forensic Log'} PDF print generation (${reportRef}).`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } else if (actionType === 'json') {
      const payload = {
        reportReference: reportRef,
        granularityMode: granularity,
        sku,
        productName,
        warehouse,
        generatedAt,
        totalEntries: logs.length,
        entries: granularity === 'compact'
          ? logs.map(l => ({ timestamp: l.timestamp, operatorId: l.operatorId, adjustmentValue: l.adjustmentValue, reason: l.reason }))
          : logs
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${sku.toLowerCase()}-${granularity}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(`Downloaded ${granularity === 'compact' ? 'Compact Summary' : 'Full Forensic Log'} JSON report.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } else if (actionType === 'csv') {
      const headers = granularity === 'compact'
        ? 'Timestamp,SKU,OperatorID,AdjustmentValue,Reason\n'
        : 'Timestamp,SKU,OperatorID,AdjustmentValue,PreviousStock,NewStock,Reason,Warehouse,Batch,Notes\n';
      const rows = logs.map(l => {
        if (granularity === 'compact') {
          return `"${l.timestamp}","${l.sku}","${l.operatorId}",${l.adjustmentValue},"${l.reason}"`;
        }
        return `"${l.timestamp}","${l.sku}","${l.operatorId}",${l.adjustmentValue},${l.previousStock},${l.newStock},"${l.reason}","${l.warehouse}","${l.batchNumber || ''}","${l.notes || ''}"`;
      }).join('\n');

      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${sku.toLowerCase()}-${granularity}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(`Exported ${granularity === 'compact' ? 'Compact Summary' : 'Full Forensic Log'} CSV.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/80 via-neutral-900 to-neutral-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Export Audit Log</h2>
              <p className="text-xs text-neutral-400">
                Choose data granularity for SKU <strong className="text-sky-400 font-mono">{sku}</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 px-6 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Granularity Selector Body */}
        <div className="p-6 space-y-4 text-xs">
          <label className="text-[11px] font-mono uppercase text-neutral-400 block">
            Select Report Data Granularity:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Compact Summary Card */}
            <div
              onClick={() => setGranularity('compact')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                granularity === 'compact'
                  ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-950/40'
                  : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">Compact Summary</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    Management
                  </span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  High-level overview including timestamps, operator IDs, adjustment values, and basic reasons. Ideal for executive review.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-800/80 font-mono text-[10px] text-neutral-500">
                Fields: 5 core telemetry columns
              </div>
            </div>

            {/* Full Forensic Log Card */}
            <div
              onClick={() => setGranularity('full-forensic')}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                granularity === 'full-forensic'
                  ? 'bg-sky-500/15 border-sky-500/60 shadow-lg shadow-sky-950/40'
                  : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-white text-sm">Full Forensic Log</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                    Compliance
                  </span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  Comprehensive ledger including previous/new stock balances, warehouse IDs, batch numbers, quarantine flags, and staff audit notes.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-800/80 font-mono text-[10px] text-sky-400 font-semibold">
                Fields: 10 full audit dimensions
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-400 font-mono">
            {logs.length} ledger entries ready for {granularity} export
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExecuteExport('csv')}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => handleExecuteExport('json')}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors cursor-pointer"
            >
              Export JSON
            </button>
            <button
              type="button"
              id="execute-audit-pdf-print-btn"
              onClick={() => handleExecuteExport('print')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Export PDF Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
