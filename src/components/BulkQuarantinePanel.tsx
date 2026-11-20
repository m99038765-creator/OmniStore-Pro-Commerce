import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  RefreshCw,
  ClipboardCheck,
  MapPin
} from 'lucide-react';
import { Product } from '../types';
import { VoiceDictationButton } from './VoiceDictationButton';

interface BulkQuarantinePanelProps {
  isOpen: boolean;
  selectedProducts: Product[];
  quarantinedProductIds: Set<string>;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, notes: string) => Promise<void>;
}

const QUARANTINE_REASON_PRESETS = [
  'QA Inspection & Defect Isolation Hold',
  'Transit / Pallet Impact Assessment',
  'Supplier Recall / Firmware Compliance Hold',
  'Environmental / Moisture Exposure Check',
  'Lot Serial Mismatch Investigation'
];

export const BulkQuarantinePanel: React.FC<BulkQuarantinePanelProps> = ({
  isOpen,
  selectedProducts,
  quarantinedProductIds,
  isSubmitting,
  onCancel,
  onConfirm
}) => {
  const [reason, setReason] = useState<string>(QUARANTINE_REASON_PRESETS[0]);
  const [notes, setNotes] = useState<string>('');

  if (!isOpen || selectedProducts.length === 0) return null;

  const alreadyQuarantinedCount = selectedProducts.filter(p =>
    quarantinedProductIds.has(p.id)
  ).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;
    await onConfirm(reason.trim(), notes.trim());
    setNotes('');
  };

  return (
    <form
      id="batch-bulk-quarantine-panel"
      onSubmit={handleSubmit}
      className="rounded-2xl bg-gradient-to-br from-rose-950/80 via-neutral-950 to-amber-950/40 border-2 border-rose-500/75 p-4 sm:p-5 shadow-xl shadow-rose-950/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-rose-500/25 border border-rose-400/60 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
            <ShieldAlert className="w-5 h-5 stroke-[2.25]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-white">
                Bulk Quarantine Hold ({selectedProducts.length} SKU{selectedProducts.length === 1 ? '' : 's'})
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/50 uppercase">
                Status: Under Quarantine
              </span>
              {alreadyQuarantinedCount > 0 && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40">
                  {alreadyQuarantinedCount} already flagged (will append fresh audit record)
                </span>
              )}
            </div>
            <p className="text-xs text-rose-200/85 mt-1">
              Marks every selected SKU as <strong className="text-white">Under Quarantine</strong> and writes an individual immutable audit log entry with your shared reason and note.
            </p>
          </div>
        </div>

        <button
          id="close-bulk-quarantine-panel-btn"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0"
          title="Cancel Bulk Quarantine"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Selected SKUs Preview */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block">
          Target SKUs Receiving Quarantine Audit Log Entries ({selectedProducts.length})
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
          {selectedProducts.map(prod => {
            const alreadyFlagged = quarantinedProductIds.has(prod.id);
            return (
              <span
                key={prod.id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono border ${
                  alreadyFlagged
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                    : 'bg-rose-950/60 border-rose-500/50 text-rose-100'
                }`}
              >
                <span className="font-bold">{prod.sku}</span>
                <span className="text-neutral-400 text-[10px]">({prod.stock}u)</span>
                <span className="inline-flex items-center gap-0.5 text-[9px] text-neutral-400">
                  <MapPin className="w-2.5 h-2.5" />
                  {prod.warehouse.split('(')[0].trim()}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Shared Quarantine Reason + Quick Presets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <div className="space-y-1.5">
          <label
            htmlFor="bulk-quarantine-reason-input"
            className="text-[11px] font-semibold text-rose-200 uppercase tracking-wider block"
          >
            Quarantine Reason (Required)
          </label>
          <input
            id="bulk-quarantine-reason-input"
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            placeholder="e.g. QA Inspection & Defect Isolation Hold"
            className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-rose-500/50 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-400 transition-colors"
          />
          <div className="flex flex-wrap gap-1 pt-0.5">
            {QUARANTINE_REASON_PRESETS.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors cursor-pointer ${
                  reason === preset
                    ? 'bg-rose-500/25 border-rose-400 text-rose-100 font-semibold'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Shared Audit Log Note */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="bulk-quarantine-note-input"
              className="text-[11px] font-semibold text-rose-200 uppercase tracking-wider block"
            >
              Shared Audit Log Note (Appended to Every SKU)
            </label>
            <VoiceDictationButton
              id="bulk-quarantine-voice-btn"
              onTranscript={spoken => setNotes(prev => (prev ? `${prev} ${spoken}` : spoken))}
              title="Dictate quarantine audit note hands-free"
            />
          </div>
          <textarea
            id="bulk-quarantine-note-input"
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe lot numbers, physical inspection findings, staging cage location, or hold instructions..."
            className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-rose-400 transition-colors resize-none font-mono"
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-rose-500/30">
        <div className="flex items-center gap-1.5 text-[11px] text-amber-200/90">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            Triggers {selectedProducts.length} individual audit log update{selectedProducts.length === 1 ? '' : 's'} &amp; raises Flagged Audit Alerts.
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="confirm-bulk-quarantine-btn"
            type="submit"
            disabled={isSubmitting || !reason.trim() || selectedProducts.length === 0}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-lg shadow-rose-950/60 transition-all cursor-pointer active:scale-95"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Applying Quarantine ({selectedProducts.length})...</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="w-3.5 h-3.5 stroke-[2.25]" />
                <span>Mark {selectedProducts.length} SKU{selectedProducts.length === 1 ? '' : 's'} Under Quarantine</span>
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};
