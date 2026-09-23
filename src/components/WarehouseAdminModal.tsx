import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Server,
  PackagePlus,
  Zap,
  Activity,
  AlertTriangle,
  Boxes,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Users,
  ScanLine,
  QrCode,
  TrendingDown,
  Sparkles,
  BellRing,
  Layers,
  CheckSquare,
  Square,
  Eye,
  Sliders,
  ClipboardList,
  Printer,
  Search,
  AlertCircle
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { WarehouseBarcodeScanner } from './WarehouseBarcodeScanner';
import { WarehouseBatchStockUpdate } from './WarehouseBatchStockUpdate';
import { WarehouseFrequentSkus } from './WarehouseFrequentSkus';
import { SkuStockAdjustModal } from './SkuStockAdjustModal';
import { SkuDetailsModal } from './SkuDetailsModal';
import { SkuAuditLogModal } from './SkuAuditLogModal';
import { BulkQrCodeModal } from './BulkQrCodeModal';
import { VoiceDictationButton } from './VoiceDictationButton';
import { WarehouseAiSkuSuggestions } from './WarehouseAiSkuSuggestions';

export const WarehouseAdminModal: React.FC = () => {
  const {
    isAdminOpen,
    setIsAdminOpen,
    adminActiveTab,
    setAdminActiveTab,
    adminSelectedProductIds,
    setAdminSelectedProductIds,
    products,
    metrics,
    restockProduct,
    simulateExternalPurchase,
    connectionStatus,
    setQrCodeProduct,
    simulatePriceDrop,
    resetAllPrices,
    inventoryAlerts,
    skuAdjustProduct,
    setSkuAdjustProduct,
    offlineInventoryQueue,
    syncOfflineInventory
  } = useStore();

  const [scannerProductId, setScannerProductId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(5);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isDroppingPrice, setIsDroppingPrice] = useState(false);

  // Bulk QR Code Generation State
  const [isBulkQrOpen, setIsBulkQrOpen] = useState(false);
  const [skuFilterSearch, setSkuFilterSearch] = useState('');
  const [skuFilterCategory, setSkuFilterCategory] = useState('all');
  const [skuFilterWarehouse, setSkuFilterWarehouse] = useState('all');

  // Frequent SKUs and Rapid Navigation state
  const [skuDetailsProduct, setSkuDetailsProduct] = useState<Product | null>(null);
  const [skuAuditProduct, setSkuAuditProduct] = useState<Product | null>(null);
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // Access counts state with realistic initial seed
  const [accessCounts, setAccessCounts] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem('omnistore_sku_access_counts');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    // Default initial seed for top high-velocity warehouse SKUs
    return {
      'p-1': 68, // RTX 5090
      'p-2': 54, // MacBook Pro M3 Max
      'p-3': 49, // Sony WH-1000XM5
      'p-4': 41, // LG OLED evo
      'p-5': 36, // ROG Swift PG32UCDM
      'p-6': 22,
      'p-7': 18
    };
  });

  const recordSkuAccess = (productId: string) => {
    setAccessCounts(prev => {
      const next = { ...prev, [productId]: (prev[productId] || 0) + 1 };
      try {
        localStorage.setItem('omnistore_sku_access_counts', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleOpenSkuDetails = (product: Product) => {
    recordSkuAccess(product.id);
    setSkuDetailsProduct(product);
  };

  const handleOpenStockAdjust = (product: Product) => {
    recordSkuAccess(product.id);
    setSkuAdjustProduct(product);
  };

  const handleOpenSkuAudit = (product: Product) => {
    recordSkuAccess(product.id);
    setSkuAuditProduct(product);
  };

  const handleQuickRestock = async (product: Product, qty: number) => {
    recordSkuAccess(product.id);
    setRestockingId(product.id);
    const ok = await restockProduct(product.id, qty);
    setRestockingId(null);
    if (ok) {
      setActionSuccess(`Restocked +${qty} units to "${product.name}"! Live broadcast sent.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleJumpToSkuRow = (productId: string) => {
    recordSkuAccess(productId);
    const targetElement = document.getElementById(`admin-stock-row-${productId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedProductId(productId);
      setTimeout(() => setHighlightedProductId(null), 2500);
    }
  };

  // Unique categories and warehouses for inventory filter
  const adminCategories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  const adminWarehouses = useMemo(() => {
    const set = new Set(products.map(p => p.warehouse.split('(')[0].trim()));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products list for inventory view
  const filteredInventoryProducts = useMemo(() => {
    return products.filter(product => {
      if (skuFilterCategory !== 'all' && product.category !== skuFilterCategory) {
        return false;
      }
      if (skuFilterWarehouse !== 'all' && !product.warehouse.toLowerCase().includes(skuFilterWarehouse.toLowerCase())) {
        return false;
      }
      if (skuFilterSearch.trim()) {
        const q = skuFilterSearch.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesSku = product.sku.toLowerCase().includes(q);
        const matchesCategory = product.category.toLowerCase().includes(q);
        const matchesWh = product.warehouse.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCategory && !matchesWh) {
          return false;
        }
      }
      return true;
    });
  }, [products, skuFilterCategory, skuFilterWarehouse, skuFilterSearch]);

  if (!isAdminOpen) return null;

  const handleSimulate = async (productId?: string) => {
    setSimulating(true);
    setActionSuccess(null);
    const ok = await simulateExternalPurchase(productId);
    setSimulating(false);
    if (ok) {
      setActionSuccess('Simulated external order received! Watch stock drop live.');
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleRestock = async (productId: string) => {
    setRestockingId(productId);
    setActionSuccess(null);
    const ok = await restockProduct(productId, restockQty);
    setRestockingId(null);
    if (ok) {
      setActionSuccess(`Restocked +${restockQty} units! Broadcasted to all shoppers.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="warehouse-admin-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setIsAdminOpen(false)}
      >
        <motion.div
          id="warehouse-admin-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-950 border border-neutral-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Server className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Live Inventory Control & Telemetry</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    REALTIME BROADCAST
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Authoritative multi-warehouse stock management with instant WebSocket synchronization.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAdminOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Success Alert */}
          {actionSuccess && (
            <div className="bg-emerald-950/90 border-b border-emerald-800 px-5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Offline Sync Queue Banner */}
          {offlineInventoryQueue && offlineInventoryQueue.length > 0 && (
            <div className="bg-amber-950/80 border-b border-amber-800/80 px-5 py-2 text-xs text-amber-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>{offlineInventoryQueue.length}</strong> offline warehouse updates queued.
                </span>
              </div>
              <button
                onClick={() => syncOfflineInventory()}
                className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Sync Now
              </button>
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/30">
            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Total Units In Stock</span>
              <span className="text-xl font-bold font-mono text-white mt-0.5 block">{metrics.unitsInStock}</span>
              <span className="text-[10px] text-neutral-400">across 3 automated hubs</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Low Stock Warnings</span>
              <span className={`text-xl font-bold font-mono mt-0.5 block ${metrics.lowStockItemsCount > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                {metrics.lowStockItemsCount} SKUs
              </span>
              <span className="text-[10px] text-neutral-400">threshold ≤ 4 units</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Orders Settled Today</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">{metrics.ordersProcessedToday}</span>
              <span className="text-[10px] text-neutral-400">100% fraud cleared</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Active Feed Socket</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {connectionStatus === 'connected' ? 'WebSocket Active' : 'SSE Stream Active'}
              </span>
              <span className="text-[10px] text-neutral-400">&lt; 15ms latency</span>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <button
                id="warehouse-tab-inventory-btn"
                onClick={() => setAdminActiveTab('inventory')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  adminActiveTab === 'inventory'
                    ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inventory & SKUs</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-950 text-neutral-400 border border-neutral-800">
                  {products.length}
                </span>
              </button>

              <button
                id="warehouse-tab-batch-btn"
                onClick={() => setAdminActiveTab('batch')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  adminActiveTab === 'batch'
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50 shadow-sm font-bold'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>Batch Stock Adjuster</span>
                {adminSelectedProductIds.length > 0 ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500 text-neutral-950 font-bold">
                    {adminSelectedProductIds.length} Selected
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-950 text-neutral-400 border border-neutral-800">
                    Multi-SKU
                  </span>
                )}
              </button>

              <button
                id="warehouse-tab-scanner-btn"
                onClick={() => setAdminActiveTab('scanner')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                  adminActiveTab === 'scanner'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                <ScanLine className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>Optical Barcode Scanner</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40">
                  SIMULATOR
                </span>
              </button>
            </div>

            {adminActiveTab === 'inventory' && (
              <div className="flex items-center gap-2">
                <button
                  id="warehouse-bulk-qr-gen-btn"
                  onClick={() => setIsBulkQrOpen(true)}
                  className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 transition-colors cursor-pointer"
                  title="Generate bulk scannable QR codes for physical inventory labeling"
                >
                  <QrCode className="w-3.5 h-3.5 text-sky-400" />
                  <span className="hidden sm:inline">Bulk QR Codes & Labels</span>
                  <span className="sm:hidden">Bulk QR</span>
                </button>

                <button
                  id="warehouse-quick-open-scanner-btn"
                  onClick={() => {
                    setScannerProductId(products[0]?.id || null);
                    setAdminActiveTab('scanner');
                  }}
                  className="text-xs font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 py-1 px-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                >
                  <ScanLine className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Launch Barcode Scanner</span>
                </button>
              </div>
            )}
          </div>

          {adminActiveTab === 'scanner' ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <WarehouseBarcodeScanner
                initialProductId={scannerProductId}
                onClose={() => setAdminActiveTab('inventory')}
              />
            </div>
          ) : adminActiveTab === 'batch' ? (
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <WarehouseBatchStockUpdate
                selectedProductIds={adminSelectedProductIds}
                setSelectedProductIds={setAdminSelectedProductIds}
                onFinishedSuccess={(msg) => {
                  setActionSuccess(msg);
                }}
                onSwitchToInventory={() => setAdminActiveTab('inventory')}
              />
            </div>
          ) : (
            <>
              {/* Simulation Playground Panel */}
              <div className="p-4 sm:p-5 bg-neutral-900/20 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <span>Multi-User Concurrent Stress Test</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Simulate another shopper purchasing items simultaneously to verify live stock decrement on your screen.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="admin-simulate-price-drop-button"
                    onClick={async () => {
                      setIsDroppingPrice(true);
                      await simulatePriceDrop(undefined, 15);
                      setIsDroppingPrice(false);
                      setActionSuccess('15% Flash Price Drop broadcasted! Watching price alerts triggered.');
                      setTimeout(() => setActionSuccess(null), 3500);
                    }}
                    disabled={isDroppingPrice}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50"
                    title="Simulate a 15% markdown across products to trigger user price alerts"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>{isDroppingPrice ? 'Broadcasting...' : 'Simulate 15% Flash Markdown'}</span>
                  </button>

                  <button
                    id="admin-reset-prices-button"
                    onClick={async () => {
                      await resetAllPrices();
                      setActionSuccess('All catalog prices reset to baseline MSRP.');
                      setTimeout(() => setActionSuccess(null), 3000);
                    }}
                    className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700"
                    title="Reset all prices back to default catalog values"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reset Baseline Prices</span>
                  </button>

                  <button
                    id="admin-simulate-order-button"
                    onClick={() => handleSimulate()}
                    disabled={simulating}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
                  >
                    {simulating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Executing Sim...</span>
                      </>
                    ) : (
                      <>
                        <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Simulate External Order (Stock Drops Live)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Product Stock Table */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                {/* Batch selection quick action banner */}
                {adminSelectedProductIds.length > 0 && (
                  <div
                    id="admin-inventory-batch-banner"
                    className="mb-4 p-3 rounded-xl bg-sky-950/40 border border-sky-500/40 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                      <span className="text-sky-200 font-semibold">
                        <strong className="text-white">{adminSelectedProductIds.length}</strong> SKU{adminSelectedProductIds.length > 1 ? 's' : ''} selected for batch update
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        id="admin-inventory-open-batch-adjuster-btn"
                        onClick={() => setAdminActiveTab('batch')}
                        className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Configure Uniform Batch Adjustment</span>
                      </button>
                      <button
                        id="admin-inventory-bulk-qr-selected-btn"
                        onClick={() => setIsBulkQrOpen(true)}
                        className="px-3 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-bold text-xs flex items-center gap-1.5 border border-sky-500/40 transition-colors cursor-pointer"
                        title="Generate QR code grid and print labels for selected SKUs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print QR Labels ({adminSelectedProductIds.length})</span>
                      </button>
                      <button
                        id="admin-inventory-clear-selected-btn"
                        onClick={() => setAdminSelectedProductIds([])}
                        className="text-neutral-400 hover:text-white px-2 py-1 text-xs cursor-pointer"
                      >
                        Deselect
                      </button>
                    </div>
                  </div>
                )}

                {/* AI-Powered SKU Suggestion Engine */}
                <WarehouseAiSkuSuggestions
                  products={products}
                  onOpenStockAdjust={handleOpenStockAdjust}
                  onOpenSkuDetails={handleOpenSkuDetails}
                  onQuickRestockSuccess={(msg) => {
                    setActionSuccess(msg);
                    setTimeout(() => setActionSuccess(null), 3500);
                  }}
                  onBatchSelectSkus={(ids) => {
                    setAdminSelectedProductIds(ids);
                    setAdminActiveTab('batch');
                  }}
                />

                {/* Frequent SKUs Section */}
                <WarehouseFrequentSkus
                  products={products}
                  accessCounts={accessCounts}
                  onOpenDetails={handleOpenSkuDetails}
                  onOpenStockAdjust={handleOpenStockAdjust}
                  onQuickRestock={handleQuickRestock}
                  onJumpToRow={handleJumpToSkuRow}
                />

                {/* Inventory Filter Bar with Bulk QR Generation for Current View */}
                <div
                  id="admin-inventory-filter-bar"
                  className="mb-3.5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <div className="relative flex-1 flex items-center">
                      {skuFilterSearch.trim() && filteredInventoryProducts.length === 0 ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none animate-pulse" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      )}
                      <input
                        id="admin-inventory-search-input"
                        type="text"
                        value={skuFilterSearch}
                        onChange={(e) => setSkuFilterSearch(e.target.value)}
                        placeholder="Filter by SKU or speak code (e.g. 'RTX-5090')..."
                        className={`w-full pl-8 pr-16 py-1.5 rounded-lg text-xs font-mono transition-colors focus:outline-none ${
                          skuFilterSearch.trim() && filteredInventoryProducts.length === 0
                            ? 'bg-rose-950/30 border-2 border-rose-500/80 text-rose-200 placeholder-rose-400/50 shadow-xs shadow-rose-950/40 ring-1 ring-rose-500/30'
                            : 'bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:border-sky-500'
                        }`}
                        aria-invalid={skuFilterSearch.trim() !== '' && filteredInventoryProducts.length === 0}
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {skuFilterSearch && (
                          <button
                            id="admin-inventory-clear-search-btn"
                            onClick={() => setSkuFilterSearch('')}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              filteredInventoryProducts.length === 0 ? 'text-rose-400 hover:text-white' : 'text-neutral-400 hover:text-white'
                            }`}
                            title="Clear search"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <VoiceDictationButton
                          id="admin-sku-voice-dictation-btn"
                          onTranscript={(text) => setSkuFilterSearch(text)}
                          title="Speak SKU code hands-free (Web Speech API)"
                        />
                      </div>
                    </div>

                    <select
                      id="admin-inventory-category-select"
                      value={skuFilterCategory}
                      onChange={(e) => setSkuFilterCategory(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-sky-500 capitalize cursor-pointer"
                    >
                      <option value="all">All Categories</option>
                      {adminCategories.filter(c => c !== 'all').map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>

                    <select
                      id="admin-inventory-warehouse-select"
                      value={skuFilterWarehouse}
                      onChange={(e) => setSkuFilterWarehouse(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-300 text-xs focus:outline-none focus:border-sky-500 cursor-pointer hidden md:block"
                    >
                      <option value="all">All Hubs</option>
                      {adminWarehouses.filter(w => w !== 'all').map(wh => (
                        <option key={wh} value={wh}>
                          {wh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Select / Deselect All in Current Filtered View */}
                    <button
                      id="admin-select-all-filtered-btn"
                      onClick={() => {
                        const filteredIds = filteredInventoryProducts.map(p => p.id);
                        const allSelected = filteredIds.every(id => adminSelectedProductIds.includes(id));
                        if (allSelected) {
                          setAdminSelectedProductIds(prev => prev.filter(id => !filteredIds.includes(id)));
                        } else {
                          setAdminSelectedProductIds(prev => Array.from(new Set([...prev, ...filteredIds])));
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Select or deselect all items in the current filtered view"
                    >
                      <CheckSquare className="w-3.5 h-3.5 text-sky-400" />
                      <span>
                        {filteredInventoryProducts.length > 0 &&
                        filteredInventoryProducts.every(p => adminSelectedProductIds.includes(p.id))
                          ? 'Deselect View'
                          : 'Select View'}
                      </span>
                    </button>

                    {/* Bulk QR Code Generation Button for Current Filtered View */}
                    <button
                      id="admin-bulk-qr-filtered-btn"
                      onClick={() => setIsBulkQrOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
                      title="Generate grid of scannable QR codes for physical inventory labeling for all SKUs in current view"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>
                        Bulk QR Codes ({filteredInventoryProducts.length} SKUs)
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-300 uppercase tracking-wider">
                      Live SKUs & Real-time Adjustment
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                      Showing {filteredInventoryProducts.length} of {products.length} SKUs
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-neutral-400">
                    <span>Restock Step:</span>
                    {[5, 10, 25].map((qty) => (
                      <button
                        key={qty}
                        onClick={() => setRestockQty(qty)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          restockQty === qty ? 'bg-emerald-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {filteredInventoryProducts.length === 0 ? (
                    <div className="p-8 text-center text-neutral-400 bg-neutral-900/40 rounded-xl border border-neutral-800">
                      <p className="text-sm font-semibold text-neutral-300">No inventory matches your current filter.</p>
                      <button
                        onClick={() => {
                          setSkuFilterSearch('');
                          setSkuFilterCategory('all');
                          setSkuFilterWarehouse('all');
                        }}
                        className="mt-2 text-xs text-sky-400 hover:text-sky-300 underline cursor-pointer"
                      >
                        Clear filters to view all {products.length} SKUs
                      </button>
                    </div>
                  ) : filteredInventoryProducts.map((product, index) => {
                    const isOutOfStock = product.stock <= 0;
                    const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;
                    const isSelected = adminSelectedProductIds.includes(product.id);
                    const isHighlighted = highlightedProductId === product.id;

                    return (
                      <div
                        key={product.id}
                        id={`admin-stock-row-${product.id}`}
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-300 ${
                          isHighlighted
                            ? 'ring-2 ring-amber-400 bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-500/20'
                            : isSelected
                            ? 'bg-sky-950/20 border-sky-500/50'
                            : 'bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Batch Selection Checkbox */}
                          <button
                            id={`admin-select-sku-checkbox-${product.id}`}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdminSelectedProductIds(prev =>
                                prev.includes(product.id)
                                  ? prev.filter(id => id !== product.id)
                                  : [...prev, product.id]
                              );
                            }}
                            title={isSelected ? 'Deselect from batch' : 'Select SKU for batch stock adjustment'}
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${
                              isSelected
                                ? 'bg-sky-500 border-sky-400 text-neutral-950'
                                : 'border-neutral-700 bg-neutral-950 hover:border-neutral-500 text-transparent'
                            }`}
                          >
                            <CheckSquare className={`w-3.5 h-3.5 ${isSelected ? 'block' : 'hidden'}`} />
                          </button>

                          <img
                            src={product.images[0]}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover bg-neutral-950 shrink-0 border border-neutral-800 cursor-pointer"
                            onClick={() => handleOpenSkuDetails(product)}
                            title="Click to view full SKU details"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h5
                                onClick={() => handleOpenSkuDetails(product)}
                                className="text-xs font-semibold text-white truncate max-w-sm hover:text-sky-300 cursor-pointer transition-colors"
                                title="Click to view details"
                              >
                                {product.name}
                              </h5>
                              <span className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                                {product.sku}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5">
                              <span className="font-mono text-emerald-400 font-medium">
                                ${product.price.toFixed(2)}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-mono text-[10px]">
                                <MapPin className="w-3 h-3 text-neutral-500" />
                                {product.warehouse.split('(')[0].trim()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          {/* Current Stock Badge */}
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className={`text-base font-bold font-mono ${
                                isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                              }`}>
                                {product.stock} units
                              </span>
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono block">
                              {product.reserved > 0 ? `(${product.reserved} reserved)` : '0 active holds'}
                            </span>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5">
                            {/* SKU Details Navigation Button */}
                            <button
                              id={`admin-row-details-btn-${product.id}`}
                              onClick={() => handleOpenSkuDetails(product)}
                              title="View Full SKU Telemetry & Details"
                              className="px-2 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-300 text-xs font-mono flex items-center gap-1 transition-colors border border-neutral-700/80 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Details</span>
                            </button>

                            {/* Stock Adjustment Settings Button */}
                            <button
                              id={`admin-row-adjust-btn-${product.id}`}
                              onClick={() => handleOpenStockAdjust(product)}
                              title="Configure Stock Adjustment Settings"
                              className="px-2 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-1 transition-colors border border-emerald-500/30 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Adjust</span>
                            </button>

                            {/* Stock Adjustment Audit Log Button */}
                            <button
                              id={`admin-row-audit-btn-${product.id}`}
                              onClick={() => handleOpenSkuAudit(product)}
                              title="View SKU Stock Adjustment Audit Trail"
                              className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono flex items-center gap-1 transition-colors border border-amber-500/30 cursor-pointer"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              <span className="hidden lg:inline">Audit</span>
                            </button>

                            {/* Barcode Scan Action Button */}
                            <button
                              id={`admin-scan-btn-${product.id}`}
                              onClick={() => {
                                recordSkuAccess(product.id);
                                setScannerProductId(product.id);
                                setAdminActiveTab('scanner');
                              }}
                              title="Scan Item Barcode for Aisle & Tracking Verification"
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-400 text-xs font-mono flex items-center gap-1.5 transition-colors border border-neutral-700/80 cursor-pointer"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Scan</span>
                            </button>

                            {/* Mobile QR Code Button */}
                            <button
                              id={`admin-qr-btn-${product.id}`}
                              onClick={() => {
                                recordSkuAccess(product.id);
                                setQrCodeProduct(product);
                              }}
                              title="Generate Mobile QR Code for this item"
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-400 text-xs font-mono flex items-center gap-1.5 transition-colors border border-neutral-700/80 cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">QR</span>
                            </button>

                            {/* Drop price button */}
                            <button
                              id={`admin-drop-price-${product.id}`}
                              onClick={async () => {
                                recordSkuAccess(product.id);
                                await simulatePriceDrop(product.id, 15);
                                setActionSuccess(`Price dropped 15% for "${product.name}"!`);
                                setTimeout(() => setActionSuccess(null), 3000);
                              }}
                              title="Markdown item by 15% to trigger price alerts"
                              className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono flex items-center gap-1 transition-colors border border-amber-500/30 cursor-pointer"
                            >
                              <TrendingDown className="w-3 h-3" />
                              <span>-15%</span>
                            </button>

                            <button
                              onClick={() => {
                                recordSkuAccess(product.id);
                                handleSimulate(product.id);
                              }}
                              title="Simulate 1 purchase of this item"
                              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors cursor-pointer"
                            >
                              -1 Sim
                            </button>
                            <button
                              id={`admin-restock-${product.id}`}
                              onClick={() => {
                                recordSkuAccess(product.id);
                                handleRestock(product.id);
                              }}
                              disabled={restockingId === product.id}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                              <span>Restock +{restockQty}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Sku Details Modal */}
      <SkuDetailsModal
        product={skuDetailsProduct}
        isOpen={Boolean(skuDetailsProduct)}
        onClose={() => setSkuDetailsProduct(null)}
        onOpenStockAdjust={handleOpenStockAdjust}
        onOpenScanner={(p) => {
          recordSkuAccess(p.id);
          setScannerProductId(p.id);
          setAdminActiveTab('scanner');
        }}
        onOpenQrCode={(p) => {
          recordSkuAccess(p.id);
          setQrCodeProduct(p);
        }}
        onOpenAuditLog={handleOpenSkuAudit}
        onJumpToRow={handleJumpToSkuRow}
      />

      {/* Sku Stock Adjustment Modal */}
      <SkuStockAdjustModal
        product={skuAdjustProduct}
        isOpen={Boolean(skuAdjustProduct)}
        onClose={() => setSkuAdjustProduct(null)}
        onSuccess={(msg) => {
          setActionSuccess(msg);
          setTimeout(() => setActionSuccess(null), 3500);
        }}
        onNavigateToDetails={handleOpenSkuDetails}
      />

      {/* Sku Stock Adjustment Audit Log Modal */}
      <SkuAuditLogModal
        product={skuAuditProduct}
        isOpen={Boolean(skuAuditProduct)}
        onClose={() => setSkuAuditProduct(null)}
      />

      {/* Bulk QR Code Generation & Label Printing Hub Modal */}
      <BulkQrCodeModal
        isOpen={isBulkQrOpen}
        onClose={() => setIsBulkQrOpen(false)}
        products={filteredInventoryProducts}
        selectedProductIds={adminSelectedProductIds.length > 0 ? adminSelectedProductIds : undefined}
        initialCategory={skuFilterCategory}
        initialWarehouse={skuFilterWarehouse}
        initialSearch={skuFilterSearch}
        title="Physical Inventory SKU QR Code & Label Printing Hub"
      />
    </AnimatePresence>
  );
};
