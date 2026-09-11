import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Star, ShoppingBag, Eye, ShieldAlert, Check, MapPin, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addToCart, setQuickViewProduct } = useStore();
  const [justAdded, setJustAdded] = useState(false);

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutOfStock) return;
    const res = addToCart(product, 1);
    if (res.success) {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);
    }
  };

  return (
    <div
      id={`product-card-${product.id}`}
      className="group relative flex flex-col bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700/80 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-black/40"
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
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide bg-amber-950/90 text-amber-300 border border-amber-800/80 shadow-lg shadow-amber-950/40 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              Only {product.stock} Left In Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium bg-neutral-950/80 text-emerald-400 border border-neutral-800/80 backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {product.stock} In Stock
            </span>
          )}

          {product.isTrending && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md w-fit">
              <Sparkles className="w-3 h-3" />
              High Demand
            </span>
          )}
        </div>

        {/* Warehouse Tag */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-neutral-300 bg-neutral-950/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-neutral-800/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <MapPin className="w-3 h-3 text-emerald-400" />
            {product.warehouse.split('(')[0].trim()}
          </span>
          <span className="font-mono text-[10px] text-neutral-400">{product.sku}</span>
        </div>

        {/* Quick View Button Overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setQuickViewProduct(product);
          }}
          className="absolute top-3 right-3 p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 text-neutral-200 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
          title="Quick Inspection & Specs"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Content Canvas */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 justify-between">
        <div>
          {/* Rating & Review */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className="flex items-center gap-1 text-amber-400 font-medium">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{product.rating.toFixed(1)}</span>
              <span className="text-neutral-500 text-[11px]">({product.reviewCount})</span>
            </div>
            <span className="text-[11px] text-neutral-500 font-mono capitalize">
              {product.category}
            </span>
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
        </div>

        {/* Price & Action Row */}
        <div className="mt-4 pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-2">
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
            id={`add-to-cart-${product.id}`}
            onClick={handleAdd}
            disabled={isOutOfStock}
            className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              isOutOfStock
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
                : justAdded
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 hover:bg-emerald-400 text-neutral-950 hover:text-neutral-950 active:scale-95 shadow-md'
            }`}
          >
            {isOutOfStock ? (
              <span>Sold Out</span>
            ) : justAdded ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
