import React, { useState, useMemo } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ScannerModal } from './ScannerModal';
import { BulkQrCodeModal } from './BulkQrCodeModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import { Product } from '../types';

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
  const { products, batchAdjustStock, addAlert } = useStore();

  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [adjustmentQuantity, setAdjustmentQuantity] = useState<number>(10);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('Inbound Supplier Restock');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBulkQrOpen, setIsBulkQrOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  // Toggle single product selection
  const handleToggleProduct = (productId: string) => {
    setSelectedProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Quick Selection Helpers
  const handleSelectAllVisible = () => {
    const visibleIds = filteredProducts.map(p => p.id);
    setSelectedProductIds(prev => Array.from(new Set([...prev, ...visibleIds])));
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
      addAlert('Failed to generate print layout.', 'error');
    }
  };

  const handleExecuteBatchAdjustment = async () => {

    if (selectedProductIds.length === 0) return;
    if (adjustmentQuantity < 0 || isNaN(adjustmentQuantity)) return;

    setIsSubmitting(true);

    const snapshot = projectedItems.map((item, index) => ({
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      oldStock: item.oldStock,
      newStock: item.newStock,
      delta: item.delta
    }));

    const result = await batchAdjustStock({
      productIds: selectedProductIds,
      adjustmentType,
      quantity: adjustmentQuantity,
      reason: adjustmentReason
    });

    setIsSubmitting(false);

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
    }
  };

  return (
    <div id="warehouse-batch-update-container" className="space-y-5">
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

              {/* Selection Counter Pill */}
              <div className="flex items-center gap-2">
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
              filteredProducts.map((product, index) => {
                const isSelected = selectedProductIds.includes(product.id);
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

                return (
                  <div
                    key={product.id}
                    id={`batch-sku-item-${product.id}`}
                    onClick={() => handleToggleProduct(product.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-sky-950/25 border-sky-500/60 shadow-sm ring-1 ring-sky-500/30'
                        : 'bg-neutral-900/50 border-neutral-800/80 hover:border-neutral-700 hover:bg-neutral-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox Icon */}
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          handleToggleProduct(product.id);
                        }}
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 ${
                          isSelected
                            ? 'bg-sky-500 border-sky-400 text-neutral-950'
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
                        className="w-10 h-10 rounded-lg object-cover bg-neutral-950 shrink-0 border border-neutral-800"
                      />

                      {/* Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-neutral-950 text-sky-400 border border-neutral-800">
                            {product.sku}
                          </span>
                          <h5 className="text-xs font-semibold text-white truncate max-w-xs">
                            {product.name}
                          </h5>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                          <span className="font-mono text-emerald-400">${product.price.toFixed(2)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            {product.warehouse.split('(')[0].trim()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stock Status Pill */}
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                          isOutOfStock
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : isLowStock
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : 'bg-neutral-800 text-emerald-300 border-neutral-700'
                        }`}
                      >
                        {product.stock} units
                      </span>
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
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Uniform Adjustment Configuration & Projection (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                  <span>Uniform Adjustment Mode</span>
                </h4>
                <span className="text-[10px] font-mono text-neutral-400">
                  {selectedProductIds.length} target(s)
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Choose how stock levels will be uniformly altered across all selected SKUs.
              </p>
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
                <option value="Damaged / Scrap Write-off">Damaged / Scrap Write-off</option>
                <option value="Inter-Warehouse Transfer">Inter-Warehouse Transfer</option>
                <option value="Promotional Reserve Hold">Promotional Reserve Hold</option>
                <option value="Customer Return Batch">Customer Return Batch</option>
              </select>
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
                  {projectedItems.map((item, index) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-2 border-b border-neutral-900 pb-1.5 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-sky-400 bg-neutral-900 px-1 py-0.5 rounded mr-1.5 font-bold">
                          {item.product.sku}
                        </span>
                        <span className="text-neutral-300 truncate inline-block max-w-[130px] align-middle text-[11px]">
                          {item.product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs shrink-0">
                        <span className="text-neutral-400">{item.oldStock}</span>
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
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2">
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
    </div>
  );
};
