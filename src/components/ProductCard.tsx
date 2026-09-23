import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Navigation, Star, ShoppingBag, Eye, ShieldAlert, Check, MapPin, Sparkles, Scale, Heart, QrCode, BellRing, Zap, Barcode, AlertTriangle } from 'lucide-react';
import { Product } from '../types';
import { getDistanceToWarehouse, MOCK_USER_LOCATION } from '../utils/distance';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const {
    addToCart,
    quickBuy,
    setQuickViewProduct,
    setQrCodeProduct,
    comparedProductIds,
    toggleCompareProduct,
    toggleWishlist,
    isWishlisted: checkIsWishlisted,
    wishlistProductIds,
    inventoryAlerts,
    setActiveInventoryAlertProduct,
    skuSearchQuery,
    setSkuSearchQuery
  } = useStore();
  const [justAdded, setJustAdded] = useState(false);
  const [justQuickBought, setJustQuickBought] = useState(false);

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
  const isCompared = comparedProductIds.includes(product.id);
  const isWishlisted = product.isWishlisted ?? product.wishlist ?? checkIsWishlisted(product.id) ?? wishlistProductIds.includes(product.id);
  const existingAlert = inventoryAlerts.find(a => a.productId === product.id);
  const distance = getDistanceToWarehouse(product.warehouse);


  const isSkuMatched = Boolean(
    skuSearchQuery.trim() &&
    (product.sku.toLowerCase().includes(skuSearchQuery.trim().toLowerCase()) ||
     product.sku.replace(/[-\s_]/g, '').toLowerCase().includes(skuSearchQuery.trim().replace(/[-\s_]/g, '').toLowerCase()))
  );
  const isExactSku = Boolean(
    skuSearchQuery.trim() &&
    product.sku.toLowerCase() === skuSearchQuery.trim().toLowerCase()
  );

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    const res = addToCart(product, 1);
    if (res.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
    }
  };

  const handleQuickBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    const res = quickBuy(product);
    if (res.success) {
      setJustQuickBought(true);
      setTimeout(() => setJustQuickBought(false), 1600);
    }
  };

  return (
    <div
      id={`product-card-${product.id}`}
      className={`group relative flex flex-col bg-neutral-900/60 hover:bg-neutral-900 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-black/40 ${
        isSkuMatched
          ? 'border-2 border-sky-500 ring-2 ring-sky-500/30 shadow-sky-500/10'
          : isCompared
          ? 'border-2 border-emerald-500/80 ring-1 ring-emerald-500/30'
          : 'border border-neutral-800/80 hover:border-neutral-700/80'
      }`}
    >
      {/* Visual Media Canvas */}
      <div
        className="relative w-full aspect-[4/3] bg-neutral-950 overflow-hidden cursor-pointer"
        onClick={() => setQuickViewProduct(product)}
      >
        <img
          src={product.images[0]}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Live Real-time Inventory Tag */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase bg-neutral-950/90 text-neutral-400 border border-neutral-800 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
              Sold Out
            </span>
          ) : isLowStock ? (
            <span
              id={`low-stock-badge-${product.id}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide bg-amber-950/95 text-amber-300 border border-amber-500/70 shadow-lg shadow-amber-950/50 backdrop-blur-md"
              title={`Low Stock: ${product.stock} units remaining (Low stock threshold: ${product.lowStockThreshold})`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Low Stock: {product.stock} left</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-950/80 text-emerald-400 border border-neutral-800/80 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {product.stock} In Stock
            </span>
          )}

          {isLowStock && (
            <span
              id={`low-stock-tag-${product.id}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-500/25 text-rose-200 border border-rose-500/50 backdrop-blur-md w-fit shadow-xs"
              title={`Stock (${product.stock}) is below threshold of ${product.lowStockThreshold}`}
            >
              <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
              Low Stock
            </span>
          )}

          {product.isTrending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md w-fit">
              <Sparkles className="w-3 h-3" />
              High Demand
            </span>
          )}
        </div>

        {/* Top Right Action Buttons (Wishlist, Compare & Quick View) */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
          {/* Wishlist Heart Button */}
          <button
            id={`wishlist-btn-${product.id}`}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            onClick={(e) => {
              e.stopPropagation();
              toggleWishlist(product.id);
            }}
            className={`p-2 rounded-xl text-xs transition-all backdrop-blur-md flex items-center justify-center ${
              isWishlisted
                ? 'bg-rose-500/25 hover:bg-rose-500/35 border border-rose-500/70 text-rose-400 opacity-100 shadow-lg shadow-rose-950/40 scale-105'
                : 'bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 opacity-85 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
            title={isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
          >
            <Heart
              className={`w-3.5 h-3.5 transition-transform active:scale-125 ${
                isWishlisted ? 'fill-rose-500 text-rose-500' : 'text-neutral-300 hover:text-rose-400'
              }`}
            />
          </button>

          <button
            id={`compare-btn-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleCompareProduct(product.id);
            }}
            className={`p-2 rounded-xl text-xs transition-all backdrop-blur-md flex items-center gap-1 ${
              isCompared
                ? 'bg-emerald-500 text-neutral-950 font-bold border border-emerald-400 shadow-md opacity-100'
                : 'bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 opacity-0 group-hover:opacity-100'
            }`}
            title={isCompared ? 'Remove from comparison' : 'Add to side-by-side comparison'}
          >
            <Scale className="w-3.5 h-3.5" />
            {isCompared && <span className="text-[10px] font-bold pr-0.5">Compared</span>}
          </button>

          <button
            id={`qr-btn-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setQrCodeProduct(product);
            }}
            className="p-2 rounded-xl bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/60 text-emerald-400 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity backdrop-blur-md hover:text-emerald-300"
            title="View QR Code for SKU"
            aria-label="View QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
          </button>

          <button
            id={`price-alert-btn-${product.id}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveInventoryAlertProduct(product);
            }}
            className={`p-2 rounded-xl text-xs transition-all backdrop-blur-md flex items-center justify-center ${
              existingAlert
                ? 'bg-amber-500/25 hover:bg-amber-500/35 border border-amber-500/70 text-amber-400 opacity-100 shadow-md scale-105'
                : 'bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-300 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-300'
            }`}
            title={existingAlert ? `Inventory alert active (Target: $${existingAlert.targetPrice.toFixed(2)})` : 'Track inventory & price'}
          >
            <BellRing className={`w-3.5 h-3.5 ${existingAlert ? 'text-amber-400 fill-amber-500/20' : ''}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setQuickViewProduct(product);
            }}
            className="p-2 rounded-xl bg-neutral-900/85 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
            title="Quick Inspection & Specs"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>

        {/* Warehouse Tag */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-neutral-300 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-800/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <MapPin className="w-3 h-3 text-emerald-400" />
            {product.warehouse.split('(')[0].trim()}
          </span>
          <span className="font-mono text-[10px] text-neutral-400">{product.sku}</span>
        </div>
      </div>

      {/* Content Canvas */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          {/* Rating & Review & Mobile Compare Button */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1 text-amber-400 font-medium">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-neutral-500 text-[11px]">({product.reviewCount})</span>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCompareProduct(product.id);
              }}
              className={`text-[11px] font-medium flex items-center gap-1 transition-colors px-2 py-0.5 rounded-md ${
                isCompared
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Scale className="w-3 h-3" />
              <span>{isCompared ? 'In Compare' : 'Compare'}</span>
            </button>
          </div>

          {/* SKU Code, View QR Button & Hub Tag */}
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                id={`sku-badge-btn-${product.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSkuSearchQuery(product.sku);
                }}
                title="Click to search catalog specifically by this SKU"
                className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded transition-all cursor-pointer ${
                  isSkuMatched
                    ? 'bg-sky-500/25 text-sky-300 border border-sky-400 font-bold shadow-xs'
                    : 'bg-neutral-900/90 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                }`}
              >
                <Barcode className="w-3 h-3 text-sky-400 shrink-0" />
                <span>{product.sku}</span>
                {isExactSku && (
                  <span className="text-[9px] text-emerald-400 font-sans uppercase font-bold ml-0.5">Matched</span>
                )}
              </button>

              <button
                type="button"
                id={`view-qr-btn-${product.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setQrCodeProduct(product);
                }}
                title={`Generate & view scannable QR code for SKU: ${product.sku}`}
                className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60 transition-all cursor-pointer font-medium"
              >
                <QrCode className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>View QR</span>
              </button>
            </div>

            <div className="flex flex-col items-end shrink-0 text-right">
              <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1 justify-end">
                <MapPin className="w-2.5 h-2.5 text-neutral-500" />
                {product.warehouse.split('(')[0].trim()}
              </span>
              {distance !== null && (
                <span className={`text-[9px] font-mono flex items-center gap-1 justify-end mt-0.5 ${
                  distance < 500 ? 'text-emerald-400' : distance < 1500 ? 'text-amber-400' : 'text-rose-400'
                }`} title={`Simulated distance from ${MOCK_USER_LOCATION.city}`}>
                  <Navigation className="w-2 h-2" />
                  {distance} mi away
                </span>
              )}
            </div>
          </div>

          {/* Title & Tagline */}
          <h3
            onClick={() => setQuickViewProduct(product)}
            className="text-sm font-semibold text-neutral-100 group-hover:text-emerald-400 transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </h3>
          <p className="text-xs text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
            {product.tagline}
          </p>

          {/* Active Price Alert Pill */}
          {existingAlert && (
            <div className="mt-2">
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                existingAlert.status === 'triggered' || product.price <= existingAlert.targetPrice
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                <BellRing className="w-2.5 h-2.5 shrink-0" />
                Target ≤ ${existingAlert.targetPrice.toFixed(2)}
                {existingAlert.status === 'triggered' || product.price <= existingAlert.targetPrice ? ' (Met!)' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Price & Action Section */}
        <div className="mt-4 pt-3.5 border-t border-neutral-800/80 space-y-2.5">
          {/* Price and Wishlist Row */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white font-mono">
                  ${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
                {product.originalPrice && (
                  <span className="text-xs text-neutral-500 line-through font-mono">
                    ${product.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                Instant Dispatch Ready
              </span>
            </div>

            <button
              id={`wishlist-inline-btn-${product.id}`}
              aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              onClick={(e) => {
                e.stopPropagation();
                toggleWishlist(product.id);
              }}
              className={`p-2 rounded-xl border text-xs transition-all flex items-center justify-center ${
                isWishlisted
                  ? 'bg-rose-500/15 border-rose-500/50 text-rose-400 hover:bg-rose-500/25'
                  : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400 hover:text-rose-400 hover:border-rose-500/30'
              }`}
              title={isWishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
            >
              <Heart
                className={`w-4 h-4 transition-transform active:scale-125 ${
                  isWishlisted ? 'fill-rose-500 text-rose-500' : ''
                }`}
              />
            </button>
          </div>

          {/* Action Buttons: Add to Cart + Quick Buy */}
          <div className="grid grid-cols-2 gap-2">
            {/* Standard Add to Cart Button */}
            <button
              id={`add-to-cart-${product.id}`}
              onClick={handleAdd}
              disabled={isOutOfStock}
              className={`py-2 px-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                isOutOfStock
                  ? 'bg-neutral-800/60 text-neutral-500 cursor-not-allowed border border-neutral-800'
                  : justAdded
                  ? 'bg-neutral-800 text-emerald-300 border border-emerald-500/50'
                  : 'bg-neutral-800/80 hover:bg-neutral-750 text-neutral-300 hover:text-white border border-neutral-700/70 active:scale-95'
              }`}
              title={isOutOfStock ? 'Sold Out' : 'Add 1 unit to cart'}
            >
              {isOutOfStock ? (
                <span>Sold Out</span>
              ) : justAdded ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5] text-emerald-400" />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>

            {/* Quick Buy Button */}
            <button
              id={`quick-buy-${product.id}`}
              onClick={handleQuickBuy}
              disabled={isOutOfStock}
              className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                isOutOfStock
                  ? 'bg-neutral-800/40 text-neutral-600 cursor-not-allowed border border-neutral-800/50'
                  : justQuickBought
                  ? 'bg-emerald-600 text-white scale-[1.02] shadow-emerald-500/25'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 hover:shadow-md hover:shadow-emerald-500/20 active:scale-95'
              }`}
              title={isOutOfStock ? 'Sold Out' : 'Quick Buy: Immediately add to cart and receive instant confirmation'}
            >
              {isOutOfStock ? (
                <span>Unavailable</span>
              ) : justQuickBought ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Reserved!</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current text-neutral-950" />
                  <span>Quick Buy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
