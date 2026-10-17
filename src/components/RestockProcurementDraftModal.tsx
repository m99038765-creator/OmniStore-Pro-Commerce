import React, { useState, useMemo } from 'react';
import {
  PackagePlus,
  X,
  Truck,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  DollarSign,
  TrendingDown,
  Layers,
  Sparkles,
  Download,
  Copy,
  ExternalLink
} from 'lucide-react';
import { RestockProcurementDraft, RestockProcurementItem, Product } from '../types';
import { useStore } from '../context/StoreContext';

interface RestockProcurementDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  draft: RestockProcurementDraft | null;
  onUpdateDraft: (updated: RestockProcurementDraft) => void;
  onSuccessRestock?: (summaryText: string) => void;
}

export const RestockProcurementDraftModal: React.FC<RestockProcurementDraftModalProps> = ({
  isOpen,
  onClose,
  draft,
  onUpdateDraft,
  onSuccessRestock
}) => {
  const { batchAdjustStock } = useStore();
  const [isExecuting, setIsExecuting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !draft) return null;

  const handleToggleInclude = (productId: string) => {
    const updatedItems = draft.items.map(item => {
      if (item.productId === productId) {
        return { ...item, includedInDraft: !item.includedInDraft };
      }
      return item;
    });
    // Recalculate totals
    const included = updatedItems.filter(i => i.includedInDraft);
    const totalEstCost = included.reduce((sum, i) => sum + i.totalCost, 0);
    const totalUnits = included.reduce((sum, i) => sum + i.recommendedOrderQty, 0);

    onUpdateDraft({
      ...draft,
      items: updatedItems,
      totalEstimatedCost: totalEstCost,
      totalUnits
    });
  };

  const handleQtyChange = (productId: string, newQty: number) => {
    const safeQty = Math.max(1, newQty);
    const updatedItems = draft.items.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          recommendedOrderQty: safeQty,
          totalCost: safeQty * item.unitWholesaleCost
        };
      }
      return item;
    });

    const included = updatedItems.filter(i => i.includedInDraft);
    const totalEstCost = included.reduce((sum, i) => sum + i.totalCost, 0);
    const totalUnits = included.reduce((sum, i) => sum + i.recommendedOrderQty, 0);

    onUpdateDraft({
      ...draft,
      items: updatedItems,
      totalEstimatedCost: totalEstCost,
      totalUnits
    });
  };

  const handleApproveAndExecuteRestock = async () => {
    setIsExecuting(true);
    try {
      const includedItems = draft.items.filter(i => i.includedInDraft);
      if (includedItems.length === 0) {
        alert('Please select at least one item to procure.');
        setIsExecuting(false);
        return;
      }

      const productIds = includedItems.map(i => i.productId);
      const totalQty = includedItems.reduce((sum, i) => sum + i.recommendedOrderQty, 0);
      
      // Execute batch inventory restock in StoreContext
      await batchAdjustStock({
        productIds,
        adjustmentType: 'add',
        quantity: Math.round(totalQty / productIds.length) || 50,
        reason: `Automated Predictive Restock PO #${draft.poNumber}`
      });

      const successText = `Successfully generated PO #${draft.poNumber} & replenished ${includedItems.length} SKUs (${totalQty} units total).`;
      setSuccessMessage(successText);
      if (onSuccessRestock) {
        onSuccessRestock(successText);
      }

      setTimeout(() => {
        setIsExecuting(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to execute restock procurement:', err);
      setIsExecuting(false);
    }
  };

  const handleCopySummary = () => {
    const textSummary = `[RESTOCK PROCUREMENT PO #${draft.poNumber}]\\n` +
      `Target Warehouse: ${draft.targetWarehouse}\\n` +
      `Total Cost: $${draft.totalEstimatedCost.toLocaleString()}\\n` +
      `Items:\\n` +
      draft.items.filter(i => i.includedInDraft).map(i => `- ${i.sku}: ${i.name} x ${i.recommendedOrderQty} units (Stockout: ${i.projectedStockoutDateLabel})`).join('\\n');

    navigator.clipboard.writeText(textSummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const includedCount = draft.items.filter(i => i.includedInDraft).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Restock Procurement Draft</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  PO #{draft.poNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automated replenishment simulation based on recent daily outflow velocity trends & stock-out risk horizons.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Procurement Draft Executed!</h3>
            <p className="text-sm text-emerald-300 max-w-md">{successMessage}</p>
          </div>
        ) : (
          <>
            {/* Top Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950/60 border-b border-slate-800">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Warehouse</div>
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">{draft.targetWarehouse}</div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Target Delivery</div>
                  <div className="text-xs font-semibold text-white truncate max-w-[140px]">{draft.targetDeliveryDate}</div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Total Est. Cost</div>
                  <div className="text-xs font-semibold text-emerald-300">${draft.totalEstimatedCost.toLocaleString()}</div>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono text-slate-400">Items Included</div>
                  <div className="text-xs font-semibold text-white">{includedCount} of {draft.items.length} SKUs</div>
                </div>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <span>Select SKUs to include in this automated restock draft order. Quantities are calculated to cover projected demand through lead-time + safety buffer.</span>
                <span className="font-mono text-emerald-400">Simulation Model: Exponential Velocity Outflow v2.4</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-mono uppercase text-slate-400">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={includedCount === draft.items.length}
                          onChange={(e) => {
                            const val = e.target.checked;
                            const updated = draft.items.map(i => ({ ...i, includedInDraft: val }));
                            const included = updated.filter(i => i.includedInDraft);
                            onUpdateDraft({
                              ...draft,
                              items: updated,
                              totalEstimatedCost: included.reduce((s, i) => s + i.totalCost, 0),
                              totalUnits: included.reduce((s, i) => s + i.recommendedOrderQty, 0)
                            });
                          }}
                          className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                        />
                      </th>
                      <th className="p-3">Product / SKU</th>
                      <th className="p-3 text-center">Stock / Res</th>
                      <th className="p-3 text-center">Daily Velocity</th>
                      <th className="p-3 text-center">Stock-Out Date</th>
                      <th className="p-3 text-center">Suggested PO Qty</th>
                      <th className="p-3 text-right">Est. Line Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {draft.items.map((item) => {
                      const isCritical = item.urgency === 'critical';
                      return (
                        <tr
                          key={item.productId}
                          className={`hover:bg-slate-900/60 transition-colors ${!item.includedInDraft ? 'opacity-40 bg-slate-950/40' : ''}`}
                        >
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.includedInDraft}
                              onChange={() => handleToggleInclude(item.productId)}
                              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-emerald-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-3">
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1553413077-190dd305871c?w=100&auto=format&fit=crop&q=60';
                                }}
                              />
                              <div>
                                <div className="font-medium text-white truncate max-w-[220px]">{item.name}</div>
                                <div className="font-mono text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <span className="text-emerald-400">{item.sku}</span>
                                  <span>•</span>
                                  <span>{item.warehouse}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center font-mono">
                            <div className="text-white font-semibold">{item.availableStock}</div>
                            <div className="text-[10px] text-slate-400">Total: {item.currentStock}</div>
                          </td>
                          <td className="p-3 text-center font-mono text-amber-400 font-medium">
                            -{item.dailyVelocity.toFixed(1)}/day
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${
                              isCritical ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
                            }`}>
                              {isCritical && <AlertTriangle className="w-3 h-3 text-rose-400 flex-shrink-0" />}
                              {item.projectedStockoutDateLabel}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                              <button
                                onClick={() => handleQtyChange(item.productId, item.recommendedOrderQty - 10)}
                                className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-mono text-xs"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.recommendedOrderQty}
                                onChange={(e) => handleQtyChange(item.productId, parseInt(e.target.value) || 1)}
                                className="w-14 bg-transparent text-center font-mono text-white text-xs focus:outline-none"
                              />
                              <button
                                onClick={() => handleQtyChange(item.productId, item.recommendedOrderQty + 10)}
                                className="w-6 h-6 rounded bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 flex items-center justify-center font-mono text-xs"
                              >
                                +
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-400">
                            ${item.totalCost.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySummary}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied PO Text!' : 'Copy PO Summary'}
                </button>
                <span className="text-xs text-slate-400 font-mono">
                  {includedCount} SKUs ready for instant procurement dispatch
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApproveAndExecuteRestock}
                  disabled={isExecuting || includedCount === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
                >
                  {isExecuting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Dispatching PO & Restocking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
                      Approve & Execute Restock PO
                    </>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
