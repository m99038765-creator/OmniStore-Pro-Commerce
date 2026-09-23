import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Scale,
  ShoppingBag,
  Check,
  AlertTriangle,
  MapPin,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  Star,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

export const ProductComparisonModal: React.FC = () => {
  const {
    isCompareModalOpen,
    setIsCompareModalOpen,
    comparedProductIds,
    toggleCompareProduct,
    clearComparison,
    products,
    addToCart,
    setQuickViewProduct
  } = useStore();

  const [addDropdownOpen, setAddDropdownOpen] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<Record<string, boolean>>({});

  const comparedProducts = useMemo(() => {
    return comparedProductIds
      .map(id => products.find(p => p.id === id))
      .filter((p): p is Product => Boolean(p));
  }, [comparedProductIds, products]);

  // Extract all unique spec keys across compared products
  const allSpecKeys = useMemo(() => {
    const keys = new Set<string>();
    comparedProducts.forEach(prod => {
      if (prod.specs) {
        Object.keys(prod.specs).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [comparedProducts]);

  // Available products to add to comparison
  const remainingProducts = useMemo(() => {
    return products.filter(p => !comparedProductIds.includes(p.id));
  }, [products, comparedProductIds]);

  if (!isCompareModalOpen) return null;

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return;
    const res = addToCart(product, 1);
    if (res.success) {
      setAddedItemIds(prev => ({ ...prev, [product.id]: true }));
      setTimeout(() => {
        setAddedItemIds(prev => ({ ...prev, [product.id]: false }));
      }, 1500);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="product-comparison-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setIsCompareModalOpen(false)}
      >
        <motion.div
          id="product-comparison-modal-content"
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-950 border border-neutral-800 rounded-2xl max-w-6xl w-full overflow-hidden shadow-2xl flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Scale className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Side-by-Side Hardware Comparison</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {comparedProducts.length} of 4 items
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Real-time warehouse inventory telemetry and unified specifications matrix.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="clear-all-comparison-button"
                onClick={clearComparison}
                className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition-colors"
              >
                Clear All
              </button>
              <button
                id="close-comparison-modal-button"
                onClick={() => setIsCompareModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content: Table Matrix */}
          <div className="flex-1 overflow-x-auto overflow-y-auto p-4 sm:p-6 space-y-6">
            {comparedProducts.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Scale className="w-12 h-12 text-neutral-600 mx-auto stroke-1" />
                <h4 className="text-base font-semibold text-white">No Products Selected for Comparison</h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Select products from the catalog using the "Compare" button on any card to view their technical specifications side by side.
                </p>
                <button
                  onClick={() => setIsCompareModalOpen(false)}
                  className="mt-4 px-4 py-2 rounded-xl bg-emerald-500 text-neutral-950 font-bold text-xs hover:bg-emerald-400 transition-colors"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              <div className="min-w-[700px]">
                {/* Product Column Cards Grid */}
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, comparedProducts.length + (comparedProducts.length < 4 ? 1 : 0))}, minmax(220px, 1fr))`
                  }}
                >
                  {comparedProducts.map((product, index) => {
                    const isOutOfStock = product.stock <= 0;
                    const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
                    const isAdded = addedItemIds[product.id];

                    return (
                      <div
                        key={product.id}
                        id={`compare-column-${product.id}`}
                        className="bg-neutral-900/60 border border-neutral-800/90 rounded-xl p-4 flex flex-col justify-between relative group"
                      >
                        {/* Remove from comparison button */}
                        <button
                          onClick={() => toggleCompareProduct(product.id)}
                          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-neutral-950/80 hover:bg-rose-900/40 text-neutral-400 hover:text-rose-300 border border-neutral-800 transition-colors"
                          title="Remove from comparison"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>

                        <div>
                          {/* Image */}
                          <div
                            className="aspect-[4/3] rounded-lg overflow-hidden bg-neutral-950 mb-3 cursor-pointer"
                            onClick={() => setQuickViewProduct(product)}
                          >
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>

                          {/* Category & SKU */}
                          <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono mb-1">
                            <span className="uppercase">{product.category}</span>
                            <span>{product.sku}</span>
                          </div>

                          {/* Name */}
                          <h4
                            onClick={() => setQuickViewProduct(product)}
                            className="text-xs font-bold text-white hover:text-emerald-400 transition-colors cursor-pointer line-clamp-2"
                          >
                            {product.name}
                          </h4>

                          {/* Rating & Price */}
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/60">
                            <div className="flex items-center gap-1 text-amber-400 text-xs font-semibold">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span>{product.rating.toFixed(1)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold font-mono text-white">
                                ${product.price.toFixed(2)}
                              </span>
                              {product.originalPrice && (
                                <span className="text-[10px] text-neutral-500 line-through font-mono block">
                                  ${product.originalPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* WAREHOUSE AVAILABILITY BLOCK (REAL-TIME) */}
                          <div className="mt-3 p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase text-neutral-400">Hub Stock</span>
                              {isOutOfStock ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800 text-neutral-400 font-mono">
                                  Sold Out
                                </span>
                              ) : isLowStock ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 font-mono flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                  {product.stock} Left
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-mono">
                                  {product.stock} In Stock
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1 border-t border-neutral-800/60">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-emerald-400" />
                                <span className="truncate max-w-[120px]">{product.warehouse.split('(')[0]}</span>
                              </span>
                              <span className="font-mono text-neutral-500">
                                {product.reserved > 0 ? `${product.reserved} hold` : '0 hold'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2">
                          <button
                            onClick={() => handleAddToCart(product)}
                            disabled={isOutOfStock}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                              isOutOfStock
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                                : isAdded
                                ? 'bg-emerald-600 text-white'
                                : 'bg-neutral-100 hover:bg-emerald-400 text-neutral-950 active:scale-95 shadow-sm'
                            }`}
                          >
                            {isOutOfStock ? (
                              <span>Sold Out</span>
                            ) : isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Reserved in Cart</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>Add to Cart</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setQuickViewProduct(product)}
                            className="w-full py-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors text-center block"
                          >
                            View Full Dossier
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Product Slot if < 4 */}
                  {comparedProducts.length < 4 && (
                    <div className="bg-neutral-900/30 border border-dashed border-neutral-800 rounded-xl p-5 flex flex-col items-center justify-center text-center relative min-h-[300px]">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-400 mb-2">
                        <Plus className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-bold text-neutral-200">Add Another SKU</h5>
                      <p className="text-[11px] text-neutral-500 mt-1 max-w-[170px]">
                        Compare up to 4 items simultaneously for technical selection.
                      </p>

                      <div className="mt-4 relative w-full">
                        <button
                          onClick={() => setAddDropdownOpen(!addDropdownOpen)}
                          className="w-full py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>Select Product</span>
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {addDropdownOpen && (
                          <div className="absolute bottom-full mb-2 left-0 right-0 z-30 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-2 max-h-56 overflow-y-auto space-y-1">
                            {remainingProducts.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 p-2">All products added.</p>
                            ) : (
                              remainingProducts.map((p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    toggleCompareProduct(p.id);
                                    setAddDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2 rounded-lg hover:bg-neutral-800 flex items-center gap-2 text-xs transition-colors"
                                >
                                  <img src={p.images[0]} alt="" className="w-6 h-6 rounded object-cover bg-neutral-950" />
                                  <div className="flex-1 truncate">
                                    <span className="text-white truncate block">{p.name}</span>
                                    <span className="text-[10px] text-neutral-400 font-mono">${p.price.toFixed(2)}</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* SPECIFICATIONS MATRIX TABLE */}
                <div className="mt-8 border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Engineering Specifications Matrix
                    </h4>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {allSpecKeys.length} verified technical attributes
                    </span>
                  </div>

                  <div className="divide-y divide-neutral-800/60 bg-neutral-950">
                    {allSpecKeys.map((key, rowIdx) => (
                      <div
                        key={key}
                        className={`grid items-center px-4 py-3 text-xs ${
                          rowIdx % 2 === 0 ? 'bg-neutral-900/20' : 'bg-transparent'
                        }`}
                        style={{
                          gridTemplateColumns: `180px repeat(${comparedProducts.length}, minmax(180px, 1fr))`
                        }}
                      >
                        <div className="font-mono text-[11px] uppercase font-semibold text-neutral-400 pr-3">
                          {key}
                        </div>

                        {comparedProducts.map((p) => {
                          const val = p.specs[key];
                          return (
                            <div key={p.id} className="text-neutral-200 px-2 font-medium">
                              {val ? (
                                <span>{val}</span>
                              ) : (
                                <span className="text-neutral-600 font-mono">—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* KEY INNOVATIONS MATRIX */}
                <div className="mt-6 border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Innovations & Features Breakdown
                    </h4>
                  </div>

                  <div
                    className="grid divide-x divide-neutral-800/60 p-4 bg-neutral-950 gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${comparedProducts.length}, minmax(180px, 1fr))`
                    }}
                  >
                    {comparedProducts.map((p) => (
                      <div key={p.id} className="space-y-2 text-xs px-2">
                        <span className="font-semibold text-white block truncate">{p.name}</span>
                        <ul className="space-y-1.5">
                          {p.features.map((feat, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-[11px] text-neutral-300">
                              <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* WARRANTY & PROTECTION */}
                <div className="mt-6 border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="bg-neutral-900/80 px-4 py-3 border-b border-neutral-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
                      Manufacturer Warranty Guarantee
                    </h4>
                  </div>

                  <div
                    className="grid divide-x divide-neutral-800/60 p-4 bg-neutral-950 gap-4"
                    style={{
                      gridTemplateColumns: `repeat(${comparedProducts.length}, minmax(180px, 1fr))`
                    }}
                  >
                    {comparedProducts.map((p) => (
                      <div key={p.id} className="text-xs px-2">
                        <span className="font-semibold text-emerald-400 block font-mono">
                          {p.warranty}
                        </span>
                        <span className="text-[10px] text-neutral-500 mt-0.5 block">
                          Direct exchange and rapid replacement protocol included.
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-time warehouse inventory refreshed automatically.</span>
            </div>
            <button
              onClick={() => setIsCompareModalOpen(false)}
              className="px-5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors"
            >
              Close Comparison
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
