import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tag, X, Check, Boxes, Plus, Minus, ShieldAlert } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface BatchTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds: string[];
}

export const BatchTagModal: React.FC<BatchTagModalProps> = ({
  isOpen,
  onClose,
  selectedProductIds
}) => {
  const { batchUpdateWarehouseTags } = useStore();
  const [tagInput, setTagInput] = useState('');
  const [selectedAction, setSelectedAction] = useState<'add' | 'remove'>('add');

  if (!isOpen) return null;

  const presets = ['Fragile', 'Heavy', 'Flammable', 'Hazardous', 'High Priority', 'Refrigerate', 'Oversized'];

  const handleApply = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || selectedProductIds.length === 0) return;
    batchUpdateWarehouseTags(selectedProductIds, trimmed, selectedAction);
    onClose();
  };

  return (
    <AnimatePresence>
      <div
        id="batch-tag-modal-backdrop"
        className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          id="batch-tag-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Tag className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Batch Warehouse Tags</h3>
                <p className="text-xs text-neutral-400">
                  Apply or remove tags across <strong className="text-sky-300">{selectedProductIds.length}</strong> selected items.
                </p>
              </div>
            </div>
            <button
              id="close-batch-tag-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Action Mode Toggle */}
            <div className="flex rounded-xl bg-neutral-900 border border-neutral-800 p-1">
              <button
                type="button"
                onClick={() => setSelectedAction('add')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedAction === 'add'
                    ? 'bg-sky-500 text-neutral-950 shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Apply Tag</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedAction('remove')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  selectedAction === 'remove'
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Remove Tag</span>
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Quick Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleApply(preset)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-mono border border-neutral-800 hover:border-neutral-700 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Tag className="w-3 h-3 text-sky-400" />
                    <span>{preset}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Tag Input */}
            <div className="space-y-2 pt-2 border-t border-neutral-900">
              <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block">
                Custom Tag Name
              </span>
              <div className="flex items-center gap-2">
                <input
                  id="batch-tag-custom-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApply(tagInput);
                    }
                  }}
                  placeholder="Enter custom tag (e.g. 'Class-3 Hazardous')..."
                  className="flex-1 px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 font-mono"
                />
                <button
                  type="button"
                  id="batch-tag-apply-custom-btn"
                  onClick={() => handleApply(tagInput)}
                  disabled={!tagInput.trim()}
                  className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-neutral-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  {selectedAction === 'add' ? 'Apply Tag' : 'Remove Tag'}
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-400">
            <span>Changes will apply instantly across all fulfillment centers.</span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
