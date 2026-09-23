import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck, Tag, AlertTriangle } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    setIsCheckoutOpen
  } = useStore();

  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  
  let discount = 0;
  if (appliedPromo === 'PRO15') {
    discount = subtotal * 0.15;
  } else if (appliedPromo === 'VIP50') {
    discount = Math.min(subtotal, 50);
  }

  const freeShippingThreshold = 500;
  const isFreeShipping = subtotal >= freeShippingThreshold || appliedPromo === 'FREESHIP';
  const shippingCost = isFreeShipping || subtotal === 0 ? 0 : 15;
  const taxableAmount = Math.max(0, subtotal - discount);
  const estimatedTax = taxableAmount * 0.0825;
  const grandTotal = taxableAmount + shippingCost + estimatedTax;

  const handleApplyPromo = () => {
    setPromoError(null);
    const code = promoCode.trim().toUpperCase();
    if (code === 'PRO15' || code === 'VIP50' || code === 'FREESHIP') {
      setAppliedPromo(code);
      setPromoCode('');
    } else {
      setPromoError('Invalid coupon. Try: PRO15, VIP50, or FREESHIP');
    }
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <AnimatePresence>
      <div
        id="cart-drawer-backdrop"
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex justify-end"
        onClick={() => setIsCartOpen(false)}
      >
        <motion.div
          id="cart-drawer-content"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-neutral-950 border-l border-neutral-800 h-full flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-base text-white">Your Cart</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                {cart.reduce((acc, i) => acc + i.quantity, 0)} items
              </span>
            </div>
            <button
              id="close-cart-button"
              onClick={() => setIsCartOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Indicator */}
          <div className="bg-neutral-900/60 px-5 py-3 border-b border-neutral-800 text-xs">
            {isFreeShipping ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                You unlocked Free Priority Insured Shipping!
              </span>
            ) : (
              <div>
                <div className="flex justify-between text-neutral-300 mb-1.5">
                  <span>Add ${(freeShippingThreshold - subtotal).toFixed(2)} more for Free Shipping</span>
                  <span className="font-mono text-neutral-400">{Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))}%</span>
                </div>
                <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (subtotal / freeShippingThreshold) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Item List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                <ShoppingBag className="w-12 h-12 text-neutral-600 mb-3 stroke-1" />
                <p className="font-semibold text-neutral-200">Your bag is empty</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                  Browse our precision hardware and mastering studio monitors to begin.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-5 px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
                >
                  Explore Catalog
                </button>
              </div>
            ) : (
              cart.map((item, index) => {
                const isItemLowStock = item.product.stock <= item.product.lowStockThreshold;

                return (
                  <div
                    key={item.product.id}
                    id={`cart-item-${item.product.id}`}
                    className="flex gap-3 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 items-start"
                  >
                    <img
                      src={item.product.images[0]}
                      alt={item.product.name}
                      referrerPolicy="no-referrer"
                      className="w-18 h-18 rounded-lg object-cover bg-neutral-950 shrink-0 border border-neutral-800"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="text-xs font-semibold text-white line-clamp-1">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-xs font-bold text-white">
                          ${item.product.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {item.product.sku}
                        </span>
                      </div>

                      {/* Realtime stock advisory */}
                      {isItemLowStock && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-400 mt-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Only {item.product.stock} left in warehouse</span>
                        </div>
                      )}

                      {/* Quantity Controller */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-800/60">
                        <div className="flex items-center border border-neutral-800 bg-neutral-950 rounded-lg overflow-hidden">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            className="px-2 py-0.5 text-xs text-neutral-400 hover:text-white"
                          >
                            -
                          </button>
                          <span className="px-2 py-0.5 text-[11px] font-mono font-bold text-white min-w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.stock}
                            className="px-2 py-0.5 text-xs text-neutral-400 hover:text-white disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-mono font-bold text-emerald-400">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer & Checkout Trigger */}
          {cart.length > 0 && (
            <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-950 space-y-3">
              
              {/* Promo Code Input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-neutral-500">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="Coupon code (e.g. PRO15)"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 uppercase font-mono"
                  />
                </div>
                <button
                  onClick={handleApplyPromo}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors"
                >
                  Apply
                </button>
              </div>

              {promoError && (
                <p className="text-[11px] text-rose-400">{promoError}</p>
              )}
              {appliedPromo && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                  ✓ Code {appliedPromo} applied successfully!
                </p>
              )}

              {/* Price Breakdown */}
              <div className="space-y-1.5 text-xs text-neutral-400 pt-2 border-t border-neutral-800/80">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-neutral-200">${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount ({appliedPromo})</span>
                    <span className="font-mono">-${discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-mono text-neutral-200">
                    {shippingCost === 0 ? 'FREE (Tracked)' : `$${shippingCost.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Tax (8.25%)</span>
                  <span className="font-mono text-neutral-200">${estimatedTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-neutral-800">
                  <span>Estimated Total</span>
                  <span className="font-mono text-emerald-400">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                id="cart-proceed-checkout-button"
                onClick={handleProceedToCheckout}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all"
              >
                <span>Proceed to Secure Payment Gateway</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <div className="flex items-center justify-center gap-2 text-[10px] text-neutral-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Encrypted 256-Bit SSL • PCI DSS Level 1 Certified</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
