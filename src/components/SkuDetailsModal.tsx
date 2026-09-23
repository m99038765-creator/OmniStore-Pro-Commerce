import React from 'react';
import {
  X,
  Boxes,
  MapPin,
  ScanLine,
  QrCode,
  Sliders,
  DollarSign,
  ShieldCheck,
  TrendingDown,
  Layers,
  ArrowUpRight,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { Product } from '../types';

interface SkuDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenStockAdjust: (product: Product) => void;
  onOpenScanner: (product: Product) => void;
  onOpenQrCode: (product: Product) => void;
  onOpenAuditLog?: (product: Product) => void;
  onJumpToRow: (productId: string) => void;
}

export const SkuDetailsModal: React.FC<SkuDetailsModalProps> = ({
  product,
  isOpen,
  onClose,
  onOpenStockAdjust,
  onOpenScanner,
  onOpenQrCode,
  onOpenAuditLog,
  onJumpToRow
}) => {
  if (!isOpen || !product) return null;

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
  const totalValuation = (product.price * product.stock).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return (
    <div
      id="sku-details-backdrop"
      className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id={`sku-details-modal-${product.id}`}
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">SKU Specification & Details</h3>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                  {product.sku}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">{product.category.toUpperCase()} • Warehouse Bay Telemetry</p>
            </div>
          </div>
          <button
            id="close-sku-details-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Main Hero Summary */}
          <div className="flex gap-4 p-4 rounded-xl bg-neutral-950 border border-neutral-800">
            <img
              src={product.images[0]}
              alt=""
              className="w-20 h-20 rounded-xl object-cover bg-neutral-900 border border-neutral-800 shrink-0"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <h4 className="text-sm font-bold text-white leading-tight">{product.name}</h4>
              <p className="text-xs text-neutral-400 line-clamp-2">{product.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-base font-mono font-bold text-emerald-400">
                  ${product.price.toFixed(2)}
                </span>
                <span className="text-neutral-500 text-xs">•</span>
                <span className="text-xs text-neutral-400 font-mono">
                  Valuation: <strong className="text-white">${totalValuation}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Available Units</span>
              <span
                className={`text-lg font-mono font-bold block mt-0.5 ${
                  isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {product.stock}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono block">In Stock</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Low Stock Limit</span>
              <span className="text-lg font-mono font-bold text-amber-400 block mt-0.5">
                {product.lowStockThreshold}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono block">Safety Margin</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Allocated Hold</span>
              <span className="text-lg font-mono font-bold text-sky-400 block mt-0.5">
                {product.reserved}
              </span>
              <span className="text-[9px] text-neutral-500 font-mono block">Active Carts</span>
            </div>
          </div>

          {/* Warehouse Physical Location */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
            <span className="text-[10px] uppercase font-semibold text-neutral-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-400" />
              <span>Assigned Storage Facility & Bay</span>
            </span>
            <p className="text-xs font-mono font-semibold text-white">
              {product.warehouse}
            </p>
          </div>

          {/* Technical Specifications */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                Technical Specifications
              </span>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden divide-y divide-neutral-900 text-xs font-mono">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between p-2.5">
                    <span className="text-neutral-400">{key}</span>
                    <span className="text-neutral-200 font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rapid Navigation & Action Shortcuts */}
          <div className="space-y-2 pt-2 border-t border-neutral-800">
            <span className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
              Direct Action Shortcuts
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id={`details-modal-adjust-stock-btn-${product.id}`}
                onClick={() => {
                  onClose();
                  onOpenStockAdjust(product);
                }}
                className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Adjust Stock Settings</span>
              </button>

              <button
                type="button"
                id={`details-modal-scan-barcode-btn-${product.id}`}
                onClick={() => {
                  onClose();
                  onOpenScanner(product);
                }}
                className="p-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Scan Barcode</span>
              </button>

              <button
                type="button"
                id={`details-modal-qr-code-btn-${product.id}`}
                onClick={() => {
                  onClose();
                  onOpenQrCode(product);
                }}
                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-neutral-700"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Generate Mobile QR</span>
              </button>

              <button
                type="button"
                id={`details-modal-audit-log-btn-${product.id}`}
                onClick={() => {
                  onClose();
                  if (onOpenAuditLog) onOpenAuditLog(product);
                }}
                className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-amber-500/30"
              >
                <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                <span>View Stock Audit Log</span>
              </button>

              <button
                type="button"
                id={`details-modal-jump-to-row-btn-${product.id}`}
                onClick={() => {
                  onClose();
                  onJumpToRow(product.id);
                }}
                className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-neutral-700"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Jump to Table Row</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-neutral-800 bg-neutral-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
