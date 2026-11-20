import React, { useState, useEffect, useRef } from 'react';
import { StickyNote, Wrench, Pencil, Check, X, Trash2 } from 'lucide-react';
import { Product, SkuWarehouseNote } from '../types';

interface ProductCardWarehouseNoteProps {
  product: Product;
  note: SkuWarehouseNote | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveNote: (text: string) => Promise<void>;
}

const INSTRUCTION_CHIPS = [
  'Keep upright',
  'ESD-safe bay',
  'Dry cabinet <40% RH',
  'Do not stack'
];

function formatShortTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const ProductCardWarehouseNote: React.FC<ProductCardWarehouseNoteProps> = ({
  product,
  note,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaveNote
}) => {
  const [draft, setDraft] = useState(note?.text || '');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(note?.text || '');
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        const len = (note?.text || '').length;
        textareaRef.current?.setSelectionRange(len, len);
      });
    }
  }, [isEditing, note?.text]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveNote(draft);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSaveNote('');
    } finally {
      setIsSaving(false);
    }
  };

  const appendChip = (chip: string) => {
    setDraft(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return `${chip}.`;
      if (trimmed.toLowerCase().includes(chip.toLowerCase())) return prev;
      const sep = trimmed.endsWith('.') || trimmed.endsWith(';') ? ' ' : '; ';
      return `${trimmed}${sep}${chip}.`.slice(0, 240);
    });
    textareaRef.current?.focus();
  };

  if (isEditing) {
    return (
      <div
        id={`sku-note-editor-${product.id}`}
        onClick={e => e.stopPropagation()}
        className="mt-2.5 p-2.5 rounded-xl bg-neutral-950 border border-amber-500/60 shadow-lg shadow-amber-950/30 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`sku-note-textarea-${product.id}`}
            className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1"
          >
            <Wrench className="w-3 h-3 text-amber-400" />
            <span>Storage &amp; Maintenance Note</span>
          </label>
          <span className="text-[9px] font-mono text-neutral-500">{draft.length}/240</span>
        </div>

        <textarea
          ref={textareaRef}
          id={`sku-note-textarea-${product.id}`}
          rows={2}
          maxLength={240}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancelEdit();
            } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
          }}
          placeholder="Leave maintenance, calibration, or storage instructions for warehouse staff..."
          className="w-full bg-neutral-900 border border-neutral-700/90 focus:border-amber-400 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-neutral-500 focus:outline-none resize-none leading-snug"
        />

        {/* Quick Instruction Chips */}
        <div className="flex flex-wrap gap-1">
          {INSTRUCTION_CHIPS.map(chip => (
            <button
              key={chip}
              type="button"
              onClick={() => appendChip(chip)}
              className="px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-500/40 text-[9px] font-mono text-neutral-300 hover:text-amber-200 transition-colors cursor-pointer"
            >
              + {chip}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          {note ? (
            <button
              id={`clear-sku-note-btn-${product.id}`}
              type="button"
              onClick={handleClear}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-rose-300 hover:text-rose-200 hover:bg-rose-500/15 transition-colors cursor-pointer disabled:opacity-50"
              title="Remove note"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          ) : (
            <span className="text-[9px] font-mono text-neutral-500">Ctrl+Enter to save</span>
          )}

          <div className="flex items-center gap-1.5 ml-auto">
            <button
              id={`cancel-sku-note-btn-${product.id}`}
              type="button"
              onClick={onCancelEdit}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[10px] font-semibold text-neutral-300 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Cancel</span>
            </button>
            <button
              id={`save-sku-note-btn-${product.id}`}
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[10px] transition-colors cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="w-3 h-3 stroke-[2.5]" />
              <span>{isSaving ? 'Saving...' : 'Save Note'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div
        id={`product-card-note-${product.id}`}
        onClick={e => {
          e.stopPropagation();
          onStartEdit();
        }}
        className="mt-2.5 p-2.5 rounded-xl bg-amber-950/25 hover:bg-amber-950/35 border border-amber-500/35 hover:border-amber-400/60 transition-colors cursor-pointer group/note space-y-1"
        title="Click to edit maintenance or storage instructions"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
            <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Storage / Maint. Note</span>
          </span>
          <button
            id={`edit-sku-note-btn-${product.id}`}
            type="button"
            onClick={e => {
              e.stopPropagation();
              onStartEdit();
            }}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300/80 group-hover/note:text-amber-200 px-1.5 py-0.5 rounded bg-amber-500/10 group-hover/note:bg-amber-500/20 border border-amber-500/25 transition-colors cursor-pointer"
          >
            <Pencil className="w-2.5 h-2.5" />
            <span>Edit</span>
          </button>
        </div>

        <p className="text-[11px] text-amber-100/90 leading-snug line-clamp-2">
          {note.text}
        </p>

        <div className="flex items-center justify-between gap-2 text-[9px] font-mono text-amber-200/55">
          <span className="truncate">By {note.updatedBy}</span>
          {note.updatedAt && <span className="shrink-0">{formatShortTimestamp(note.updatedAt)}</span>}
        </div>
      </div>
    );
  }

  return (
    <button
      id={`add-sku-note-btn-${product.id}`}
      type="button"
      onClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      className="mt-2.5 w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border border-dashed border-neutral-800 hover:border-amber-500/45 bg-neutral-950/45 hover:bg-amber-950/15 text-[11px] text-neutral-400 hover:text-amber-200 transition-colors cursor-pointer text-left"
      title={`Add maintenance or storage instructions for ${product.sku}`}
    >
      <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
        <StickyNote className="w-3 h-3 text-neutral-500 shrink-0" />
        <span className="truncate">Add maintenance / storage note...</span>
      </span>
      <Pencil className="w-3 h-3 text-neutral-500 shrink-0" />
    </button>
  );
};
