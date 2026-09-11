import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, ShoppingBag, ShieldCheck, MapPin, Truck, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

export const ProductDetailModal: React.FC = () => {
  const { quickViewProduct, setQuickViewProduct, addToCart, setIsCartOpen, setIsCheckoutOpen } = useStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);

  if (!quickViewProduct) return null;

  const product = quickViewProduct;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    const res = addToCart(product, quantity);
    if (res.success) {
      setAddedAnimation(true);
      setTimeout(() => setAddedAnimation(false), 1400);
    }
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity);
    setQuickViewProduct(null);
    setIsCheckoutOpen(true);
  };

  return (
    <AnimatePresence>
      <div
        id="product-detail-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setQuickViewProduct(null)}
      >
        <motion.div
          id="product-detail-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-900 border border-neutral-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col my-auto"
        >
          {/* Header Close button */}
          <button
            id="close-product-detail-button"
            onClick={() => setQuickViewProduct(null)}
            className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-neutral-950/70 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="overflow-y-auto p-5 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              
              {/* Media Gallery */}
              <div className="flex flex-col gap-3">
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800">
                  <img
                    src={product.images[selectedImageIndex] || product.images[0]}
                    alt={product.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {/* Realtime stock badge */}
                  <div className="absolute top-3 left-3">
                    {isOutOfStock ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase bg-neutral-950/90 text-neutral-400 border border-neutral-800 backdrop-blur-md">
                        Sold Out
                      </span>
                    ) : isLowStock ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-amber-950/90 text-amber-300 border border-amber-800 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                        Only {product.stock} Units Remaining
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-neutral-950/80 text-emerald-400 border border-neutral-800 backdrop-blur-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        {product.stock} Units In Stock
                      </span>
                    )}
                  </div>
                </div>

                {/* Thumbnail selector */}
                {product.images.length > 1 && (
                  <div className="flex items-center gap-3">
                    {product.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImageIndex(idx)}
                        className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          selectedImageIndex === idx ? 'border-emerald-500 scale-105' : 'border-neutral-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={img} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Warehouse Location Info */}
                <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 text-xs text-neutral-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Fulfillment Center:</span>
                  </span>
                  <span className="font-mono text-neutral-200">{product.warehouse}</span>
                </div>
              </div>

              {/* Product Dossier & Buying Controls */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-neutral-500">{product.sku}</span>
                  <div className="flex items-center gap-1 text-amber-400 font-medium">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{product.rating.toFixed(1)}</span>
                    <span className="text-neutral-500">({product.reviewCount} master reviews)</span>
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1.5 leading-snug">
                  {product.name}
                </h2>
                <p className="text-xs sm:text-sm text-neutral-400 mt-2 leading-relaxed">
                  {product.description}
                </p>

                {/* Price Display */}
                <div className="mt-4 p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-neutral-400 block">Unit Price (USD)</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold text-white font-mono">
                        ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      {product.originalPrice && (
                        <span className="text-sm text-neutral-500 line-through font-mono">
                          ${product.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-400 block font-medium">
                      Encrypted Checkout
                    </span>
                    <span className="text-[10px] text-neutral-400 block">
                      Fast Dispatch Guaranteed
                    </span>
                  </div>
                </div>

                {/* Key Features */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                    Key Innovations
                  </h4>
                  <ul className="space-y-1.5">
                    {product.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Technical Specifications */}
                <div className="mt-4">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                    Technical Specifications
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(product.specs).map(([key, value]) => (
                      <div key={key} className="p-2 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
                        <span className="text-[10px] text-neutral-500 uppercase block font-mono">{key}</span>
                        <span className="text-neutral-200 font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purchase Action Buttons */}
                <div className="mt-6 pt-5 border-t border-neutral-800 space-y-3">
                  {/* Quantity selector */}
                  {!isOutOfStock && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-300 font-medium">Quantity:</span>
                      <div className="flex items-center border border-neutral-700 bg-neutral-950 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800"
                        >
                          -
                        </button>
                        <span className="px-4 py-1.5 text-xs font-mono font-bold text-white min-w-10 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                          disabled={quantity >= product.stock}
                          className="px-3 py-1.5 text-sm text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      id="modal-add-to-cart-button"
                      onClick={handleAddToCart}
                      disabled={isOutOfStock}
                      className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isOutOfStock
                          ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                          : addedAnimation
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 active:scale-95'
                      }`}
                    >
                      {addedAnimation ? (
                        <>
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Reserved in Cart!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>Add to Cart</span>
                        </>
                      )}
                    </button>

                    <button
                      id="modal-buy-now-button"
                      onClick={handleBuyNow}
                      disabled={isOutOfStock}
                      className={`py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                        isOutOfStock
                          ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-lg shadow-emerald-500/20 active:scale-95'
                      }`}
                    >
                      <span>Secure Checkout</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-400 pt-2">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {product.warranty}
                    </span>
                    <span className="flex items-center gap-1">
                      <Truck className="w-3.5 h-3.5 text-sky-400" />
                      Signature Insured Delivery
                    </span>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
