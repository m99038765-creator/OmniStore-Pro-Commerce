import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShoppingBag,
  Layers,
  CheckSquare,
  Square,
  X,
  Boxes,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Tag
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BatchTagModal } from './BatchTagModal';

interface CatalogFloatingActionBarProps {
  visibleProductIds: string[];
}

export const CatalogFloatingActionBar: React.FC<CatalogFloatingActionBarProps> = ({
  visibleProductIds
}) => {
  const {
    products,
    selectedCatalogProductIds,
    clearSelectedCatalogProducts,
    selectAllCatalogProducts,
    bulkAddSelectedToCart,
    bulkAddSelectedToWarehouseQueue,
    cart,
    addToCart,
    addAlert
  } = useStore();

  const [isBatchTagOpen, setIsBatchTagOpen] = useState(false);
  const [isIntelligentBatchOpen, setIsIntelligentBatchOpen] = useState(false);

  // Analyze cart items and recommend complementary products for replenishment
  const intelligentBatchSuggestions = useMemo(() => {
    if (cart.length === 0) return [];
    const cartProductIds = new Set(cart.map(i => i.product.id));
    const cartCategories = new Set(cart.map(i => i.product.category));
    
    const candidates = products.filter(p => !cartProductIds.has(p.id) && p.stock > 0);
    const sameCategoryCandidates = candidates.filter(p => cartCategories.has(p.category));
    const otherCandidates = candidates.filter(p => !cartCategories.has(p.category));

    return [...sameCategoryCandidates, ...otherCandidates].slice(0, 3);
  }, [cart, products]);

  const handleAddAllIntelligentBatch = () => {
    intelligentBatchSuggestions.forEach(prod => {
      addToCart(prod, 1);
    });
    addAlert('success', 'Intelligent Batch Added', `Successfully added ${intelligentBatchSuggestions.length} complementary items to your cart.`);
    setIsIntelligentBatchOpen(false);
  };

  const selectedCount = selectedCatalogProductIds.length;
  const isVisible = selectedCount > 0;

  // Selected products details
  const selectedProducts = useMemo(() => {
    return products.filter((p) => selectedCatalogProductIds.includes(p.id));
  }, [products, selectedCatalogProductIds]);

  const inStockCount = useMemo(() => {
    return selectedProducts.filter((p) => p.stock > 0).length;
  }, [selectedProducts]);

  const outOfStockCount = selectedCount - inStockCount;

  const totalValue = useMemo(() => {
    return selectedProducts.reduce((sum, p) => sum + p.price, 0);
  }, [selectedProducts]);

  const areAllVisibleSelected = useMemo(() => {
    if (visibleProductIds.length === 0) return false;
    return visibleProductIds.every((id) => selectedCatalogProductIds.includes(id));
  }, [visibleProductIds, selectedCatalogProductIds]);

  const handleToggleSelectAllVisible = () => {
    if (areAllVisibleSelected) {
      clearSelectedCatalogProducts();
    } else {
      selectAllCatalogProducts(visibleProductIds);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            id="catalog-bulk-floating-action-bar"
            initial={{ y: 90, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 90, opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-3xl pointer-events-auto"
          >
            <div className="relative overflow-hidden rounded-2xl bg-neutral-950/95 border-2 border-sky-500/70 shadow-2xl shadow-black/90 backdrop-blur-xl p-3 sm:p-4 text-white">
              {/* Top decorative gradient glow */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent opacity-80" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Left: Selection Counter & Quick Selectors */}
                <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-500" />
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        id="floating-bar-selected-count"
                        className="font-mono text-sm sm:text-base font-bold text-white bg-sky-500/20 px-2 py-0.5 rounded-lg border border-sky-400/40"
                      >
                        {selectedCount}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-neutral-200">
                        Product{selectedCount > 1 ? 's' : ''} Selected
                      </span>
                    </div>
                  </div>

                  {/* Subtext info pill */}
                  <div className="hidden sm:flex items-center gap-2 text-[11px] text-neutral-400 font-mono border-l border-neutral-800 pl-3">
                    <span>${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    {outOfStockCount > 0 && (
                      <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
                        <AlertTriangle className="w-3 h-3" />
                        {outOfStockCount} OOS
                      </span>
                    )}
                  </div>

                  {/* Select All Visible toggle */}
                  <button
                    id="floating-bar-select-all-btn"
                    type="button"
                    onClick={handleToggleSelectAllVisible}
                    className="text-xs px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800 transition-colors flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
                    title={areAllVisibleSelected ? 'Deselect all visible products' : `Select all ${visibleProductIds.length} visible products`}
                  >
                    {areAllVisibleSelected ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-[11px]">Deselect All</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-neutral-400" />
                        <span className="text-[11px]">Select All ({visibleProductIds.length})</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Primary Bulk Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                  {/* Bulk Add to Cart Button */}
                  <button
                    id="bulk-add-to-cart-floating-btn"
                    type="button"
                    onClick={bulkAddSelectedToCart}
                    disabled={inStockCount === 0}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-neutral-950 font-bold text-xs shadow-lg shadow-emerald-950/50 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      inStockCount > 0
                        ? `Add ${inStockCount} in-stock item${inStockCount > 1 ? 's' : ''} directly to your cart`
                        : 'All selected items are out of stock'
                    }
                  >
                    <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                    <span>Bulk Add to Cart ({inStockCount})</span>
                  </button>

                  {/* Batch Tag Button */}
                  <button
                    id="bulk-batch-tag-floating-btn"
                    type="button"
                    onClick={() => setIsBatchTagOpen(true)}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs border border-purple-400/50 shadow-lg shadow-purple-950/50 active:scale-95 transition-all cursor-pointer"
                    title="Apply or remove warehouse tags from all selected items at once"
                  >
                    <Tag className="w-4 h-4 stroke-[2.5]" />
                    <span>Batch Tag ({selectedCount})</span>
                  </button>

                  {/* Warehouse Bulk Inventory Update Queue Button */}
                  <button
                    id="bulk-queue-warehouse-floating-btn"
                    type="button"
                    onClick={bulkAddSelectedToWarehouseQueue}
                    className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs border border-sky-400/50 shadow-lg shadow-sky-950/50 active:scale-95 transition-all cursor-pointer"
                    title="Load selected SKUs into the Warehouse Bulk Inventory Update batch manager"
                  >
                    <Layers className="w-4 h-4 stroke-[2.5]" />
                    <span>Bulk Inventory Update ({selectedCount})</span>
                  </button>

                  {/* Intelligent Batch Replenishment Suggestions Button */}
                  {cart.length > 0 && intelligentBatchSuggestions.length > 0 && (
                    <div className="relative">
                      <button
                        id="intelligent-batch-btn"
                        type="button"
                        onClick={() => setIsIntelligentBatchOpen(!isIntelligentBatchOpen)}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-950/50 active:scale-95 transition-all cursor-pointer border border-indigo-400/40"
                        title="Intelligent Batch: Replenishment recommendations based on your current cart items"
                      >
                        <Sparkles className="w-4 h-4 text-violet-300 animate-pulse" />
                        <span>Intelligent Batch ({intelligentBatchSuggestions.length})</span>
                      </button>

                      {/* Intelligent Batch Popover Panel */}
                      <AnimatePresence>
                        {isIntelligentBatchOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full right-0 mb-3 w-80 sm:w-96 bg-neutral-900 border border-indigo-500/50 rounded-2xl shadow-2xl p-3 sm:p-4 z-50 text-left"
                          >
                            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">Intelligent Batch Replenishment</span>
                              </div>
                              <button
                                onClick={() => setIsIntelligentBatchOpen(false)}
                                className="text-neutral-400 hover:text-white p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <p className="text-[11px] text-neutral-300 mb-3">
                              Analyzed from your active cart items. Recommended complementary products for warehouse replenishment & accessory bundling:
                            </p>

                            <div className="space-y-2 mb-3 max-h-60 overflow-y-auto pr-1">
                              {intelligentBatchSuggestions.map(prod => (
                                <div
                                  key={prod.id}
                                  className="flex items-center justify-between p-2 rounded-xl bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 transition-colors"
                                >
                                  <div className="flex flex-col min-w-0 pr-2">
                                    <span className="text-xs font-mono font-bold text-indigo-300 truncate">
                                      {prod.sku}
                                    </span>
                                    <span className="text-[11px] text-neutral-200 truncate">
                                      {prod.name}
                                    </span>
                                    <span className="text-[10px] text-neutral-400 font-mono">
                                      ${prod.price.toLocaleString()} • Stock: {prod.stock}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      addToCart(prod, 1);
                                      addAlert('success', 'Item Added', `Added "${prod.name}" to cart.`);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-[10px] shrink-0 font-bold transition-colors"
                                  >
                                    + Add
                                  </button>
                                </div>
                              ))}
                            </div>

                            {/* One-Click Add All Button */}
                            <button
                              id="intelligent-batch-add-all-btn"
                              type="button"
                              onClick={handleAddAllIntelligentBatch}
                              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-400 hover:to-pink-400 text-white font-bold text-xs shadow-lg shadow-indigo-950/80 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Sparkles className="w-4 h-4" />
                              <span>One-Click Add All ({intelligentBatchSuggestions.length} Items)</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Clear Selection Dismiss Button */}
                  <button
                    id="floating-bar-clear-btn"
                    type="button"
                    onClick={clearSelectedCatalogProducts}
                    aria-label="Dismiss selection bar"
                    className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                    title="Clear all selected items"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BatchTagModal
        isOpen={isBatchTagOpen}
        onClose={() => setIsBatchTagOpen(false)}
        selectedProductIds={selectedCatalogProductIds}
      />
    </>
  );
};
