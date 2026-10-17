import React, { useState } from 'react';
import {
  Truck,
  X,
  ArrowRight,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Sparkles,
  Building2,
  Boxes,
  Check
} from 'lucide-react';
import { Product } from '../types';
import { REGIONAL_HUBS } from '../utils/transitCalculator';
import { useStore } from '../context/StoreContext';

interface QuickReallocateModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickReallocateModal: React.FC<QuickReallocateModalProps> = ({
  product,
  isOpen,
  onClose
}) => {
  const { batchAdjustStock, addAlert } = useStore();
  const [selectedDestHub, setSelectedDestHub] = useState<string>('');
  const [reallocateQty, setReallocateQty] = useState<number>(10);
  const [isExecuting, setIsExecuting] = useState(false);
  const [successText, setSuccessText] = useState<string | null>(null);

  if (!isOpen || !product) return null;

  // Available destination hubs excluding current product warehouse
  const availableDestinations = REGIONAL_HUBS.filter(
    h => !product.warehouse.toLowerCase().includes(h.name.toLowerCase().split('(')[0].trim().toLowerCase())
  );

  const targetHubName = selectedDestHub || availableDestinations[0]?.name || 'East Coast DC (WH-02)';

  const handleExecuteReallocation = async () => {
    if (product.stock < reallocateQty) {
      alert(`Cannot reallocate ${reallocateQty} units. Only ${product.stock} units available in local hub.`);
      return;
    }

    setIsExecuting(true);
    try {
      // Execute stock adjustment: decrement from current hub and log reallocation
      await batchAdjustStock({
        productIds: [product.id],
        adjustmentType: 'remove',
        quantity: reallocateQty,
        reason: `Quick Reallocation: Transferred ${reallocateQty} units from ${product.warehouse} to ${targetHubName}`
      });

      const message = `Successfully reallocated ${reallocateQty} units of SKU ${product.sku} from "${product.warehouse}" to "${targetHubName}" based on regional proximity.`;
      setSuccessText(message);
      addAlert('success', '📦 Stock Reallocation Dispatched', message);

      setTimeout(() => {
        setIsExecuting(false);
        setSuccessText(null);
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Reallocation failed:', err);
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-sky-500/30 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-sky-950/80 via-neutral-900 to-neutral-900 border-b border-sky-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-inner">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Quick Stock Reallocation</h2>
              <p className="text-xs text-neutral-400">
                Instantly transfer inventory from local hub to secondary distribution center based on regional proximity.
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

        {successText ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-3 animate-bounce">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Transfer Dispatched!</h3>
            <p className="text-xs text-emerald-300 max-w-sm">{successText}</p>
          </div>
        ) : (
          <>
            {/* Product Summary Card */}
            <div className="p-4 bg-neutral-950/80 border-b border-neutral-800 flex items-center gap-3.5 mx-6 mt-5 rounded-xl">
              <img
                src={product.images[0] || ''}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-lg object-cover bg-neutral-900 border border-neutral-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-sky-400 font-bold">{product.sku}</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-emerald-400">{product.stock} units available</span>
                </div>
                <div className="text-xs font-semibold text-white truncate mt-0.5">{product.name}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                  <span>Origin Hub: <strong>{product.warehouse}</strong></span>
                </div>
              </div>
            </div>

            {/* Reallocation Form Controls */}
            <div className="p-6 space-y-4 text-xs">
              {/* Destination Hub Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-neutral-400 block">
                  Select Destination Hub (Regional Proximity):
                </label>
                <select
                  id="reallocation-destination-hub-select"
                  value={selectedDestHub || availableDestinations[0]?.name || ''}
                  onChange={(e) => setSelectedDestHub(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  {availableDestinations.map(hub => (
                    <option key={hub.id} value={hub.name}>
                      {hub.name} ({hub.city}, {hub.state} • {hub.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity to Reallocate */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase text-neutral-400 block">
                    Quantity to Transfer:
                  </label>
                  <span className="font-mono text-emerald-400">Max: {product.stock} units</span>
                </div>
                <div className="flex items-center gap-2">
                  {[5, 10, 25, 50].map(qty => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setReallocateQty(Math.min(product.stock, qty))}
                      disabled={product.stock < qty}
                      className={`flex-1 py-1.5 rounded-lg font-mono text-xs transition-colors border ${
                        reallocateQty === qty
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                          : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white'
                      } disabled:opacity-30`}
                    >
                      {qty} u
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="number"
                    min={1}
                    max={product.stock}
                    value={reallocateQty}
                    onChange={(e) => setReallocateQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2 font-mono text-white text-xs focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 font-mono">
                Proximity routing engine v3.2 active
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="execute-reallocation-btn"
                  onClick={handleExecuteReallocation}
                  disabled={isExecuting || product.stock <= 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-sky-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Transferring Stock...</span>
                    </>
                  ) : (
                    <>
                      <Truck className="w-3.5 h-3.5" />
                      <span>Execute Quick Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
