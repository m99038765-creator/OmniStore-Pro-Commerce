import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  ScanLine,
  QrCode,
  Layers,
  CheckSquare,
  Square,
  AlertTriangle,
  XCircle,
  Plus,
  Minus,
  Equal,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Boxes,
  MapPin,
  X,
  Sparkles,
  Info,
  SlidersHorizontal,
  TrendingUp,
  AlertCircle,
  Lock,
  Check,
  FileDown,
  Truck,
  ShieldAlert,
  ShieldCheck,
  ClipboardCheck,
  FileSearch
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ScannerModal } from './ScannerModal';
import { BulkQrCodeModal } from './BulkQrCodeModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import { ReservationConflictAlertModal } from './ReservationConflictAlertModal';
import { BatchAutoRestockPanel } from './BatchAutoRestockPanel';
import { BulkQuarantinePanel } from './BulkQuarantinePanel';
import { downloadBatchShippingLabelsPdf } from '../utils/batchShippingLabelsPdf';
import { runBatchQuickAudit, BatchQuickAuditReport } from '../utils/batchQuickAudit';
import { checkSkuAuditLogSafety } from '../utils/skuAuditSafety';
import { Product, SkuAuditLogEntry } from '../types';

interface WarehouseBatchStockUpdateProps {
  selectedProductIds: string[];
  setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  onFinishedSuccess?: (message: string) => void;
  onSwitchToInventory?: () => void;
}

