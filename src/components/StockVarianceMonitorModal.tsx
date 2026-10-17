import React, { useState, useMemo } from 'react';
import {
  Scale,
  X,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Layers,
  ArrowRight,
  ShieldAlert,
  Check,
  Eye,
  Flag
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface StockVarianceMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onOpenBatchAdjusterForIds?: (productIds: string[]) => void;
}

interface PhysicalAuditRecord {
  productId: string;
  sku: string;
  name: string;
  warehouse: string;
  systemStock: number;
  physicalCount: number;
  varianceDelta: number;
  variancePercent: number;
  status: 'matched' | 'minor-variance' | 'major-variance';
  reconciled: boolean;
}

export const StockVarianceMonitorModal: React.FC<StockVarianceMonitorModalProps> = ({
  isOpen,
  onClose,
  products,
  onOpenBatchAdjusterForIds
}) => {
  const { batchAdjustStock, addAlert } = useStore();
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'variance-exceeded' | 'reconciled'>('variance-exceeded');

  // Simulate physical audit counts vs system reported stock
  // In real warehouse operations, physical counts are scanned via barcode audit guns.
  // We generate realistic deterministic physical count variances based on product id hash.
  const varianceRecords: PhysicalAuditRecord[] = useMemo(() => {
    return products.map((prod, index) => {
      // Deterministic variance simulation: e.g. -15% to +10% deviation for some SKUs, exact for others
      const hash = (prod.sku.charCodeAt(0) + index * 13) % 100;
      let physicalCount = prod.stock;

      if (hash < 25) {
        // Introduce variance (-3 to +4 units)
        const deviation = (index % 3 === 0 ? -4 : index % 2 === 0 ? 3 : -2);
        physicalCount = Math.max(0, prod.stock + deviation);
      } else if (hash === 7) {
        // Major variance (> 5% discrepancy)
        physicalCount = Math.max(0, prod.stock + (index % 2 === 0 ? 8 : -7));
      }

      const varianceDelta = physicalCount - prod.stock;
      const variancePercent = prod.stock > 0 ? Math.round((Math.abs(varianceDelta) / prod.stock) * 1000) / 10 : (physicalCount > 0 ? 100 : 0);
      
      let status: 'matched' | 'minor-variance' | 'major-variance' = 'matched';
      if (variancePercent > 5.0) {
        status = 'major-variance';
      } else if (variancePercent > 0) {
        status = 'minor-variance';
      }

      return {
        productId: prod.id,
        sku: prod.sku,
        name: prod.name,
        warehouse: prod.warehouse,
        systemStock: prod.stock,
        physicalCount,
        varianceDelta,
        variancePercent,
        status,
        reconciled: false
      };
    });
  }, [products]);

  // Local state for tracking reconciliation status
  const [recordsState, setRecordsState] = useState<PhysicalAuditRecord[]>(varianceRecords);

  const filteredRecords = useMemo(() => {
    if (filterMode === 'variance-exceeded') {
      return recordsState.filter(r => r.variancePercent > 5.0 && !r.reconciled);
    }
    if (filterMode === 'reconciled') {
      return recordsState.filter(r => r.reconciled);
    }
    return recordsState;
  }, [recordsState, filterMode]);

  const majorVarianceCount = recordsState.filter(r => r.variancePercent > 5.0 && !r.reconciled).length;

  const handleReconcileItem = async (record: PhysicalAuditRecord) => {
    setReconcilingId(record.productId);
    try {
      const adjustmentType = record.varianceDelta > 0 ? 'add' : 'remove';
      const absDelta = Math.abs(record.varianceDelta);

      if (absDelta > 0) {
        await batchAdjustStock({
          productIds: [record.productId],
          adjustmentType,
          quantity: absDelta,
          reason: `Automated Reconciliation: Physical Audit Count Sync (Delta: ${record.varianceDelta > 0 ? `+${absDelta}` : -absDelta})`
        });
      }

      setRecordsState(prev => prev.map(r => r.productId === record.productId ? { ...r, reconciled: true } : r));
      setSuccessMsg(`Successfully reconciled SKU ${record.sku}: synchronized system stock (${record.systemStock}) with physical count (${record.physicalCount}).`);
      addAlert('success', 'Stock Variance Reconciled', `SKU ${record.sku} adjusted by ${record.varianceDelta}. Audit log updated.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setReconcilingId(null);
    } catch (err) {
      console.error('Failed to reconcile variance:', err);
      setReconcilingId(null);
    }
  };

  const handleFlagForSecondaryAudit = (record: PhysicalAuditRecord) => {
    addAlert(
      'warning',
      `Flagged for Secondary Audit: ${record.sku}`,
      `SKU ${record.sku} (${record.name}) placed in quarantine recount queue. Variance: ${record.variancePercent}% (${record.varianceDelta}).`
    );
    setSuccessMsg(`Successfully flagged SKU ${record.sku} for secondary physical audit recount.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleBatchReconcileExceeded = async () => {
    const exceeded = recordsState.filter(r => r.variancePercent > 5.0 && !r.reconciled);
    if (exceeded.length === 0) return;

    setReconcilingId('batch');
    try {
      for (const rec of exceeded) {
        if (rec.varianceDelta !== 0) {
          const adjustmentType = rec.varianceDelta > 0 ? 'add' : 'remove';
          await batchAdjustStock({
            productIds: [rec.productId],
            adjustmentType,
            quantity: Math.abs(rec.varianceDelta),
            reason: `Automated Batch Reconciliation (>5% Delta)`
          });
        }
      }

      setRecordsState(prev => prev.map(r => r.variancePercent > 5.0 ? { ...r, reconciled: true } : r));
      setSuccessMsg(`Successfully executed automated batch reconciliation for ${exceeded.length} SKUs exceeding 5% variance.`);
      addAlert('success', 'Batch Reconciliation Complete', `Synchronized ${exceeded.length} physical audit discrepancies.`);
      setTimeout(() => setSuccessMsg(null), 3500);
      setReconcilingId(null);
    } catch (err) {
      console.error('Batch reconcile failed:', err);
      setReconcilingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-amber-500/30 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950/80 via-neutral-900 to-neutral-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Stock Variance Monitor & Audit Reconciliation</h2>
                {majorVarianceCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                    {majorVarianceCount} Variance Exceeded (&gt; 5%)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    All Counts Aligned
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">
                Highlights discrepancies between system-reported inventory and physical audit counts, triggering automated reconciliation tasks if delta &gt; 5%.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {successMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 px-6 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Top Controls & Threshold Banner */}
        <div className="p-4 bg-neutral-950/60 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 font-mono">Filter View:</span>
            <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setFilterMode('variance-exceeded')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterMode === 'variance-exceeded'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Exceeding 5% Delta ({majorVarianceCount})
              </button>
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                All SKUs ({recordsState.length})
              </button>
              <button
                onClick={() => setFilterMode('reconciled')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterMode === 'reconciled'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Reconciled
              </button>
            </div>
          </div>

          {majorVarianceCount > 0 && (
            <button
              id="batch-reconcile-exceeded-btn"
              onClick={handleBatchReconcileExceeded}
              disabled={reconcilingId !== null}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {reconcilingId === 'batch' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reconciling All Exceeded...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Trigger Automated Reconciliation ({majorVarianceCount} SKUs)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Variance Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-[10px] font-mono uppercase text-neutral-400">
                  <th className="p-3">SKU & Product</th>
                  <th className="p-3">Warehouse Hub</th>
                  <th className="p-3 text-center">System Stock</th>
                  <th className="p-3 text-center">Physical Audit</th>
                  <th className="p-3 text-center">Variance Delta</th>
                  <th className="p-3 text-center">Variance %</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-neutral-500">
                      No stock variance records found matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const isExceeded = record.variancePercent > 5.0;
                    return (
                      <tr
                        key={record.productId}
                        className={`hover:bg-neutral-900/50 transition-colors ${
                          isExceeded && !record.reconciled ? 'bg-rose-950/15' : ''
                        }`}
                      >
                        <td className="p-3">
                          <div className="font-mono font-bold text-sky-400">{record.sku}</div>
                          <div className="text-white truncate max-w-[200px]">{record.name}</div>
                        </td>
                        <td className="p-3 text-neutral-400 text-[11px] truncate max-w-[140px]">
                          {record.warehouse}
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-neutral-300">
                          {record.systemStock} u
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-white">
                          {record.physicalCount} u
                        </td>
                        <td className={`p-3 text-center font-mono font-bold ${
                          record.varianceDelta > 0 ? 'text-emerald-400' : record.varianceDelta < 0 ? 'text-rose-400' : 'text-neutral-400'
                        }`}>
                          {record.varianceDelta > 0 ? `+${record.varianceDelta}` : record.varianceDelta}
                        </td>
                        <td className="p-3 text-center font-mono">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isExceeded
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : record.variancePercent > 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {record.variancePercent}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {record.reconciled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-400" />
                              RECONCILED
                            </span>
                          ) : isExceeded ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              &gt; 5% THRESHOLD
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-900 text-neutral-400">
                              Minor Delta
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {record.reconciled ? (
                            <span className="text-neutral-500 font-mono text-[11px]">Synced</span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Automated Reconciliation Task Button */}
                              <button
                                id={`reconcile-sku-btn-${record.productId}`}
                                onClick={() => handleReconcileItem(record)}
                                disabled={reconcilingId === record.productId}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer active:scale-95"
                                title="Instantly trigger automated reconciliation task to synchronize stock"
                              >
                                {reconcilingId === record.productId ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Syncing...</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Automated Reconcile</span>
                                  </>
                                )}
                              </button>

                              {/* Flag for Secondary Audit Button */}
                              <button
                                id={`flag-secondary-audit-btn-${record.productId}`}
                                onClick={() => handleFlagForSecondaryAudit(record)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                                title="Flag SKU for physical secondary audit recount"
                              >
                                <Flag className="w-3 h-3 text-amber-400" />
                                <span>Flag Audit</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono">
            Threshold Rule: Discrepancy &gt; 5.0% automatically flags automated reconciliation task.
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-semibold transition-colors cursor-pointer"
          >
            Close Monitor
          </button>
        </div>
      </div>
    </div>
  );
};
