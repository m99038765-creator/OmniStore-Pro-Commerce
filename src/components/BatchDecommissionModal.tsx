import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  ArchiveX,
  ShieldAlert,
  Lock,
  CheckSquare,
  Square,
  Search,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  PackageX
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

interface BatchDecommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds?: string[];
  onSuccess?: (message: string) => void;
}

const REASON_PRESETS = [
  'End of Life (EOL) Hardware',
  'Supplier Discontinued',
  'Replaced by Newer Revision',
  'Obsolete Warehouse SKU'
];

export const BatchDecommissionModal: React.FC<BatchDecommissionModalProps> = ({
  isOpen,
  onClose,
  initialSelectedIds = [],
  onSuccess
}) => {
  const {
    products,
    batchDecommissionProducts,
    batchAdjustStock
  } = useStore();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'eligible' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [reason, setReason] = useState('End of Life (EOL) Hardware');
  const [confirmedPermanent, setConfirmedPermanent] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [zeroingProductId, setZeroingProductId] = useState<string | null>(null);
  const [guardrailNotice, setGuardrailNotice] = useState<string | null>(null);
  const [excludedPreselectedCount, setExcludedPreselectedCount] = useState(0);
  const [receipt, setReceipt] = useState<{
    count: number;
    skus: string[];
    timestamp: string;
  } | null>(null);

  // Sync initial selection when modal opens — strictly allow ONLY zero-stock SKUs
  useEffect(() => {
    if (!isOpen) return;
    const eligibleInitial: string[] = [];
    let blockedInitial = 0;

    for (const id of initialSelectedIds) {
      const prod = products.find(p => p.id === id);
      if (!prod) continue;
      if (prod.stock === 0) {
        eligibleInitial.push(prod.id);
      } else {
        blockedInitial++;
      }
    }

    setSelectedIds(eligibleInitial);
    setExcludedPreselectedCount(blockedInitial);
    setConfirmedPermanent(false);
    setGuardrailNotice(null);
    setReceipt(null);
  }, [isOpen]);

  // Automatically drop any selected ID if stock increases above 0 or product is removed
  useEffect(() => {
    setSelectedIds(prev =>
      prev.filter(id => {
        const prod = products.find(p => p.id === id);
        return Boolean(prod && prod.stock === 0);
      })
    );
  }, [products]);

  const eligibleProducts = useMemo(
    () => products.filter(p => p.stock === 0),
    [products]
  );

  const lockedProducts = useMemo(
    () => products.filter(p => p.stock > 0),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products
      .filter(p => {
        if (filterMode === 'eligible' && p.stock !== 0) return false;
        if (filterMode === 'locked' && p.stock === 0) return false;
        if (q) {
          return (
            p.sku.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            p.warehouse.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q)
          );
        }
        return true;
      })
      // Always sort zero-stock (eligible) products to the top so managers see them first
      .sort((a, b) => {
        if (a.stock === 0 && b.stock > 0) return -1;
        if (a.stock > 0 && b.stock === 0) return 1;
        return a.stock - b.stock;
      });
  }, [products, filterMode, searchQuery]);

  const selectedEligibleProducts = useMemo(
    () =>
      products.filter(p => selectedIds.includes(p.id) && p.stock === 0),
    [products, selectedIds]
  );

  const handleToggleProduct = (product: Product) => {
    if (product.stock > 0) {
      setGuardrailNotice(
        `Zero-stock rule: "${product.sku}" still has ${product.stock} unit${
          product.stock === 1 ? '' : 's'
        } in stock and cannot be decommissioned until stock reaches 0.`
      );
      return;
    }

    setGuardrailNotice(null);
    setSelectedIds(prev =>
      prev.includes(product.id)
        ? prev.filter(id => id !== product.id)
        : [...prev, product.id]
    );
  };

  const handleSelectAllEligible = () => {
    const visibleEligibleIds = filteredProducts
      .filter(p => p.stock === 0)
      .map(p => p.id);
    if (visibleEligibleIds.length === 0) {
      setGuardrailNotice(
        'No zero-stock SKUs match the current filter. Only products with 0 units in stock can be selected for decommissioning.'
      );
      return;
    }
    setGuardrailNotice(null);
    setSelectedIds(prev => Array.from(new Set([...prev, ...visibleEligibleIds])));
  };

  const handleZeroOutStock = async (product: Product) => {
    if (zeroingProductId) return;
    setZeroingProductId(product.id);
    setGuardrailNotice(null);
    const res = await batchAdjustStock({
      productIds: [product.id],
      adjustmentType: 'set',
      quantity: 0,
      reason: 'Stock cleared to 0 prior to obsolete SKU decommission'
    });
    setZeroingProductId(null);
    if (res.success) {
      setSelectedIds(prev => (prev.includes(product.id) ? prev : [...prev, product.id]));
    }
  };

  const handleExecuteDecommission = async () => {
    if (
      isExecuting ||
      selectedEligibleProducts.length === 0 ||
      !confirmedPermanent
    ) {
      return;
    }

    setIsExecuting(true);
    setGuardrailNotice(null);
    const result = await batchDecommissionProducts(
      selectedEligibleProducts.map(p => p.id),
      reason
    );
    setIsExecuting(false);

    if (result.success) {
      setSelectedIds([]);
      setConfirmedPermanent(false);
      setReceipt({
        count: result.decommissionedCount,
        skus: result.decommissionedSkus,
        timestamp: result.timestamp
      });
      if (onSuccess) {
        onSuccess(
          `Batch Decommission completed: permanently removed ${
            result.decommissionedCount
          } zero-stock obsolete SKU${
            result.decommissionedCount === 1 ? '' : 's'
          } (${result.decommissionedSkus.join(', ')}).`
        );
      }
    } else if (result.error) {
      setGuardrailNotice(result.error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="batch-decommission-modal-backdrop"
        className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          id="batch-decommission-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
          onClick={e => e.stopPropagation()}
          className="relative bg-neutral-950 border border-rose-500/35 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/35 flex items-center justify-center text-rose-400 shrink-0">
                <ArchiveX className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white">
                    Batch Decommission Obsolete SKUs
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    ZERO-STOCK ENFORCED
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Permanently retire obsolete warehouse SKUs. Products with remaining inventory are locked automatically.
                </p>
              </div>
            </div>

            <button
              type="button"
              id="close-batch-decommission-modal-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Close Batch Decommission modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Hard Policy Banner */}
            <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/35 flex items-start gap-2.5 text-xs">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-200">
                  Strict Zero-Stock Guardrail Active
                </p>
                <p className="text-neutral-300 text-[11px] leading-relaxed">
                  Only SKUs with exactly <strong className="font-mono text-white">0 units</strong> in stock can be selected and decommissioned. Stocked items are locked to prevent accidental loss of active inventory—clear remaining stock to 0 first if an item is truly obsolete.
                </p>
              </div>
            </div>

            {/* Excluded Pre-selection Notice */}
            {excludedPreselectedCount > 0 && (
              <div className="p-2.5 rounded-xl bg-neutral-900 border border-amber-500/40 text-xs text-amber-300 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Excluded <strong>{excludedPreselectedCount}</strong> pre-selected SKU
                    {excludedPreselectedCount === 1 ? '' : 's'} because stock is greater than 0.
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setExcludedPreselectedCount(0)}
                  className="text-neutral-400 hover:text-white text-[11px] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Guardrail Warning Toast Banner */}
            {guardrailNotice && (
              <div
                id="batch-decommission-guardrail-alert"
                className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-xs text-rose-200 flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{guardrailNotice}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setGuardrailNotice(null)}
                  className="text-rose-300 hover:text-white text-[11px] cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Execution Success Receipt */}
            {receipt && (
              <div
                id="batch-decommission-receipt-banner"
                className="p-3.5 rounded-xl bg-emerald-950/45 border border-emerald-500/45 text-xs text-emerald-200 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-300">
                      Decommissioned {receipt.count} Obsolete SKU
                      {receipt.count === 1 ? '' : 's'}
                    </p>
                    <p className="text-[11px] text-emerald-200/85 font-mono mt-0.5">
                      Removed: {receipt.skus.join(', ')} · Logged to Warehouse Audit Trail
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="text-emerald-300 hover:text-white text-[11px] cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}

            {/* KPI Summary Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                  Eligible (0 Stock)
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-0.5 block ${
                    eligibleProducts.length > 0 ? 'text-emerald-400' : 'text-neutral-400'
                  }`}
                >
                  {eligibleProducts.length} SKUs
                </span>
                <span className="text-[10px] text-neutral-400">
                  ready for decommission
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                  Locked (In Stock)
                </span>
                <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">
                  {lockedProducts.length} SKUs
                </span>
                <span className="text-[10px] text-neutral-400">
                  protected by stock &gt; 0
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                  Selected to Remove
                </span>
                <span
                  className={`text-xl font-bold font-mono mt-0.5 block ${
                    selectedEligibleProducts.length > 0 ? 'text-rose-400' : 'text-neutral-400'
                  }`}
                >
                  {selectedEligibleProducts.length} SKUs
                </span>
                <span className="text-[10px] text-neutral-400">
                  all verified at 0 units
                </span>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: `All (${products.length})` },
                  { id: 'eligible', label: `0 Stock Eligible (${eligibleProducts.length})` },
                  { id: 'locked', label: `In Stock Locked (${lockedProducts.length})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilterMode(tab.id as 'all' | 'eligible' | 'locked')}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer ${
                      filterMode === tab.id
                        ? 'bg-neutral-800 text-white border-neutral-600'
                        : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                <div className="relative flex-1 sm:w-52">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="batch-decommission-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Filter SKU, name, hub..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-rose-500/60"
                  />
                </div>

                <button
                  type="button"
                  id="batch-decommission-select-eligible-btn"
                  onClick={handleSelectAllEligible}
                  disabled={eligibleProducts.length === 0}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 text-rose-200 border border-rose-500/35 transition-colors cursor-pointer shrink-0"
                >
                  Select All Eligible
                </button>

                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="px-2 py-1.5 rounded-lg text-[11px] text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* SKU Eligibility Table */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="p-8 rounded-xl bg-neutral-900/50 border border-neutral-800 text-center space-y-2">
                  <PackageX className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-sm font-semibold text-neutral-300">
                    No SKUs match this filter
                  </p>
                  <p className="text-xs text-neutral-500">
                    {filterMode === 'eligible'
                      ? 'All remaining catalog SKUs currently have stock > 0. Clear stock to 0 on obsolete items to unlock decommissioning.'
                      : 'Try adjusting your search query.'}
                  </p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const isEligible = product.stock === 0;
                  const isSelected = isEligible && selectedIds.includes(product.id);
                  const isZeroing = zeroingProductId === product.id;

                  return (
                    <div
                      key={product.id}
                      id={`decommission-row-${product.id}`}
                      onClick={() => handleToggleProduct(product)}
                      className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
                        isSelected
                          ? 'bg-rose-950/35 border-rose-500/60 cursor-pointer'
                          : isEligible
                          ? 'bg-neutral-900/75 border-neutral-800 hover:border-emerald-500/45 cursor-pointer'
                          : 'bg-neutral-900/35 border-neutral-800/70 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Selection Checkbox or Lock */}
                        <button
                          type="button"
                          id={`decommission-select-${product.id}`}
                          disabled={!isEligible}
                          onClick={e => {
                            e.stopPropagation();
                            handleToggleProduct(product);
                          }}
                          aria-label={
                            isEligible
                              ? `Select ${product.sku} for decommission`
                              : `${product.sku} locked with ${product.stock} units in stock`
                          }
                          className={`p-1 rounded-lg transition-colors shrink-0 ${
                            isEligible
                              ? isSelected
                                ? 'text-rose-400'
                                : 'text-neutral-400 hover:text-white'
                              : 'text-amber-500/70 cursor-not-allowed'
                          }`}
                        >
                          {isEligible ? (
                            isSelected ? (
                              <CheckSquare className="w-4 h-4" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </button>

                        <img
                          src={product.images[0]}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className={`w-10 h-10 rounded-lg object-cover border border-neutral-800 shrink-0 ${
                            !isEligible ? 'grayscale-[30%]' : ''
                          }`}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-sky-400">
                              {product.sku}
                            </span>
                            <span className="text-xs font-semibold text-white truncate">
                              {product.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5 font-mono">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-neutral-500" />
                              {product.warehouse}
                            </span>
                            <span>${product.price.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Status Badge + Optional Clear-to-0 Helper */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isEligible ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                            0 Units · Eligible
                          </span>
                        ) : (
                          <>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/35 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>Locked · {product.stock} in Stock</span>
                            </span>
                            <button
                              type="button"
                              id={`decommission-zero-out-${product.id}`}
                              disabled={Boolean(zeroingProductId)}
                              onClick={e => {
                                e.stopPropagation();
                                handleZeroOutStock(product);
                              }}
                              title="Set stock to 0 units first so this obsolete SKU becomes eligible for decommissioning"
                              className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {isZeroing ? 'Clearing...' : 'Set Stock to 0'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Decommission Reason & Audit Note */}
            <div className="p-3.5 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="batch-decommission-reason-input"
                  className="text-xs font-semibold text-neutral-200"
                >
                  Decommission Audit Reason
                </label>
                <span className="text-[10px] font-mono text-neutral-500">
                  Recorded permanently in SKU Audit Log
                </span>
              </div>

              <input
                id="batch-decommission-reason-input"
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Enter reason for decommissioning obsolete SKUs..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 mr-1">Presets:</span>
                {REASON_PRESETS.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono border transition-colors cursor-pointer ${
                      reason === preset
                        ? 'bg-rose-500/20 text-rose-200 border-rose-500/45 font-semibold'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Confirmation & Execution */}
          <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-900/80 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
              <input
                id="batch-decommission-confirm-checkbox"
                type="checkbox"
                checked={confirmedPermanent}
                disabled={selectedEligibleProducts.length === 0}
                onChange={e => setConfirmedPermanent(e.target.checked)}
                className="w-4 h-4 rounded border-neutral-600 bg-neutral-950 accent-rose-500 cursor-pointer disabled:opacity-40"
              />
              <span>
                Confirm permanent removal of{' '}
                <strong className="font-mono text-white">
                  {selectedEligibleProducts.length}
                </strong>{' '}
                zero-stock SKU{selectedEligibleProducts.length === 1 ? '' : 's'}
              </span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                id="execute-batch-decommission-btn"
                disabled={
                  isExecuting ||
                  selectedEligibleProducts.length === 0 ||
                  !confirmedPermanent
                }
                onClick={handleExecuteDecommission}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:border-neutral-700 text-white border border-rose-500/60 flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                {isExecuting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Decommissioning...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      Decommission {selectedEligibleProducts.length} Obsolete SKU
                      {selectedEligibleProducts.length === 1 ? '' : 's'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
