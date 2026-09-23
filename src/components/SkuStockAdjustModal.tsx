import React, { useState } from 'react';
import {
  X,
  Sliders,
  PackagePlus,
  PackageMinus,
  Equal,
  Plus,
  Minus,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Boxes,
  MapPin,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface SkuStockAdjustModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (message: string) => void;
  onNavigateToDetails?: (product: Product) => void;
}

export const SkuStockAdjustModal: React.FC<SkuStockAdjustModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
  onNavigateToDetails
}) => {
  const { restockProduct, batchAdjustStock, addAlert } = useStore();

  const [mode, setMode] = useState<'add' | 'subtract' | 'set'>('add');
  const [quantity, setQuantity] = useState<number>(5);
  const [reason, setReason] = useState<string>('Cycle Count Adjustment');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !product) return null;

  const currentStock = product.stock;
  let projectedStock = currentStock;
  if (mode === 'add') projectedStock = currentStock + quantity;
  else if (mode === 'subtract') projectedStock = Math.max(0, currentStock - quantity);
  else if (mode === 'set') projectedStock = Math.max(0, quantity);

  const delta = projectedStock - currentStock;

  const handleApplyAdjustment = async () => {
    if (quantity < 0 || isNaN(quantity)) return;
    setIsSubmitting(true);

    let ok = false;
    let message = '';

    if (mode === 'add') {
      ok = await restockProduct(product.id, quantity);
      message = `Restocked ${product.name} (+${quantity} units). New stock: ${projectedStock}.`;
    } else {
      const res = await batchAdjustStock({
        productIds: [product.id],
        adjustmentType: mode,
        quantity,
        reason
      });
      ok = res.success;
      const modeText = mode === 'subtract' ? `-${quantity} units` : `set to ${quantity} units`;
      message = `Adjusted ${product.name} (${modeText}). New stock: ${projectedStock}.`;
    }

    setIsSubmitting(false);

    if (ok) {
      if (onSuccess) onSuccess(message);
      addAlert('success', 'Stock Adjustment Applied', message);
      onClose();
    }
  };

  return (
    <div
      id="sku-stock-adjust-backdrop"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id={`sku-stock-adjust-modal-${product.id}`}
        className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Stock Adjustment Settings</h3>
              <p className="text-[11px] font-mono text-emerald-400">SKU: {product.sku}</p>
            </div>
          </div>
          <button
            id="close-sku-stock-adjust-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Target Product Summary */}
          <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center gap-3">
            <img
              src={product.images[0]}
              alt=""
              className="w-12 h-12 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-semibold text-white truncate">{product.name}</h4>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                <span className="font-mono text-emerald-400 font-bold">${product.price.toFixed(2)}</span>
                <span>•</span>
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <MapPin className="w-3 h-3 text-neutral-500" />
                  {product.warehouse.split('(')[0].trim()}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-mono font-bold text-neutral-300 block">Current Stock</span>
              <span
                className={`text-sm font-mono font-bold ${
                  product.stock <= 0
                    ? 'text-rose-400'
                    : product.stock <= product.lowStockThreshold
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {product.stock} units
              </span>
            </div>
          </div>

          {/* Adjustment Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
              Adjustment Operation
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                id="adjust-mode-add-btn"
                onClick={() => setMode('add')}
                className={`py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'add'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add (+)</span>
              </button>

              <button
                type="button"
                id="adjust-mode-subtract-btn"
                onClick={() => setMode('subtract')}
                className={`py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'subtract'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Minus className="w-3.5 h-3.5" />
                <span>Reduce (-)</span>
              </button>

              <button
                type="button"
                id="adjust-mode-set-btn"
                onClick={() => setMode('set')}
                className={`py-2 px-2 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  mode === 'set'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Equal className="w-3.5 h-3.5" />
                <span>Set Exact (=)</span>
              </button>
            </div>
          </div>

          {/* Quantity Controls & Stepper */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
              {mode === 'add'
                ? 'Units to Add (+)'
                : mode === 'subtract'
                ? 'Units to Remove (-)'
                : 'Target Stock Override (=)'}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="adjust-qty-dec-btn"
                onClick={() => setQuantity(q => Math.max(mode === 'set' ? 0 : 1, q - 1))}
                className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-200 transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <input
                  id="adjust-qty-input"
                  type="number"
                  min={mode === 'set' ? 0 : 1}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full text-center py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500">
                  units
                </span>
              </div>

              <button
                type="button"
                id="adjust-qty-inc-btn"
                onClick={() => setQuantity(q => q + 1)}
                className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-200 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[10px] text-neutral-500 font-mono">Presets:</span>
              {(mode === 'set' ? [0, 5, 10, 25, 50] : [5, 10, 20, 50, 100]).map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setQuantity(val)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    quantity === val
                      ? 'bg-neutral-200 text-neutral-950 font-bold'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {mode === 'add' ? `+${val}` : mode === 'subtract' ? `-${val}` : val}
                </button>
              ))}
            </div>
          </div>

          {/* Reason / Audit tag */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
              Audit Reason
            </label>
            <select
              id="adjust-reason-select"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="Cycle Count Adjustment">Cycle Count Adjustment</option>
              <option value="Inbound Supplier Restock">Inbound Supplier Restock</option>
              <option value="Damaged / Scrap Write-off">Damaged / Scrap Write-off</option>
              <option value="Inter-Warehouse Transfer">Inter-Warehouse Transfer</option>
              <option value="Customer Return Batch">Customer Return Batch</option>
            </select>
          </div>

          {/* Impact Preview Card */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-neutral-400 block text-[11px]">Projected Outcome:</span>
              <div className="flex items-center gap-2 mt-0.5 font-mono">
                <span className="text-neutral-300 font-bold">{currentStock} units</span>
                <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                <span
                  className={`font-bold text-sm ${
                    projectedStock <= 0
                      ? 'text-rose-400'
                      : projectedStock <= product.lowStockThreshold
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {projectedStock} units
                </span>
              </div>
            </div>

            <span
              className={`px-2 py-1 rounded-lg text-xs font-mono font-bold ${
                delta >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {delta >= 0 ? `+${delta}` : delta} net
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between gap-3">
          {onNavigateToDetails && (
            <button
              type="button"
              id="view-full-details-from-adjust-btn"
              onClick={() => {
                onClose();
                onNavigateToDetails(product);
              }}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors font-semibold"
            >
              View Full SKU Details
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              id="confirm-stock-adjust-btn"
              onClick={handleApplyAdjustment}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Apply Adjustment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
