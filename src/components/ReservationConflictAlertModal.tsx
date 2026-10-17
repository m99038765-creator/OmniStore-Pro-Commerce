import React from 'react';
import { AlertTriangle, Lock, X, Check, ShieldAlert } from 'lucide-react';
import { Product } from '../types';

interface ReservationConflictAlertModalProps {
  product?: Product | null;
  bulkProducts?: Product[] | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmOverride?: (product: Product) => void;
  onConfirmBulkOverride?: (products: Product[]) => void;
  onConfirmAddOnlyNonReserved?: () => void;
}

export const ReservationConflictAlertModal: React.FC<ReservationConflictAlertModalProps> = ({
  product,
  bulkProducts,
  isOpen,
  onClose,
  onConfirmOverride,
  onConfirmBulkOverride,
  onConfirmAddOnlyNonReserved
}) => {
  if (!isOpen) return null;

  const isBulk = Boolean(bulkProducts && bulkProducts.length > 0);

  return (
    <div
      id="reservation-conflict-alert-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        id="reservation-conflict-alert-modal"
        className="bg-neutral-900 border-2 border-amber-500/80 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl shadow-amber-950/70 text-white space-y-4 relative overflow-hidden"
      >
        {/* Amber Ambient Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 stroke-[2.5] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-500/25 text-amber-300 border border-amber-500/50">
                  Visual Conflict Helper
                </span>
                <span className="text-[11px] font-mono text-neutral-400">
                  {isBulk ? `${bulkProducts?.length} Reserved SKUs` : 'Active Staff Hold'}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white mt-1">
                {isBulk
                  ? 'Batch Selection Contains Reserved Items'
                  : 'Active "Reserved" Status Conflict Detected'}
              </h3>
            </div>
          </div>

          <button
            id="conflict-alert-close-x-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Dismiss conflict alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conflict Details Content */}
        {!isBulk && product ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-300 leading-relaxed">
              You are attempting to add an item to the batch stock update that currently has an active reservation lock held by another staff member.
            </p>

            <div className="p-3.5 rounded-xl bg-neutral-950 border border-amber-500/30 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400">Target SKU:</span>
                <span className="font-mono text-sky-400 font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  {product.sku}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400">Item Name:</span>
                <span className="font-semibold text-neutral-200 truncate max-w-[220px]">
                  {product.name}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400">Locked Units:</span>
                <span className="font-bold text-amber-300 font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>{product.reserved || 1} unit(s) reserved</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400">Reserved By:</span>
                <span className="text-amber-200 font-medium text-[11px] bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  {product.reservedBy || 'Staff Member (Active Hold / Allocation)'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-400">Regional Hub:</span>
                <span className="text-neutral-300 font-mono text-[11px]">
                  {product.warehouse.split('(')[0].trim()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Operational Risk:</strong> Performing uniform stock deductions or overrides on reserved inventory can break pending order fulfillment allocations, cause station discrepancies, or overwrite locked stock counts.
              </span>
            </div>
          </div>
        ) : isBulk && bulkProducts ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-300 leading-relaxed">
              <strong>{bulkProducts.length}</strong> of the SKUs you are selecting currently have active reservation locks by warehouse staff members:
            </p>

            <div className="p-3 rounded-xl bg-neutral-950 border border-amber-500/30 max-h-48 overflow-y-auto space-y-2 text-xs">
              {bulkProducts.map(p => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b border-neutral-900 pb-1.5 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-sky-400 bg-neutral-900 px-1.5 py-0.5 rounded mr-1.5 font-bold">
                      {p.sku}
                    </span>
                    <span className="text-neutral-200 truncate inline-block max-w-[160px] align-middle text-[11px]">
                      {p.name}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[10px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40">
                      {p.reserved || 1} held by {p.reservedBy ? p.reservedBy.split('(')[0].trim() : 'Staff'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300/90 leading-relaxed flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                We recommend excluding items with active staff reservations from uniform batch updates to protect active customer orders.
              </span>
            </div>
          </div>
        ) : null}

        {/* Modal Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-neutral-800">
          {!isBulk && product ? (
            <>
              <button
                id="conflict-alert-cancel-btn"
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel (Exclude Item)
              </button>
              {onConfirmOverride && (
                <button
                  id="conflict-alert-override-btn"
                  type="button"
                  onClick={() => {
                    onConfirmOverride(product);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer transition-colors shadow-md shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Override & Add to Batch</span>
                </button>
              )}
            </>
          ) : isBulk && bulkProducts ? (
            <>
              <button
                id="conflict-bulk-cancel-btn"
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>

              {onConfirmAddOnlyNonReserved && (
                <button
                  id="conflict-bulk-non-reserved-btn"
                  type="button"
                  onClick={() => {
                    onConfirmAddOnlyNonReserved();
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs cursor-pointer transition-colors shadow-md shadow-sky-500/20 flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Add Only Non-Reserved Items</span>
                </button>
              )}

              {onConfirmBulkOverride && (
                <button
                  id="conflict-bulk-override-btn"
                  type="button"
                  onClick={() => {
                    onConfirmBulkOverride(bulkProducts);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold text-xs cursor-pointer transition-colors"
                >
                  Override (Include All)
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
