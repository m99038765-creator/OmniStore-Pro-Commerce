import React, { useMemo } from 'react';
import {
  Flame,
  Sliders,
  Eye,
  ArrowUpRight,
  PackagePlus,
  TrendingUp,
  MapPin,
  Sparkles,
  Zap
} from 'lucide-react';
import { Product } from '../types';

interface WarehouseFrequentSkusProps {
  products: Product[];
  accessCounts: Record<string, number>;
  onOpenDetails: (product: Product) => void;
  onOpenStockAdjust: (product: Product) => void;
  onQuickRestock: (product: Product, quantity: number) => void;
  onJumpToRow: (productId: string) => void;
}

export const WarehouseFrequentSkus: React.FC<WarehouseFrequentSkusProps> = ({
  products,
  accessCounts,
  onOpenDetails,
  onOpenStockAdjust,
  onQuickRestock,
  onJumpToRow
}) => {
  // Sort and select top 5 most accessed SKUs
  const topFiveSkus = useMemo(() => {
    return products
      .map(p => ({
        product: p,
        accessCount: accessCounts[p.id] || 0
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5);
  }, [products, accessCounts]);

  if (topFiveSkus.length === 0) return null;

  return (
    <div
      id="warehouse-frequent-skus-section"
      className="mb-5 p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3.5 relative overflow-hidden"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Frequent SKUs
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                TOP 5 ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Rapid navigation to high-velocity inventory details and stock adjustment settings.
            </p>
          </div>
        </div>

        <div className="text-[10px] font-mono text-neutral-500 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Real-time access frequency telemetry</span>
        </div>
      </div>

      {/* 5 Frequent SKUs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {topFiveSkus.map(({ product, accessCount }, index) => {
          const rank = index + 1;
          const isOutOfStock = product.stock <= 0;
          const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

          return (
            <div
              key={product.id}
              id={`frequent-sku-card-${product.id}`}
              className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/90 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-2.5 group relative"
            >
              {/* Card Header: Rank & Hits badge */}
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span
                  className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                    rank === 1
                      ? 'bg-amber-500 text-neutral-950 font-black'
                      : rank === 2
                      ? 'bg-neutral-200 text-neutral-950 font-bold'
                      : rank === 3
                      ? 'bg-amber-700/60 text-amber-200 font-bold'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}
                >
                  #{rank}
                </span>

                <span className="font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                  {accessCount} visits
                </span>
              </div>

              {/* Product Info Block */}
              <div className="flex items-start gap-2.5 min-w-0">
                <img
                  src={product.images[0]}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[10px] text-sky-400 font-bold block truncate">
                    {product.sku}
                  </span>
                  <h5 className="text-xs font-semibold text-white truncate leading-tight mt-0.5" title={product.name}>
                    {product.name}
                  </h5>
                  <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">
                    ${product.price.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Stock Status Badge */}
              <div className="flex items-center justify-between pt-1 border-t border-neutral-900 text-[11px]">
                <span className="text-[10px] text-neutral-500 font-mono">Stock:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                    isOutOfStock
                      ? 'bg-rose-500/20 text-rose-300'
                      : isLowStock
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {product.stock} units
                </span>
              </div>

              {/* Rapid Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                {/* Details Button */}
                <button
                  type="button"
                  id={`frequent-sku-details-btn-${product.id}`}
                  onClick={() => onOpenDetails(product)}
                  title="View full SKU specifications & details"
                  className="py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3 h-3 text-sky-400" />
                  <span>Details</span>
                </button>

                {/* Stock Adjustment Settings Button */}
                <button
                  type="button"
                  id={`frequent-sku-adjust-btn-${product.id}`}
                  onClick={() => onOpenStockAdjust(product)}
                  title="Open stock adjustment settings"
                  className="py-1.5 px-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                >
                  <Sliders className="w-3 h-3 text-emerald-400" />
                  <span>Adjust</span>
                </button>
              </div>

              {/* Quick Jump and Restock Row */}
              <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-0.5">
                <button
                  type="button"
                  id={`frequent-sku-jump-btn-${product.id}`}
                  onClick={() => onJumpToRow(product.id)}
                  className="hover:text-white flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <span>Jump to row</span>
                  <ArrowUpRight className="w-3 h-3 text-neutral-500" />
                </button>

                <button
                  type="button"
                  id={`frequent-sku-quick-add-${product.id}`}
                  onClick={() => onQuickRestock(product, 5)}
                  className="text-emerald-400 hover:text-emerald-300 font-mono font-bold hover:underline cursor-pointer"
                  title="Quickly restock +5 units"
                >
                  +5 Restock
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
