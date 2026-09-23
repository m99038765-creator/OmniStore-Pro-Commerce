import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Scale, X, ArrowRight, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const ComparisonBar: React.FC = () => {
  const {
    comparedProductIds,
    toggleCompareProduct,
    clearComparison,
    setIsCompareModalOpen,
    products
  } = useStore();

  if (comparedProductIds.length === 0) return null;

  const comparedProducts = comparedProductIds
    .map(id => products.find(p => p.id === id))
    .filter(Boolean);

  return (
    <AnimatePresence>
      <motion.aside
        id="comparison-floating-dock"
        aria-label="Product comparison dock"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl bg-neutral-900/95 backdrop-blur-xl border border-neutral-700/80 rounded-2xl shadow-2xl p-3 sm:p-4 text-white"
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left info & thumbnails */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                <Scale className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Compare Hardware</span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {comparedProducts.length} of 4 selected
                </span>
              </div>
            </div>

            {/* Selected item chips */}
            <div className="flex items-center gap-2 overflow-x-auto py-0.5 max-w-[280px] sm:max-w-xs">
              {comparedProducts.map((prod, index) => (
                <div
                  key={prod!.id}
                  className="group relative flex items-center gap-1.5 bg-neutral-950 border border-neutral-800 rounded-lg p-1 pr-2 shrink-0"
                >
                  <img
                    src={prod!.images[0]}
                    alt=""
                    className="w-6 h-6 rounded object-cover bg-neutral-900"
                  />
                  <span className="text-[11px] font-medium text-neutral-200 truncate max-w-[90px]">
                    {prod!.name.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => toggleCompareProduct(prod!.id)}
                    className="text-neutral-500 hover:text-rose-400 transition-colors ml-0.5"
                    title="Remove item"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={clearComparison}
              className="px-2.5 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 text-xs transition-colors"
            >
              Clear
            </button>

            <button
              id="open-side-by-side-comparison-button"
              onClick={() => setIsCompareModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
            >
              <span>Side-by-Side Compare ({comparedProducts.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};