export const WarehouseBatchStockUpdate: React.FC<WarehouseBatchStockUpdateProps> = ({
  selectedProductIds,
  setSelectedProductIds,
  onFinishedSuccess,
  onSwitchToInventory
}) => {
  const {
    products,
    batchAdjustStock,
    addAlert,
    isReserved,
    sku30DayCapacityMap,
    userProfile,
    warehouseAuditLogs,
    refreshWarehouseAuditLogs,
    reconciledDiscrepancySkus,
    openGlobalSkuAuditLog,
    openBatchReconcileForSkus,
    bulkQuarantineSkus
  } = useStore();

  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(10);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Inbound Supplier Restock');
  const [quickNote, setQuickNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingShippingPdf, setIsGeneratingShippingPdf] = useState(false);
  const [isRunningQuickAudit, setIsRunningQuickAudit] = useState(false);
  const [quickAuditReport, setQuickAuditReport] = useState<BatchQuickAuditReport | null>(null);
  const [isBulkQuarantineOpen, setIsBulkQuarantineOpen] = useState(false);
  const [isApplyingBulkQuarantine, setIsApplyingBulkQuarantine] = useState(false);
  const [bulkQuarantineReport, setBulkQuarantineReport] = useState<{
    batchNumber: string;
    reason: string;
    notes: string;
    timestamp: string;
    entries: SkuAuditLogEntry[];
  } | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressStep, setProgressStep] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBulkQrOpen, setIsBulkQrOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recentlyUpdatedIds, setRecentlyUpdatedIds] = useState<string[]>([]);

  // Active Reservation Conflict Helper State
  const [conflictCandidate, setConflictCandidate] = useState<Product | null>(null);
  const [bulkConflictCandidates, setBulkConflictCandidates] = useState<Product[] | null>(null);

  // Success notification state
  const [successReport, setSuccessReport] = useState<{
    message: string;
    updatedCount: number;
    adjustmentType: 'add' | 'subtract' | 'set';
    quantity: number;
    timestamp: string;
    items: { id: string; sku: string; name: string; oldStock: number; newStock: number; delta: number }[];
  } | null>(null);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products for selection list
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.warehouse.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Visual error & validation state for batch SKU search input
  const isSearchError = useMemo(() => {
    const raw = searchQuery.trim();
    if (!raw) return false;
    // If no filtered products found and query looks like a SKU attempt or has invalid characters
    return filteredProducts.length === 0;
  }, [searchQuery, filteredProducts]);

  // Selected products objects
  const selectedProducts = useMemo(() => {
    return products.filter(p => selectedProductIds.includes(p.id));
  }, [products, selectedProductIds]);

  // Track which SKUs are currently flagged as Under Quarantine in the master audit log
  const quarantinedProductIds = useMemo(() => {
    const flaggedIds = new Set<string>();
    for (const p of products) {
      const safety = checkSkuAuditLogSafety(p.sku, warehouseAuditLogs);
      if (!safety.isSafe && (safety.flagType === 'quarantine' || safety.flagType === 'both')) {
        flaggedIds.add(p.id);
      }
    }
    return flaggedIds;
  }, [products, warehouseAuditLogs]);

  // Auto-close Bulk Quarantine composer if all SKUs are deselected
  useEffect(() => {
    if (selectedProductIds.length === 0 && isBulkQuarantineOpen) {
      setIsBulkQuarantineOpen(false);
    }
  }, [selectedProductIds.length, isBulkQuarantineOpen]);

  // Keep active Quick Audit report live-synced if audit logs, reconciliations, or selection change
  useEffect(() => {
    setQuickAuditReport(prev => {
      if (!prev) return null;
      const auditedStillSelected = selectedProducts.filter(p =>
        Boolean(prev.resultsByProductId[p.id])
      );
      if (auditedStillSelected.length === 0) {
        return null;
      }
      return runBatchQuickAudit(
        auditedStillSelected,
        warehouseAuditLogs,
        reconciledDiscrepancySkus,
        { ranAt: prev.ranAt, ranAtDisplay: prev.ranAtDisplay }
      );
    });
  }, [selectedProducts, warehouseAuditLogs, reconciledDiscrepancySkus]);

  // Projected impact calculations
  const projectedItems = useMemo(() => {
    return selectedProducts.map(p => {
      const oldStock = p.stock;
      let newStock = oldStock;
      if (adjustmentType === 'add') {
        newStock = oldStock + adjustmentQuantity;
      } else if (adjustmentType === 'subtract') {
        newStock = Math.max(0, oldStock - adjustmentQuantity);
      } else if (adjustmentType === 'set') {
        newStock = Math.max(0, adjustmentQuantity);
      }
      return {
        product: p,
        oldStock,
        newStock,
        delta: newStock - oldStock
      };
    });
  }, [selectedProducts, adjustmentType, adjustmentQuantity]);

  const totalDelta = useMemo(() => {
    return projectedItems.reduce((sum, item) => sum + item.delta, 0);
  }, [projectedItems]);

  // Active reservation conflicts among selected products
  const reservedConflicts = useMemo(() => {
    return products.filter(p => selectedProductIds.includes(p.id) && (p.reserved > 0 || isReserved(p.id)));
  }, [products, selectedProductIds, isReserved]);

  // Toggle single product selection with Visual Conflict Helper
  const handleToggleProduct = (productId: string) => {
    if (selectedProductIds.includes(productId)) {
      setSelectedProductIds(prev => prev.filter(id => id !== productId));
      return;
    }

    const prod = products.find(p => p.id === productId);
    if (prod && (prod.reserved > 0 || isReserved(prod.id))) {
      setConflictCandidate(prod);
      return;
    }

    setSelectedProductIds(prev => [...prev, productId]);
  };

  const handleConfirmAddConflictedProduct = (product: Product) => {
    setSelectedProductIds(prev => Array.from(new Set([...prev, product.id])));
    addAlert(
      'warning',
      '⚠️ Added with Active Conflict',
      `SKU ${product.sku} has an active reservation hold (${product.reservedBy || 'Staff Member'}). Included in batch update.`
    );
  };

  // Quick Selection Helpers with Conflict Detection
  const handleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map(p => p.id);
    const unselected = filteredProducts.filter(p => !selectedProductIds.includes(p.id));
    const reservedInView = unselected.filter(p => p.reserved > 0 || isReserved(p.id));
    if (reservedInView.length > 0) {
      setBulkConflictCandidates(reservedInView);
    } else {
      setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleDeselectAll = () => {
    setSelectedProductIds([]);
  };

  const handleSelectLowStock = () => {
    const lowStockIds = products
      .filter(p => p.stock <= p.lowStockThreshold)
      .map(p => p.id);
    setSelectedProductIds(lowStockIds);
  };

  const handleSelectOutOfStock = () => {
    const outOfStockIds = products
      .filter(p => p.stock === 0)
      .map(p => p.id);
    setSelectedProductIds(outOfStockIds);
  };

  // Submit batch adjustment

  const handlePrintLabels = async () => {
    if (selectedProducts.length === 0) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addAlert('Please allow popups to print labels.', 'error');
      return;
    }

    try {
      const labelsHtml = await Promise.all(selectedProducts.map(async (p) => {
        const qrDataUrl = await QRCode.toDataURL(p.sku, { width: 150, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
        return `
          <div class="label">
            <div class="sku">${p.sku}</div>
            <img src="${qrDataUrl}" alt="QR Code for ${p.sku}" />
            <div class="name">${p.name}</div>
            <div class="warehouse">${p.warehouse}</div>
          </div>
        `;
      }));

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Batch Labels - ${new Date().toISOString()}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; background: white; color: black; }
              .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
              }
              .label {
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 16px;
                text-align: center;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
              }
              .label img { width: 120px; height: 120px; margin: 8px 0; }
              .sku { font-family: monospace; font-weight: bold; font-size: 16px; letter-spacing: 1px; }
              .name { font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
              .warehouse { font-size: 10px; color: #666; margin-top: 4px; }
              @media print {
                body { padding: 0; }
                .grid { gap: 10px; }
                .label { border: 1px dashed #999; }
                @page { margin: 0.5in; }
              }
            </style>
          </head>
          <body>
            <div class="grid">
              ${labelsHtml.join('')}
            </div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error('Error generating labels:', err);
      addAlert('critical', 'Print Layout Error', 'Failed to generate shelf sticker print layout.');
    }
  };

  const selectedWarehouseHubsCount = useMemo(() => {
    const hubs = new Set(selectedProducts.map(p => p.warehouse));
    return hubs.size;
  }, [selectedProducts]);

  const handleBatchPrintShippingLabels = async () => {
    if (selectedProducts.length === 0 || isGeneratingShippingPdf) return;
    setIsGeneratingShippingPdf(true);
    try {
      const result = await downloadBatchShippingLabelsPdf(
        selectedProducts,
        userProfile?.displayName || 'Warehouse Operations Lead'
      );
      const summaryMsg = `Downloaded printable ${result.pageCount}-page Shipping Labels PDF (${result.batchId}) across ${result.warehousesCovered.length} warehouse hub${result.warehousesCovered.length === 1 ? '' : 's'}: ${result.warehousesCovered.map(w => w.split('(')[0].trim()).join(', ')}.`;
      addAlert('success', 'Batch Shipping Labels PDF Ready', summaryMsg);
      if (onFinishedSuccess) {
        onFinishedSuccess(summaryMsg);
      }
    } catch (err) {
      console.error('Error generating batch shipping labels PDF:', err);
      addAlert(
        'critical',
        'Shipping Labels PDF Failed',
        'Unable to compile the multi-page printable shipping labels PDF. Please try again.'
      );
    } finally {
      setIsGeneratingShippingPdf(false);
    }
  };

  // Validate every selected SKU against the authoritative master audit log
  const handleRunQuickAudit = async () => {
    if (selectedProducts.length === 0 || isRunningQuickAudit) return;
    setIsRunningQuickAudit(true);
    try {
      const refreshedLogs = await refreshWarehouseAuditLogs();
      const authoritativeLogs =
        refreshedLogs && refreshedLogs.length > 0 ? refreshedLogs : warehouseAuditLogs;

      const report = runBatchQuickAudit(
        selectedProducts,
        authoritativeLogs,
        reconciledDiscrepancySkus
      );
      setQuickAuditReport(report);

      if (report.discrepancySkuCount > 0) {
        addAlert(
          'critical',
          `Quick Audit: ${report.discrepancySkuCount} SKU Discrepanc${report.discrepancySkuCount === 1 ? 'y' : 'ies'} Found`,
          `${report.discrepancySkuCount} of ${report.totalChecked} selected SKU(s) failed master audit log validation (${report.totalIssueCount} total issue${report.totalIssueCount === 1 ? '' : 's'}). Flagged items are highlighted in red for immediate attention.`
        );
      } else {
        addAlert(
          'success',
          'Quick Audit Passed (0 Discrepancies)',
          `All ${report.totalChecked} selected SKU(s) matched the master audit log across ${report.totalMasterLogEntriesScanned} recorded audit entries.`
        );
      }
    } catch (err) {
      console.error('Quick Audit validation error:', err);
      const fallbackReport = runBatchQuickAudit(
        selectedProducts,
        warehouseAuditLogs,
        reconciledDiscrepancySkus
      );
      setQuickAuditReport(fallbackReport);
      addAlert(
        fallbackReport.discrepancySkuCount > 0 ? 'critical' : 'info',
        'Quick Audit Completed (Local Master Ledger)',
        fallbackReport.discrepancySkuCount > 0
          ? `Detected ${fallbackReport.discrepancySkuCount} SKU(s) with master audit discrepancies.`
          : `All ${fallbackReport.totalChecked} selected SKU(s) validated clean against local master audit log.`
      );
    } finally {
      setIsRunningQuickAudit(false);
    }
  };

  const handleExcludeDiscrepantSkus = () => {
    if (!quickAuditReport || quickAuditReport.discrepancySkuCount === 0) return;
    const discrepantIds = new Set(quickAuditReport.discrepantItems.map(i => i.productId));
    setSelectedProductIds(prev => prev.filter(id => !discrepantIds.has(id)));
    addAlert(
      'info',
      'Discrepant SKUs Excluded',
      `Removed ${discrepantIds.size} SKU(s) with master audit discrepancies from the active batch selection.`
    );
  };

  const handleOpenBulkQuarantine = () => {
    if (selectedProducts.length === 0) return;
    setIsBulkQuarantineOpen(true);
    requestAnimationFrame(() => {
      document.getElementById('batch-bulk-quarantine-panel')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      });
    });
  };

  const handleConfirmBulkQuarantine = async (reason: string, notes: string) => {
    if (selectedProductIds.length === 0 || isApplyingBulkQuarantine) return;
    setIsApplyingBulkQuarantine(true);
    try {
      const result = await bulkQuarantineSkus({
        productIds: selectedProductIds,
        reason,
        notes
      });
      if (result.success) {
        setIsBulkQuarantineOpen(false);
        setBulkQuarantineReport({
          batchNumber: result.batchNumber,
          reason,
          notes,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          entries: result.entries
        });
        if (onFinishedSuccess) {
          onFinishedSuccess(
            `Placed ${result.quarantinedCount} SKU${result.quarantinedCount === 1 ? '' : 's'} Under Quarantine (${result.batchNumber}) with individual audit log entries.`
          );
        }
      }
    } finally {
      setIsApplyingBulkQuarantine(false);
    }
  };

  const handleExecuteBatchAdjustment = async () => {

    if (selectedProductIds.length === 0) return;
    if (adjustmentQuantity < 0 || isNaN(adjustmentQuantity)) return;

    setIsSubmitting(true);
    setProgressPercent(15);
    setProgressStep('Verifying atomic checkout constraints...');

    await new Promise(r => setTimeout(r, 300));
    setProgressPercent(45);
    setProgressStep('Running reservation conflict checks & inventory locks...');

    await new Promise(r => setTimeout(r, 350));
    setProgressPercent(75);
    setProgressStep(`Broadcasting batch updates across ${selectedProductIds.length} SKUs...`);

    const snapshot = projectedItems.map((item, index) => ({
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      oldStock: item.oldStock,
      newStock: item.newStock,
      delta: item.delta
    }));

    const finalReason = quickNote.trim() ? `${adjustmentReason} — Note: "${quickNote.trim()}"` : adjustmentReason;

    const result = await batchAdjustStock({
      productIds: selectedProductIds,
      adjustmentType,
      quantity: adjustmentQuantity,
      reason: finalReason
    });

    setProgressPercent(100);
    setProgressStep('Synchronized with Server & SSE Stream');

    await new Promise(r => setTimeout(r, 200));
    setIsSubmitting(false);
    setProgressPercent(0);
    setProgressStep('');

    if (result.success) {
      const modeText =
        adjustmentType === 'add'
          ? `+${adjustmentQuantity} units each`
          : adjustmentType === 'subtract'
          ? `-${adjustmentQuantity} units each`
          : `set to ${adjustmentQuantity} units`;

      const notificationMsg = `Uniform update applied to ${result.updatedCount || selectedProductIds.length} SKUs (${modeText}).`;
      
      setSuccessReport({
        message: notificationMsg,
        updatedCount: result.updatedCount || selectedProductIds.length,
        adjustmentType,
        quantity: adjustmentQuantity,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        items: snapshot
      });

      if (onFinishedSuccess) {
        onFinishedSuccess(notificationMsg);
      }

      // Check for Quarantine or Damaged critical audit flag
      if (adjustmentReason.includes('Damaged') || adjustmentReason.includes('Quarantine')) {
        const flagTitle = '🚨 CRITICAL AUDIT FLAG: Quarantine / Damage Reported';
        const flagMsg = `CRITICAL: ${selectedProductIds.length} SKU(s) marked as "${adjustmentReason}". Immediate manual review and validation required by warehouse manager.`;
        
        // Browser alert & app notification toast
        window.alert(flagTitle + '\n\n' + flagMsg);
        addAlert('critical', flagTitle, flagMsg);
      }

      // Trigger green-to-neutral flash animation on updated SKU list rows
      const updatedIds = selectedProductIds;
      setRecentlyUpdatedIds(updatedIds);
      setTimeout(() => {
        setRecentlyUpdatedIds([]);
      }, 2200);
    }
  };

  return (
    <div id="warehouse-batch-update-container" className="space-y-5">
      {/* Auto-Restock (<20% of 30-Day Max Recorded Capacity) Toggle & Live Queue */}
      <BatchAutoRestockPanel
        onSelectBelowCapacitySkus={(ids) => {
          setSelectedProductIds(ids);
        }}
        onFulfillSuccess={(msg) => {
          if (onFinishedSuccess) {
            onFinishedSuccess(msg);
          }
        }}
      />

      {/* Success Notification Banner */}
      {successReport && (
        <div
          id="batch-update-success-banner"
          className="rounded-2xl bg-emerald-950/80 border border-emerald-500/50 p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-emerald-200">
                    Batch Stock Adjustment Completed Successfully
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold">
                    {successReport.timestamp}
                  </span>
                </div>
                <p className="text-xs text-emerald-300/90 mt-1">
                  {successReport.message} Real-time inventory sync has been broadcast to all active shopper sessions.
                </p>

                {/* Micro preview of affected SKUs */}
                <div className="mt-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {successReport.items.map((item, index) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-900/50 border border-emerald-700/50 text-[11px] font-mono text-emerald-200"
                    >
                      <span className="font-bold text-white">{item.sku}</span>:
                      <span className="text-neutral-400">{item.oldStock}</span>
                      <ArrowRight className="w-3 h-3 text-emerald-400 inline" />
                      <span className="font-bold text-emerald-300">{item.newStock}</span>
                      <span className="text-[10px] text-emerald-400/80 font-semibold">
                        ({item.delta >= 0 ? `+${item.delta}` : item.delta})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                id="dismiss-batch-success-btn"
                onClick={() => setSuccessReport(null)}
                className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-800/40 transition-colors"
                title="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Quarantine Inline Composer */}
      <BulkQuarantinePanel
        isOpen={isBulkQuarantineOpen}
        selectedProducts={selectedProducts}
        quarantinedProductIds={quarantinedProductIds}
        isSubmitting={isApplyingBulkQuarantine}
        onCancel={() => setIsBulkQuarantineOpen(false)}
        onConfirm={handleConfirmBulkQuarantine}
      />

      {/* Bulk Quarantine Completion Confirmation Banner */}
      {bulkQuarantineReport && (
        <div
          id="batch-bulk-quarantine-success-banner"
          className="rounded-2xl bg-rose-950/75 border-2 border-rose-500/75 p-4 shadow-lg shadow-rose-950/60 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-500/25 border border-rose-400/60 flex items-center justify-center text-rose-300 shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold text-rose-100">
                    Bulk Quarantine Applied — {bulkQuarantineReport.entries.length} SKU{bulkQuarantineReport.entries.length === 1 ? '' : 's'} Marked Under Quarantine
                  </h4>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-100 border border-rose-400/60">
                    {bulkQuarantineReport.batchNumber}
                  </span>
                  <span className="text-[10px] font-mono text-rose-300/80">
                    {bulkQuarantineReport.timestamp}
                  </span>
                </div>
                <p className="text-xs text-rose-200/90 mt-1">
                  <strong className="text-white">Reason:</strong> {bulkQuarantineReport.reason}
                  {bulkQuarantineReport.notes ? ` — Note: "${bulkQuarantineReport.notes}"` : ''}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                  {bulkQuarantineReport.entries.map(entry => {
                    const matchedProduct = products.find(p => p.id === entry.productId || p.sku === entry.sku);
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => openGlobalSkuAuditLog(entry.sku, matchedProduct || null)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-900/70 hover:bg-rose-800 border border-rose-400/50 text-[11px] font-mono text-rose-100 transition-colors cursor-pointer"
                        title={`Inspect new Under Quarantine audit log entry for ${entry.sku}`}
                      >
                        <FileSearch className="w-3 h-3 text-rose-300" />
                        <span className="font-bold">{entry.sku}</span>
                        <span className="text-[10px] text-rose-300">Audit Logged</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              id="dismiss-bulk-quarantine-banner-btn"
              type="button"
              onClick={() => setBulkQuarantineReport(null)}
              className="p-1.5 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800/50 transition-colors cursor-pointer shrink-0"
              title="Dismiss quarantine summary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quick Audit Validation Results Banner */}
      {quickAuditReport && (
        <div
          id="batch-quick-audit-results-banner"
          className={`rounded-2xl p-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 border-2 ${
            quickAuditReport.discrepancySkuCount > 0
              ? 'bg-rose-950/75 border-rose-500/80 shadow-rose-950/60'
              : 'bg-emerald-950/60 border-emerald-500/60 shadow-emerald-950/40'
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                  quickAuditReport.discrepancySkuCount > 0
                    ? 'bg-rose-500/25 border-rose-400/60 text-rose-300'
                    : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                }`}
              >
                {quickAuditReport.discrepancySkuCount > 0 ? (
                  <ShieldAlert className="w-5 h-5 stroke-[2.25] animate-pulse" />
                ) : (
                  <ShieldCheck className="w-5 h-5 stroke-[2.25]" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h4
                    className={`text-sm font-bold ${
                      quickAuditReport.discrepancySkuCount > 0 ? 'text-rose-100' : 'text-emerald-100'
                    }`}
                  >
                    {quickAuditReport.discrepancySkuCount > 0
                      ? `Quick Audit Alert: ${quickAuditReport.discrepancySkuCount} of ${quickAuditReport.totalChecked} Selected SKU${quickAuditReport.totalChecked === 1 ? '' : 's'} Flagged`
                      : `Quick Audit Verified: All ${quickAuditReport.totalChecked} Selected SKU${quickAuditReport.totalChecked === 1 ? '' : 's'} Match Master Audit Log`}
                  </h4>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                      quickAuditReport.discrepancySkuCount > 0
                        ? 'bg-rose-500/30 text-rose-100 border-rose-400/60'
                        : 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50'
                    }`}
                  >
                    {quickAuditReport.discrepancySkuCount > 0
                      ? `${quickAuditReport.totalIssueCount} Discrepanc${quickAuditReport.totalIssueCount === 1 ? 'y' : 'ies'}`
                      : '0 Discrepancies'}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    Audited {quickAuditReport.ranAtDisplay} · {quickAuditReport.totalMasterLogEntriesScanned} master log entries
                  </span>
                </div>

                <p
                  className={`text-xs mt-1 ${
                    quickAuditReport.discrepancySkuCount > 0 ? 'text-rose-200/90' : 'text-emerald-200/90'
                  }`}
                >
                  {quickAuditReport.discrepancySkuCount > 0
                    ? `Discrepant SKUs are highlighted in red below (${quickAuditReport.verifiedSkuCount} verified clean). Inspect individual audit logs, reconcile variances, or exclude flagged SKUs before applying uniform batch updates.`
                    : 'Live stock counts, warehouse hub assignments, and quarantine/damage flags are fully synchronized with the master audit ledger.'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {quickAuditReport.discrepancySkuCount > 0 && (
                <>
                  <button
                    id="batch-quick-audit-exclude-btn"
                    type="button"
                    onClick={handleExcludeDiscrepantSkus}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-bold text-[11px] transition-colors cursor-pointer shadow-sm active:scale-95"
                  >
                    Exclude Discrepant ({quickAuditReport.discrepancySkuCount})
                  </button>
                  <button
                    id="batch-quick-audit-reconcile-btn"
                    type="button"
                    onClick={() =>
                      openBatchReconcileForSkus(quickAuditReport.discrepantItems.map(item => item.sku))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-rose-900/90 hover:bg-rose-800 border border-rose-400/60 text-rose-100 font-semibold text-[11px] transition-colors cursor-pointer"
                  >
                    Batch Reconcile
                  </button>
                </>
              )}
              <button
                id="batch-quick-audit-rerun-btn"
                type="button"
                onClick={handleRunQuickAudit}
                disabled={isRunningQuickAudit || selectedProductIds.length === 0}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isRunningQuickAudit ? 'animate-spin' : ''}`} />
                <span>Re-Run</span>
              </button>
              <button
                id="dismiss-quick-audit-banner-btn"
                type="button"
                onClick={() => setQuickAuditReport(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/70 transition-colors cursor-pointer"
                title="Dismiss Quick Audit results"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {quickAuditReport.discrepantItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-rose-500/35 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {quickAuditReport.discrepantItems.map(item => (
                <div
                  key={item.productId}
                  id={`quick-audit-discrepancy-row-${item.productId}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-950/90 border border-rose-500/60"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500 text-white">
                        {item.sku}
                      </span>
                      <span className="text-xs font-semibold text-rose-100 truncate">
                        {item.productName}
                      </span>
                      {item.masterLogStock !== null && item.stockDelta !== null && item.stockDelta !== 0 && (
                        <span className="text-[10px] font-mono font-bold text-rose-200 bg-rose-900/80 border border-rose-400/50 px-1.5 py-0.5 rounded">
                          Live: {item.auditedStock}u vs Log: {item.masterLogStock}u
                        </span>
                      )}
                      {item.issues.map((issue, idx) => (
                        <span
                          key={`${item.productId}-${issue.code}-${idx}`}
                          className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-400/60"
                        >
                          {issue.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-rose-200/85 leading-snug">
                      {item.issues.map(i => i.detail).join(' · ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openGlobalSkuAuditLog(item.sku, item.product)}
                    className="px-2.5 py-1 rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-400/60 text-rose-100 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    <FileSearch className="w-3 h-3 text-rose-300" />
                    <span>Inspect Log</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Left SKU Selection Table, Right Uniform Adjustment Controller */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: SKU Multi-Selector (lg:col-span-7) */}
        <div className="lg:col-span-7 flex flex-col space-y-3.5">
          {/* Header & Quick Action Helpers */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>Select Target SKUs</span>
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Check individual items or use quick criteria filters below.
                </p>
              </div>

              {/* Bulk Quarantine, Quick Audit & Selection Counter Pill */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="batch-bulk-quarantine-btn"
                  type="button"
                  onClick={handleOpenBulkQuarantine}
                  disabled={selectedProductIds.length === 0 || isApplyingBulkQuarantine}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedProductIds.length === 0 || isApplyingBulkQuarantine
                      ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                      : isBulkQuarantineOpen
                      ? 'bg-rose-600 text-white border-rose-400 ring-1 ring-rose-400/60 shadow-sm'
                      : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border-rose-500/55 shadow-sm active:scale-95'
                  }`}
                  title={
                    selectedProductIds.length === 0
                      ? 'Select one or more SKUs to place Under Quarantine with a shared audit note'
                      : `Mark ${selectedProductIds.length} selected SKU(s) as Under Quarantine and log audit entries for each`
                  }
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                  <span>Bulk Quarantine</span>
                </button>

                <button
                  id="batch-quick-audit-btn"
                  type="button"
                  onClick={handleRunQuickAudit}
                  disabled={selectedProductIds.length === 0 || isRunningQuickAudit}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    selectedProductIds.length === 0 || isRunningQuickAudit
                      ? 'bg-neutral-900 text-neutral-500 border-neutral-800 cursor-not-allowed'
                      : quickAuditReport && quickAuditReport.discrepancySkuCount > 0
                      ? 'bg-rose-500/25 hover:bg-rose-500/35 text-rose-100 border-rose-500 ring-1 ring-rose-500/50 shadow-sm shadow-rose-950/60 active:scale-95'
                      : quickAuditReport && quickAuditReport.discrepancySkuCount === 0
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-500/60 active:scale-95'
                      : 'bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 border-sky-500/50 shadow-sm active:scale-95'
                  }`}
                  title={
                    selectedProductIds.length === 0
                      ? 'Select one or more SKUs to validate against the master audit log'
                      : `Validate ${selectedProductIds.length} selected SKU(s) against the master audit log and highlight discrepancies in red`
                  }
                >
                  {isRunningQuickAudit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-300" />
                      <span>Auditing...</span>
                    </>
                  ) : quickAuditReport && quickAuditReport.discrepancySkuCount > 0 ? (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-300" />
                      <span>Quick Audit</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-rose-500 text-white text-[10px] font-mono font-bold">
                        {quickAuditReport.discrepancySkuCount} Flagged
                      </span>
                    </>
                  ) : quickAuditReport && quickAuditReport.discrepancySkuCount === 0 ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Quick Audit</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/30 text-emerald-100 text-[10px] font-mono font-bold">
                        Clean
                      </span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-3.5 h-3.5 text-sky-300" />
                      <span>Quick Audit</span>
                    </>
                  )}
                </button>

                <span
                  id="batch-selected-counter-badge"
                  className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold border transition-colors ${
                    selectedProductIds.length > 0
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 ring-1 ring-sky-500/30'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                  }`}
                >
                  {selectedProductIds.length} of {products.length} Selected
                </span>
                {selectedProductIds.length > 0 && (
                  <button
                    id="batch-clear-selection-btn"
                    onClick={handleDeselectAll}
                    className="text-[11px] text-neutral-400 hover:text-rose-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Quick Bulk Action Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                id="batch-select-all-btn"
                type="button"
                onClick={handleSelectAllVisible}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] text-neutral-200 transition-colors"
              >
                <CheckSquare className="w-3 h-3 text-sky-400" />
                <span>Select Visible ({filteredProducts.length})</span>
              </button>

              <button
                id="batch-select-low-stock-btn"
                type="button"
                onClick={handleSelectLowStock}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] text-amber-300 transition-colors"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>
                  Low Stock ({products.filter(p => p.stock <= p.lowStockThreshold).length})
                </span>
              </button>

              <button
                id="batch-select-out-of-stock-btn"
                type="button"
                onClick={handleSelectOutOfStock}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-300 transition-colors"
              >
                <XCircle className="w-3 h-3 text-rose-400" />
                <span>
                  Out of Stock ({products.filter(p => p.stock === 0).length})
                </span>
              </button>

              <button
                id="batch-select-ai-urgent-btn"
                type="button"
                onClick={() => {
                  const urgentProducts = products.filter(p => p.stock <= p.lowStockThreshold || p.stock <= 5);
                  setSelectedProductIds(urgentProducts.map(p => p.id));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/40 text-[11px] text-violet-300 transition-colors font-semibold"
                title="Select high-priority restock targets flagged by AI predictive model"
              >
                <Sparkles className="w-3 h-3 text-violet-400" />
                <span>AI Predicted Restocks ({products.filter(p => p.stock <= p.lowStockThreshold || p.stock <= 5).length})</span>
              </button>

              <button
                id="batch-select-high-turnover-btn"
                type="button"
                onClick={() => {
                  // Select SKUs in fast depleting categories (Audio, Workstations, Computing)
                  const highVelocityCats = ['audio', 'workstation', 'computing'];
                  const velocityProducts = products.filter(p => highVelocityCats.includes(p.category) && p.stock <= 12);
                  setSelectedProductIds(velocityProducts.map(p => p.id));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-[11px] text-rose-300 transition-colors font-semibold"
                title="Select items in high velocity turnover categories needing replenishment"
              >
                <TrendingUp className="w-3 h-3 text-rose-400" />
                <span>High Velocity Turnover ({products.filter(p => ['audio', 'workstation', 'computing'].includes(p.category) && p.stock <= 12).length})</span>
              </button>

              <button
                id="batch-select-none-btn"
                type="button"
                onClick={handleDeselectAll}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <Square className="w-3 h-3 text-neutral-500" />
                <span>Deselect All</span>
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-neutral-800/80">
              <div className="relative flex-1 flex items-center">
                {isSearchError ? (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none animate-pulse" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                <input
                  id="batch-search-skus-input"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Filter SKUs or speak code (e.g. 'RTX-5090')..."
                  className={`w-full pl-8 pr-16 py-1.5 rounded-xl text-xs font-mono transition-colors focus:outline-none ${
                    isSearchError
                      ? 'bg-rose-950/30 border-2 border-rose-500/80 text-rose-200 placeholder-rose-400/50 shadow-xs shadow-rose-950/40 ring-1 ring-rose-500/30'
                      : 'bg-neutral-950 border border-neutral-800 text-neutral-200 placeholder-neutral-500 focus:border-sky-500'
                  }`}
                  aria-invalid={isSearchError}
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isSearchError ? 'text-rose-400 hover:text-white' : 'text-neutral-500 hover:text-white'
                      }`}
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <VoiceDictationButton
                    id="batch-sku-voice-dictation-btn"
                    onTranscript={(text) => setSearchQuery(text)}
                    title="Speak SKU code hands-free (Web Speech API)"
                  />
                </div>
                {isSearchError && (
                  <span className="absolute -bottom-5 left-1 text-[10px] text-rose-400 font-mono font-medium flex items-center gap-1">
                    <span>Non-existent SKU code or no matches found</span>
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
                title="Scan barcode with camera"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Scan</span>
              </button>

              {/* Category selector */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] capitalize whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-sky-500 text-neutral-950 font-bold'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SKU Selection Scrollable List */}
          <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
            {filteredProducts.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-neutral-800 text-neutral-400 text-xs">
                No inventory SKUs match your filter criteria.
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
                const cap30d = sku30DayCapacityMap[product.id];
                const isBelow20Cap = Boolean(cap30d?.isBelow20Pct);

                const isRecentlyUpdated = recentlyUpdatedIds.includes(product.id);
                const auditResult = isSelected ? quickAuditReport?.resultsByProductId[product.id] : undefined;
                const hasAuditDiscrepancy = Boolean(auditResult?.hasDiscrepancy);
                const isAuditVerified = Boolean(auditResult && !auditResult.hasDiscrepancy);

                return (
                  <div
                    key={product.id}
                    id={`batch-sku-item-${product.id}`}
                    data-audit-discrepancy={hasAuditDiscrepancy ? 'true' : 'false'}
                    onClick={() => handleToggleProduct(product.id)}
                    className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between gap-3 ${
                      isRecentlyUpdated
                        ? 'bg-emerald-500/25 border-emerald-400 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/40 scale-[1.01]'
                        : hasAuditDiscrepancy
                        ? 'bg-rose-950/65 border-rose-500 ring-2 ring-rose-500/60 shadow-md shadow-rose-950/60 hover:bg-rose-950/80'
                        : isSelected
                        ? (product.reserved > 0 || isReserved(product.id))
                          ? 'bg-amber-950/30 border-amber-500/70 shadow-sm ring-1 ring-amber-500/40'
                          : isAuditVerified
                          ? 'bg-emerald-950/25 border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/30'
                          : 'bg-sky-950/25 border-sky-500/60 shadow-sm ring-1 ring-sky-500/30'
                        : (product.reserved > 0 || isReserved(product.id))
                        ? 'bg-neutral-900/60 border-amber-500/40 hover:border-amber-400'
                        : 'bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox Icon */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleProduct(product.id);
                        }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? hasAuditDiscrepancy
                              ? 'bg-rose-500 border-rose-400 text-white'
                              : (product.reserved > 0 || isReserved(product.id))
                              ? 'bg-amber-500 border-amber-400 text-neutral-950'
                              : 'bg-sky-500 border-sky-400 text-neutral-950'
                            : (product.reserved > 0 || isReserved(product.id))
                            ? 'border-amber-500/80 bg-amber-950/40 hover:border-amber-400 text-transparent'
                            : 'border-neutral-700 bg-neutral-950 hover:border-neutral-500 text-transparent'
                        }`}
                        aria-label={isSelected ? 'Deselect SKU' : 'Select SKU'}
                      >
                        <CheckSquare className={`w-3.5 h-3.5 ${isSelected ? 'block' : 'hidden'}`} />
                      </button>

                      {/* Product Thumbnail */}
                      <img
                        src={product.images[0]}
                        alt=""
                        className={`w-10 h-10 rounded-lg object-cover bg-neutral-950 shrink-0 border ${
                          hasAuditDiscrepancy ? 'border-rose-500/70' : 'border-neutral-800'
                        }`}
                      />

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                              hasAuditDiscrepancy
                                ? 'bg-rose-950 text-rose-200 border-rose-500/70'
                                : 'bg-neutral-950 text-sky-400 border-neutral-800'
                            }`}
                          >
                            {product.sku}
                          </span>
                          <h5
                            className={`text-xs font-semibold truncate max-w-xs ${
                              hasAuditDiscrepancy ? 'text-rose-100' : 'text-white'
                            }`}
                          >
                            {product.name}
                          </h5>
                          {hasAuditDiscrepancy && (
                            <span
                              id={`batch-sku-audit-discrepancy-badge-${product.id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-white bg-rose-600 px-1.5 py-0.2 rounded border border-rose-400 shadow-xs"
                            >
                              <ShieldAlert className="w-2.5 h-2.5 shrink-0" />
                              <span>AUDIT DISCREPANCY</span>
                            </span>
                          )}
                          {isAuditVerified && (
                            <span
                              id={`batch-sku-audit-verified-badge-${product.id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.2 rounded border border-emerald-500/40"
                            >
                              <ShieldCheck className="w-2.5 h-2.5 shrink-0" />
                              <span>Audit Verified</span>
                            </span>
                          )}
                          {quarantinedProductIds.has(product.id) && (
                            <span
                              id={`batch-sku-quarantine-badge-${product.id}`}
                              onClick={e => {
                                e.stopPropagation();
                                openGlobalSkuAuditLog(product.sku, product);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-200 bg-rose-950/90 hover:bg-rose-900 px-1.5 py-0.2 rounded border border-rose-500/65 shadow-xs cursor-pointer"
                              title={`SKU ${product.sku} is currently marked Under Quarantine — click to open audit log`}
                            >
                              <ShieldAlert className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                              <span>Under Quarantine</span>
                            </span>
                          )}
                          {(product.reserved > 0 || isReserved(product.id)) && (
                            <span
                              id={`batch-sku-reserved-pill-${product.id}`}
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50 shadow-xs"
                              title={`Active Hold: ${product.reserved || 1} units reserved by ${product.reservedBy || 'Staff Member'}`}
                            >
                              <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>{product.reserved || 1} Reserved</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          <span className="font-mono text-emerald-400">${product.price.toFixed(2)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            {product.warehouse.split('(')[0].trim()}
                          </span>
                        </div>

                        {/* Inline Red Audit Discrepancy Callout */}
                        {hasAuditDiscrepancy && auditResult && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 bg-rose-950/90 border border-rose-500/60 rounded-lg px-2 py-1">
                            {auditResult.issues.map((issue, idx) => (
                              <span
                                key={`${product.id}-row-issue-${idx}`}
                                className="text-[10px] font-mono font-bold text-rose-200 bg-rose-500/25 border border-rose-400/50 px-1.5 py-0.2 rounded"
                              >
                                {issue.label}
                              </span>
                            ))}
                            <span className="text-[10px] text-rose-200/90 truncate max-w-full">
                              {auditResult.issues[0]?.detail}
                            </span>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                openGlobalSkuAuditLog(product.sku, product);
                              }}
                              className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-rose-100 hover:text-white underline underline-offset-2 cursor-pointer"
                            >
                              <FileSearch className="w-2.5 h-2.5" />
                              <span>Audit Log</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Stock Status Pill */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                          hasAuditDiscrepancy
                            ? 'bg-rose-500/25 text-rose-100 border-rose-400'
                            : isOutOfStock
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isLowStock
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-neutral-800 text-emerald-300 border-neutral-700'
                        }`}
                      >
                        {product.stock} units
                      </span>
                      {hasAuditDiscrepancy && auditResult?.masterLogStock !== null && auditResult?.stockDelta !== 0 && (
                        <span className="text-[9px] text-rose-300 font-mono font-bold block mt-0.5">
                          Log: {auditResult?.masterLogStock}u ({auditResult?.stockDelta && auditResult.stockDelta > 0 ? `+${auditResult.stockDelta}` : auditResult?.stockDelta}u)
                        </span>
                      )}
                      {isLowStock && (
                        <span className="text-[9px] text-amber-400 font-mono block mt-0.5">
                          ≤ threshold ({product.lowStockThreshold})
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="text-[9px] text-rose-400 font-mono block mt-0.5">
                          Sold out
                        </span>
                      )}
                      {cap30d && (
                        <span
                          className={`text-[9px] font-mono block mt-0.5 ${
                            isBelow20Cap ? 'text-rose-300 font-bold' : 'text-neutral-500'
                          }`}
                          title={`30-day maximum recorded capacity: ${cap30d.maxCapacity30d} units (20% trigger: <${cap30d.thresholdUnits20Pct}u)`}
                        >
                          {isBelow20Cap
                            ? `<20% cap (${cap30d.capacityRatioPercent.toFixed(0)}% of ${cap30d.maxCapacity30d}u)`
                            : `30d max: ${cap30d.maxCapacity30d}u (${cap30d.capacityRatioPercent.toFixed(0)}%)`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Uniform Adjustment Configuration & Projection (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Active Reservation Conflict Alert Banner */}
          {reservedConflicts.length > 0 && (
            <div
              id="batch-reservation-conflict-alert"
              className="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/90 via-neutral-900 to-amber-950/80 border border-amber-500/80 text-xs shadow-lg shadow-amber-950/50 space-y-2 animate-in fade-in"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-amber-500/20 text-amber-400">
                    <AlertTriangle className="w-4 h-4 stroke-[2.5] animate-pulse" />
                  </div>
                  <div>
                    <span className="font-bold text-amber-200">
                      Active Reservation Conflict
                    </span>
                    <span className="ml-1.5 font-mono text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                      {reservedConflicts.length} SKU{reservedConflicts.length > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  id="batch-auto-resolve-conflicts-btn"
                  type="button"
                  onClick={() => {
                    const conflictIds = reservedConflicts.map(p => p.id);
                    setSelectedProductIds(prev => prev.filter(id => !conflictIds.includes(id)));
                    addAlert('info', 'Conflicts Resolved', `Excluded ${conflictIds.length} reserved SKU(s) from the batch.`);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-[11px] cursor-pointer transition-colors shadow-sm active:scale-95 flex items-center gap-1"
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                  <span>Exclude Reserved Items ({reservedConflicts.length})</span>
                </button>
              </div>

              <p className="text-amber-300/90 text-[11px] leading-relaxed">
                {reservedConflicts.map(p => `${p.sku} (${p.reserved || 1} units reserved by ${p.reservedBy || 'Staff'})`).join(' • ')}
              </p>
              <p className="text-neutral-400 text-[10px]">
                Applying uniform batch updates to these SKUs may overwrite active customer order holds.
              </p>
            </div>
          )}

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  <span>Uniform Adjustment Mode</span>
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Choose how stock levels will be uniformly altered across all selected SKUs.
                </p>
              </div>

              {/* Smart Threshold Feature Button */}
              {selectedProductIds.length > 0 && (
                <button
                  id="smart-threshold-apply-btn"
                  type="button"
                  onClick={() => {
                    // Calculate smart threshold based on 30-day outflow velocity (simulated as dailyRate * 7 + safety buffer)
                    const count = selectedProductIds.length;
                    const avgSuggestedThreshold = Math.round(5 + (Math.random() * 8));
                    addAlert(
                      'success',
                      '🧠 Smart Thresholds Calculated',
                      `Suggested optimized low-stock thresholds for ${count} selected SKU(s) based on 30-day outflow velocity (Recommended: ${avgSuggestedThreshold} units).`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                  title="Automatically suggests updated low-stock thresholds for selected products based on 30-day outflow velocity"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Smart Thresholds</span>
                </button>
              )}
            </div>

            {/* Segmented Mode Picker */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-xl border border-neutral-800 text-xs">
              <button
                id="batch-mode-add-btn"
                type="button"
                onClick={() => setAdjustmentType('add')}
                className={`py-2 px-2 rounded-lg font-semibold flex flex-col items-center gap-1 transition-all ${
                  adjustmentType === 'add'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Stock</span>
                </div>
                <span className="text-[9px] text-neutral-400 font-normal">Restock inflow</span>
              </button>

              <button
                id="batch-mode-subtract-btn"
                type="button"
                onClick={() => setAdjustmentType('subtract')}
                className={`py-2 px-2 rounded-lg font-semibold flex flex-col items-center gap-1 transition-all ${
                  adjustmentType === 'subtract'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Minus className="w-3.5 h-3.5" />
                  <span>Reduce Stock</span>
                </div>
                <span className="text-[9px] text-neutral-400 font-normal">Transfer / Loss</span>
              </button>

              <button
                id="batch-mode-set-btn"
                type="button"
                onClick={() => setAdjustmentType('set')}
                className={`py-2 px-2 rounded-lg font-semibold flex flex-col items-center gap-1 transition-all ${
                  adjustmentType === 'set'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1">
                  <Equal className="w-3.5 h-3.5" />
                  <span>Set Exact</span>
                </div>
                <span className="text-[9px] text-neutral-400 font-normal">Physical count</span>
              </button>
            </div>

            {/* Quantity Stepper & Direct Input */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                {adjustmentType === 'add'
                  ? 'Units to Add to Each SKU (+)'
                  : adjustmentType === 'subtract'
                  ? 'Units to Deduct from Each SKU (-)'
                  : 'Uniform Target Stock Count (=)'}
              </label>

              <div className="flex items-center gap-2">
                <button
                  id="batch-qty-decrement-btn"
                  type="button"
                  onClick={() => setAdjustmentQuantity(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-200 transition-colors cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="relative flex-1">
                  <input
                    id="batch-qty-input"
                    type="number"
                    min={adjustmentType === 'set' ? 0 : 1}
                    max={1000}
                    value={adjustmentQuantity}
                    onChange={e => setAdjustmentQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full text-center py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-neutral-500">
                    units
                  </span>
                </div>

                <button
                  id="batch-qty-increment-btn"
                  type="button"
                  onClick={() => setAdjustmentQuantity(q => q + 1)}
                  className="w-10 h-10 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 flex items-center justify-center text-neutral-200 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Fast Preset Chips */}
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-neutral-500 font-mono">Quick:</span>
                {(adjustmentType === 'set' ? [0, 5, 15, 25, 50] : [5, 10, 20, 50, 100]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAdjustmentQuantity(val)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      adjustmentQuantity === val
                        ? 'bg-neutral-200 text-neutral-950 font-bold'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {adjustmentType === 'add' ? `+${val}` : adjustmentType === 'subtract' ? `-${val}` : val}
                  </button>
                ))}
              </div>
            </div>

            {/* Operational Reason / Audit Tag */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                Adjustment Reason / Audit Tag
              </label>
              <select
                id="batch-reason-select"
                value={adjustmentReason}
                onChange={e => setAdjustmentReason(e.target.value)}
                className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="Inbound Supplier Restock">Inbound Supplier Restock</option>
                <option value="Physical Cycle Count Audit">Physical Cycle Count Audit</option>
                <option value="Damaged / Scrap Write-off">Damaged / Scrap Write-off (⚠️ Critical Audit Flag)</option>
                <option value="Quarantine Inspection Hold">Quarantine Inspection Hold (⚠️ Critical Audit Flag)</option>
                <option value="Inter-Warehouse Transfer">Inter-Warehouse Transfer</option>
                <option value="Promotional Reserve Hold">Promotional Reserve Hold</option>
                <option value="Customer Return Batch">Customer Return Batch</option>
              </select>
            </div>

            {/* Quick Note Field for Appending Context to SKU Audit Logs */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-300 uppercase tracking-wider block">
                  Quick Note / Audit Context
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-normal text-neutral-500 font-mono">Hands-free:</span>
                  <VoiceDictationButton
                    id="batch-quick-note-voice-dictation-btn"
                    onTranscript={(spokenText) => {
                      setQuickNote(prev => (prev ? `${prev} ${spokenText}` : spokenText));
                      addAlert('info', 'Voice Dictation Captured', `Appended spoken audit note: "${spokenText}"`);
                    }}
                    title="Dictate audit note hands-free (Web Speech API)"
                  />
                </div>
              </div>
              <input
                id="batch-quick-note-input"
                type="text"
                value={quickNote}
                onChange={e => setQuickNote(e.target.value)}
                placeholder="e.g. Verified by forklift lead Alex on Bay 4..."
                className="w-full py-2 px-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors font-mono"
              />

              {/* Smart Reconciliation Macro Preset Chips */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[10px] text-neutral-500 font-mono">Macro:</span>
                <button
                  id="smart-recon-macro-cycle-btn"
                  type="button"
                  onClick={() => {
                    setAdjustmentReason('Physical Cycle Count Audit');
                    setQuickNote('Inventory cycle count correction');
                    addAlert('success', '⚡ Smart Macro Applied', 'Applied "Inventory cycle count correction" macro across selected SKUs.');
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-950 text-sky-300 hover:text-white border border-neutral-800 hover:border-sky-500/50 transition-all cursor-pointer flex items-center gap-1"
                  title="Apply common cycle count reconciliation note instantly"
                >
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  <span>Cycle Count Correction</span>
                </button>

                <button
                  id="smart-recon-macro-restock-btn"
                  type="button"
                  onClick={() => {
                    setAdjustmentReason('Inbound Supplier Restock');
                    setQuickNote('Verified inbound shipment dock receipt');
                    addAlert('success', '⚡ Smart Macro Applied', 'Applied "Verified inbound shipment dock receipt" macro.');
                  }}
                  className="px-2 py-0.5 rounded text-[11px] font-mono bg-neutral-950 text-emerald-300 hover:text-white border border-neutral-800 hover:border-emerald-500/50 transition-all cursor-pointer"
                >
                  Dock Receipt
                </button>
              </div>
            </div>

            {/* Projected Impact Preview Box */}
            <div className="pt-2 border-t border-neutral-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-sky-400" />
                  <span>Projected Impact ({selectedProductIds.length} SKUs)</span>
                </span>
                {selectedProductIds.length > 0 && (
                  <span
                    className={`font-mono text-xs font-bold ${
                      totalDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    Net Change: {totalDelta >= 0 ? `+${totalDelta}` : totalDelta} units
                  </span>
                )}
              </div>

              {selectedProductIds.length === 0 ? (
                <div className="p-4 rounded-xl bg-neutral-950/60 border border-neutral-800/60 text-center text-xs text-neutral-500">
                  Select one or more SKUs on the left to preview uniform adjustments.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 max-h-44 overflow-y-auto space-y-2 text-xs">
                  {projectedItems.map((item) => {
                    const auditResult = quickAuditReport?.resultsByProductId[item.product.id];
                    const hasDiscrepancy = Boolean(auditResult?.hasDiscrepancy);
                    return (
                      <div
                        key={item.product.id}
                        className={`flex items-center justify-between gap-2 transition-colors ${
                          hasDiscrepancy
                            ? 'bg-rose-950/60 border border-rose-500/75 rounded-lg px-2 py-1.5'
                            : 'border-b border-neutral-900 pb-1.5 last:border-0 last:pb-0'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1">
                            <span
                              className={`font-mono text-[10px] px-1 py-0.5 rounded font-bold ${
                                hasDiscrepancy
                                  ? 'text-white bg-rose-600'
                                  : 'text-sky-400 bg-neutral-900'
                              }`}
                            >
                              {item.product.sku}
                            </span>
                            <span
                              className={`truncate inline-block max-w-[125px] align-middle text-[11px] ${
                                hasDiscrepancy ? 'text-rose-100 font-semibold' : 'text-neutral-300'
                              }`}
                            >
                              {item.product.name}
                            </span>
                            {hasDiscrepancy && auditResult && (
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[9px] text-rose-100 bg-rose-500/30 px-1.5 py-0.2 rounded border border-rose-400/60 font-bold"
                                title={auditResult.issues.map(i => i.detail).join(' | ')}
                              >
                                <ShieldAlert className="w-2.5 h-2.5 text-rose-300" />
                                <span>{auditResult.issues[0]?.label || 'Discrepancy'}</span>
                              </span>
                            )}
                            {(item.product.reserved > 0 || isReserved(item.product.id)) && (
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[9px] text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/40 font-bold"
                                title={`Active Hold: ${item.product.reserved || 1} units reserved by ${item.product.reservedBy || 'Staff'}`}
                              >
                                <Lock className="w-2.5 h-2.5 text-amber-400" />
                                <span>{item.product.reserved || 1} Reserved</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                          <span className={hasDiscrepancy ? 'text-rose-200' : 'text-neutral-400'}>{item.oldStock}</span>
                          <ArrowRight className="w-3 h-3 text-neutral-600" />
                          <span
                            className={`font-bold ${
                              item.newStock === 0
                                ? 'text-rose-400'
                                : item.newStock <= item.product.lowStockThreshold
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {item.newStock} units
                          </span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              item.delta >= 0
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {item.delta >= 0 ? `+${item.delta}` : item.delta}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {quickAuditReport && quickAuditReport.discrepancySkuCount > 0 && (
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-rose-950/70 border border-rose-500/60 text-[11px] text-rose-200">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>
                      {quickAuditReport.discrepancySkuCount} selected SKU{quickAuditReport.discrepancySkuCount === 1 ? '' : 's'} have unresolved master audit discrepancies.
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
              {/* Real-Time Atomic Checkout & Batch Update Progress Bar */}
              {isSubmitting && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-sky-500/40 space-y-2 animate-fade-in shadow-inner">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-sky-300 font-semibold flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                      <span>{progressStep || 'Executing Atomic Batch Update...'}</span>
                    </span>
                    <span className="text-emerald-400 font-bold">{progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-300 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                id="execute-batch-stock-update-btn"
                type="button"
                onClick={handleExecuteBatchAdjustment}
                disabled={selectedProductIds.length === 0 || isSubmitting}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
                  selectedProductIds.length === 0 || isSubmitting
                    ? 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20 active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Applying Batch Update across {selectedProductIds.length} SKUs...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {selectedProductIds.length === 0
                        ? 'Select SKUs to Apply Batch Update'
                        : `Apply Uniform Adjustment (${selectedProductIds.length} SKUs)`}
                    </span>
                  </>
                )}
              </button>

              <button
                id="batch-action-bulk-quarantine-btn"
                type="button"
                onClick={handleOpenBulkQuarantine}
                disabled={selectedProductIds.length === 0 || isSubmitting || isApplyingBulkQuarantine}
                className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedProductIds.length === 0 || isSubmitting || isApplyingBulkQuarantine
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed'
                    : isBulkQuarantineOpen
                    ? 'bg-rose-600 border-rose-400 text-white shadow-sm'
                    : 'bg-rose-500/20 border-rose-500/55 text-rose-200 hover:bg-rose-500/30 hover:border-rose-400 shadow-sm active:scale-[0.98]'
                }`}
                title={
                  selectedProductIds.length === 0
                    ? 'Select one or more SKUs to place Under Quarantine'
                    : `Mark ${selectedProductIds.length} selected SKU(s) as Under Quarantine with a shared reason and audit log note`
                }
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span>
                  {selectedProductIds.length === 0
                    ? 'Bulk Quarantine (Select SKUs)'
                    : `Bulk Quarantine (${selectedProductIds.length} SKU${selectedProductIds.length === 1 ? '' : 's'})`}
                </span>
              </button>

              <button
                id="batch-print-shipping-labels-btn"
                type="button"
                onClick={handleBatchPrintShippingLabels}
                disabled={selectedProductIds.length === 0 || isSubmitting || isGeneratingShippingPdf}
                className={`w-full py-2.5 px-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                  selectedProductIds.length === 0 || isSubmitting || isGeneratingShippingPdf
                    ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200 hover:bg-indigo-500/30 hover:border-indigo-400 shadow-sm active:scale-[0.98]'
                }`}
                title={
                  selectedProductIds.length === 0
                    ? 'Select one or more SKUs to generate a multi-page printable 4x6 shipping labels PDF'
                    : `Generate printable ${selectedProductIds.length}-page 4x6 shipping labels PDF routed across ${selectedWarehouseHubsCount} warehouse location${selectedWarehouseHubsCount === 1 ? '' : 's'}`
                }
              >
                {isGeneratingShippingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-300" />
                    <span>Generating {selectedProductIds.length}-Page Shipping Labels PDF...</span>
                  </>
                ) : (
                  <>
                    <Truck className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                    <span>Batch Print Shipping Labels</span>
                    {selectedProductIds.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/30 border border-indigo-400/40 text-[10px] font-mono text-indigo-100">
                        <FileDown className="w-2.5 h-2.5" />
                        {selectedProductIds.length}p · {selectedWarehouseHubsCount} Hub{selectedWarehouseHubsCount === 1 ? '' : 's'}
                      </span>
                    )}
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="print-batch-labels-btn"
                  type="button"
                  onClick={handlePrintLabels}
                  disabled={selectedProductIds.length === 0 || isSubmitting}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    selectedProductIds.length === 0 || isSubmitting
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700 hover:border-neutral-600'
                  }`}
                  title="Quick-print shelf stickers for selected SKUs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Stickers ({selectedProductIds.length})</span>
                </button>

                <button
                  id="open-bulk-qr-hub-btn"
                  type="button"
                  onClick={() => setIsBulkQrOpen(true)}
                  disabled={selectedProductIds.length === 0}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                    selectedProductIds.length === 0
                      ? 'bg-neutral-900 border-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-sky-500/15 border-sky-500/40 text-sky-300 hover:bg-sky-500/25 hover:border-sky-500/60'
                  }`}
                  title="Open Bulk QR Code Grid generator and physical label printing center"
                >
                  <QrCode className="w-3.5 h-3.5 text-sky-400" />
                  <span>QR Hub ({selectedProductIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setSearchQuery(code);
          setIsScannerOpen(false);
        }}
      />

      <BulkQrCodeModal
        isOpen={isBulkQrOpen}
        onClose={() => setIsBulkQrOpen(false)}
        products={products}
        selectedProductIds={selectedProductIds}
        initialCategory={selectedCategory}
        initialSearch={searchQuery}
        title="Batch Stock Adjuster - Physical Inventory QR Hub"
      />

      {/* Visual Conflict Detection Helper Modal */}
      <ReservationConflictAlertModal
        product={conflictCandidate}
        bulkProducts={bulkConflictCandidates}
        isOpen={Boolean(conflictCandidate || (bulkConflictCandidates && bulkConflictCandidates.length > 0))}
        onClose={() => {
          setConflictCandidate(null);
          setBulkConflictCandidates(null);
        }}
        onConfirmOverride={(p) => {
          handleConfirmAddConflictedProduct(p);
          setConflictCandidate(null);
        }}
        onConfirmBulkOverride={(prods) => {
          const visibleIds = filteredProducts.map(p => p.id);
          setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
          addAlert(
            'warning',
            '⚠️ Batch Selection Added with Conflicts',
            `Included ${prods.length} reserved SKU(s) in batch update selection.`
          );
          setBulkConflictCandidates(null);
        }}
        onConfirmAddOnlyNonReserved={() => {
          if (!bulkConflictCandidates) return;
          const conflictIds = new Set(bulkConflictCandidates.map(p => p.id));
          const safeIds = filteredProducts
            .filter(p => !conflictIds.has(p.id))
            .map(p => p.id);
          setSelectedProductIds(prev => Array.from(new Set([...prev, ...safeIds])));
          addAlert(
            'success',
            'Safe Batch Selection Applied',
            `Added ${safeIds.length} non-reserved SKUs to batch update. Excluded ${conflictIds.size} reserved item(s).`
          );
          setBulkConflictCandidates(null);
        }}
      />
    </div>
  );
};
