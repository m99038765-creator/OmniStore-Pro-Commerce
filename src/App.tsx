import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Server,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Lock,
  Truck,
  RotateCcw,
  Sparkles,
  Layers,
  PackagePlus,
  Heart,
  ScanBarcode,
  Barcode,
  X,
  Copy,
  Check,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Camera,
  AlertCircle,
  HelpCircle,
  CornerDownLeft,
  Shield,
  ShieldAlert,
  Unlock,
  FileText,
  ExternalLink
} from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { LiveTickerBar } from './components/LiveTickerBar';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SkuAuditLogModal } from './components/SkuAuditLogModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { WarehouseAdminModal } from './components/WarehouseAdminModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { OrderHistoryModal } from './components/OrderHistoryModal';
import { NewsletterSubscription } from './components/NewsletterSubscription';
import { NotificationToasts } from './components/NotificationToasts';
import { ComparisonBar } from './components/ComparisonBar';
import { ProductComparisonModal } from './components/ProductComparisonModal';
import { ProductQrCodeModal } from './components/ProductQrCodeModal';
import { InventoryAlertModal } from './components/InventoryAlertModal';
import { WarehouseInventoryChart } from './components/WarehouseInventoryChart';
import { PredictiveInsightsWidget } from './components/PredictiveInsightsWidget';
import { UserProfileModal } from './components/UserProfileModal';
import { ScannerModal, extractSkuFromDecodedText } from './components/ScannerModal';
import { VoiceDictationButton } from './components/VoiceDictationButton';

const StorefrontContent: React.FC = () => {
  const {
    products,
    orders,
    searchQuery,
    skuSearchQuery,
    setSkuSearchQuery,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    onlyInStock,
    setOnlyInStock,
    onlyLowStock,
    setOnlyLowStock,
    onlyWishlist,
    setOnlyWishlist,
    wishlistProductIds,
    metrics,
    setIsAdminOpen,
    setAdminActiveTab,
    setAdminSelectedProductIds,
    setSkuAdjustProduct,
    trendingSkuSearches,
    trackSkuSearch,
    addAlert,
    isSafeModeEnabled,
    setIsSafeModeEnabled,
    checkSkuSafety
  } = useStore();

  const [copiedSku, setCopiedSku] = useState<string | null>(null);
  const [copiedAuditId, setCopiedAuditId] = useState<string | null>(null);
  const [isSkuInputFocused, setIsSkuInputFocused] = useState(false);
  const [isSkuScannerOpen, setIsSkuScannerOpen] = useState(false);
  const [safeModeAuditSku, setSafeModeAuditSku] = useState<string | null>(null);

  // Handle successful barcode or QR code scan for SKU
  const handleSkuScanned = (scannedText: string) => {
    const extractedSku = extractSkuFromDecodedText(scannedText, products);
    const targetSku = (extractedSku || scannedText).trim();

    if (targetSku) {
      setSkuSearchQuery(targetSku);
      trackSkuSearch(targetSku);
      setIsSkuScannerOpen(false);

      const matchedProduct = products.find(
        (p) => p.sku.toLowerCase() === targetSku.toLowerCase()
      );

      if (matchedProduct) {
        addAlert(
          'success',
          'SKU Scanned & Filtered',
          `Recognized "${matchedProduct.sku}" (${matchedProduct.name}). Filtered inventory.`
        );
      } else {
        addAlert(
          'info',
          'SKU Scanned',
          `Populated search field with detected SKU: "${targetSku}".`
        );
      }
    }
  };

  const handleCopySku = async (sku: string, productName: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(sku);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = sku;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedSku(sku);
      addAlert(
        'info',
        'SKU Copied to Clipboard',
        `Copied SKU "${sku}" (${productName}) to your clipboard.`
      );
      setTimeout(() => {
        setCopiedSku((prev) => (prev === sku ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy SKU:', err);
    }
  };

  const handleCopyAuditId = async (auditId: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(auditId);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = auditId;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopiedAuditId(auditId);
      addAlert(
        'info',
        'Audit Record ID Copied',
        `Copied "${auditId}" to clipboard for incident reporting.`
      );
      setTimeout(() => {
        setCopiedAuditId((prev) => (prev === auditId ? null : prev));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy audit record ID:', err);
    }
  };

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Wishlist filter
    if (onlyWishlist) {
      list = list.filter((p) => p.isWishlisted || p.wishlist || wishlistProductIds.includes(p.id));
    }

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Dedicated Warehouse SKU Code Search
    if (skuSearchQuery.trim()) {
      const qSku = skuSearchQuery.trim().toLowerCase();
      const cleanQSku = qSku.replace(/[-\s_]/g, '');
      list = list.filter((p) => {
        const prodSku = p.sku.toLowerCase();
        const cleanProdSku = prodSku.replace(/[-\s_]/g, '');
        const matchesSku = prodSku.includes(qSku) || cleanProdSku.includes(cleanQSku);
        if (!matchesSku) return false;

        // When Safe Mode is enabled, cross-reference check against the warehouse audit log:
        // ensure the SKU being searched for has not been flagged for 'Under Quarantine' or 'Damaged' status before returning results
        if (isSafeModeEnabled) {
          const safety = checkSkuSafety(p.sku);
          if (!safety.isSafe) {
            return false; // Suppress from returned search results
          }
        }
        return true;
      });
    }

    // General Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          Object.values(p.specs).some((val) => String(val).toLowerCase().includes(q))
      );
    }

    // In stock only
    if (onlyInStock) {
      list = list.filter((p) => p.stock > 0);
    }

    // Low stock threshold filter: exclusively view products currently below their threshold
    if (onlyLowStock) {
      list = list.filter((p) => p.stock <= p.lowStockThreshold);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'stock-asc') {
      list.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === 'stock-desc') {
      list.sort((a, b) => b.stock - a.stock);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [products, selectedCategory, searchQuery, skuSearchQuery, isSafeModeEnabled, checkSkuSafety, onlyInStock, onlyLowStock, onlyWishlist, wishlistProductIds, sortBy]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock <= p.lowStockThreshold).length;
  }, [products]);

  const availableSkus = useMemo(() => {
    return Array.from(new Set(products.map((p) => p.sku)));
  }, [products]);

  // Cross-reference check for exact entered SKU query against warehouse audit log
  const searchedSkuSafety = useMemo(() => {
    if (!skuSearchQuery.trim()) return null;
    return checkSkuSafety(skuSearchQuery.trim());
  }, [skuSearchQuery, checkSkuSafety]);

  // Products matching SKU search that have been withheld/suppressed by Safe Mode
  const safeModeSuppressedProducts = useMemo(() => {
    if (!isSafeModeEnabled || !skuSearchQuery.trim()) return [];
    const qSku = skuSearchQuery.trim().toLowerCase();
    const cleanQSku = qSku.replace(/[-\s_]/g, '');

    return products
      .filter((p) => {
        const prodSku = p.sku.toLowerCase();
        const cleanProdSku = prodSku.replace(/[-\s_]/g, '');
        return prodSku.includes(qSku) || cleanProdSku.includes(cleanQSku);
      })
      .map((p) => {
        const safety = checkSkuSafety(p.sku);
        return {
          product: p,
          safety
        };
      })
      .filter((item) => !item.safety.isSafe);
  }, [products, skuSearchQuery, isSafeModeEnabled, checkSkuSafety]);

  const exactSkuProduct = useMemo(() => {
    if (!skuSearchQuery.trim()) return null;
    const target = skuSearchQuery.trim().toLowerCase();
    return products.find((p) => p.sku.toLowerCase() === target) || null;
  }, [products, skuSearchQuery]);

  const skuSuggestions = useMemo(() => {
    if (!skuSearchQuery.trim()) return [];
    const target = skuSearchQuery.trim().toLowerCase();
    return availableSkus
      .filter((sku) => sku.toLowerCase().includes(target))
      .slice(0, 8); // Limit to 8 suggestions
  }, [availableSkus, skuSearchQuery]);

  // Visual error & validation state for SKU search input
  // Analyzes whether the inputted SKU is valid, partially matching, non-existent, or malformed
  const skuValidationStatus = useMemo(() => {
    const raw = skuSearchQuery.trim();
    if (!raw) {
      return { status: 'empty', isError: false, message: '', suggestion: null };
    }

    // Exact match found!
    if (exactSkuProduct) {
      if (isSafeModeEnabled && searchedSkuSafety && !searchedSkuSafety.isSafe) {
        return {
          status: 'quarantine_intercept',
          isError: false,
          isQuarantineIntercept: true,
          message: `Safe Mode Intercept: ${searchedSkuSafety.statusLabel} (${exactSkuProduct.name})`,
          suggestion: null
        };
      }
      return {
        status: 'valid',
        isError: false,
        message: `Verified SKU: ${exactSkuProduct.name}`,
        suggestion: null
      };
    }

    // Check if there are partial SKU matches (user is still typing a valid SKU)
    const normalizedInput = raw.toLowerCase().replace(/[-\s_]/g, '');
    const partialMatches = products.filter(p => {
      const prodSku = p.sku.toLowerCase();
      const cleanProdSku = prodSku.replace(/[-\s_]/g, '');
      return prodSku.includes(raw.toLowerCase()) || cleanProdSku.includes(normalizedInput);
    });

    if (partialMatches.length > 0) {
      return {
        status: 'typing',
        isError: false,
        message: `${partialMatches.length} matching SKU${partialMatches.length > 1 ? 's' : ''}`,
        suggestion: partialMatches[0].sku
      };
    }

    // Check if malformed format: OmniStore SKUs standard format is alphanumeric hyphenated (e.g. AUD-REF-8040, KB-TITAN-75)
    const hasInvalidChars = /[^a-zA-Z0-9\-_ ]/.test(raw);
    const isMalformed = hasInvalidChars || raw.length < 2;

    // Find closest SKU suggestion for typo tolerance (levenshtein or common prefix)
    const findClosestSku = (): string | null => {
      let closestSku: string | null = null;
      let minDistance = 999;
      for (const sku of availableSkus) {
        // Simple Levenshtein distance
        const s1 = raw.toUpperCase();
        const s2 = sku.toUpperCase();
        const m = s1.length;
        const n = s2.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 0; i <= m; i++) dp[i][0] = i;
        for (let j = 0; j <= n; j++) dp[0][j] = j;
        for (let i = 1; i <= m; i++) {
          for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
              dp[i][j] = dp[i - 1][j - 1];
            } else {
              dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
          }
        }
        const dist = dp[m][n];
        if (dist < minDistance && dist <= 4) {
          minDistance = dist;
          closestSku = sku;
        }
      }
      return closestSku;
    };

    const closestMatch = findClosestSku();

    if (hasInvalidChars) {
      return {
        status: 'malformed',
        isError: true,
        message: 'Malformed SKU: Invalid characters detected. Use alphanumeric codes with hyphens.',
        suggestion: closestMatch
      };
    }

    return {
      status: 'not_found',
      isError: true,
      message: `Non-existent SKU code "${raw.toUpperCase()}". No inventory item matches this identifier.`,
      suggestion: closestMatch
    };
  }, [skuSearchQuery, exactSkuProduct, isSafeModeEnabled, searchedSkuSafety, products, availableSkus]);

  // Export currently filtered SKU inventory list as CSV
  const handleBulkInventoryUpdate = () => {
    const ids = filteredProducts.map(p => p.id);
    if (ids.length === 0) {
      addAlert('warning', 'No Products Selected', 'Please clear filters or ensure products are visible before bulk updating.');
      return;
    }
    setAdminSelectedProductIds(ids);
    setAdminActiveTab('batch');
    setIsAdminOpen(true);
  };

  const exportFilteredSkusToCsv = () => {
    if (filteredProducts.length === 0) {
      addAlert('warning', 'No Items to Export', 'There are no products matching the current filter criteria to export.');
      return;
    }

    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Warehouse Hub',
      'Available Stock (Units)',
      'Reserved Units',
      'Low Stock Alert Level',
      'Stock Status',
      'Unit Price (USD)',
      'Total Inventory Valuation (USD)',
      'Rating',
      'Reviews Count',
      'Warranty'
    ];

    const escapeCsv = (val: string | number | undefined | null) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredProducts.map((p) => {
      const stockStatus =
        p.stock <= 0
          ? 'Out of Stock'
          : p.stock <= (p.lowStockThreshold || 5)
          ? 'Low Stock Alert'
          : 'Optimal Inventory';
      const invValue = (p.price * p.stock).toFixed(2);

      return [
        escapeCsv(p.sku),
        escapeCsv(p.name),
        escapeCsv(p.category.toUpperCase()),
        escapeCsv(p.warehouse),
        escapeCsv(p.stock),
        escapeCsv(p.reserved || 0),
        escapeCsv(p.lowStockThreshold || 5),
        escapeCsv(stockStatus),
        escapeCsv(p.price.toFixed(2)),
        escapeCsv(invValue),
        escapeCsv(p.rating),
        escapeCsv(p.reviewCount),
        escapeCsv(p.warranty)
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    const filterTag = skuSearchQuery.trim()
      ? `-sku-${skuSearchQuery.trim().toUpperCase()}`
      : selectedCategory !== 'all'
      ? `-${selectedCategory}`
      : '';
    const filename = `warehouse-sku-inventory${filterTag}-${dateStr}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    addAlert(
      'success',
      'SKU Inventory CSV Exported',
      `Exported ${filteredProducts.length} inventory items (${filename}) for warehouse management.`
    );
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Live Ticker */}
      <LiveTickerBar />

      {/* Main Navigation Bar */}
      <Navbar />

      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-neutral-800 bg-radial-[at_top] from-neutral-900 via-neutral-950 to-neutral-950 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-Time Inventory Stream Active</span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-300 font-mono">{metrics.unitsInStock} Units Available</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise Audio & Computing Hardware.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl">
              Equipped with tokenized payment authorization and millisecond-accurate stock telemetry. Every SKU reflects authoritative warehouse inventory in real time.
            </p>

            {/* Quick Live Telemetry Pills */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>PCI-DSS Level 1 Vault Gateway</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                <Server className="w-4 h-4 text-sky-400" />
                <span>Atomic Server-Authoritative Holds</span>
              </div>
              <button
                onClick={() => setIsAdminOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium transition-colors"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Simulate Live Stock Drop</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Predictive Insights Dashboard Widget */}
        <PredictiveInsightsWidget
          products={products}
          orders={orders}
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => setSelectedCategory(catId)}
          onOpenBatchRestock={(productIds) => {
            setAdminSelectedProductIds(productIds);
            setAdminActiveTab('batch');
            setIsAdminOpen(true);
          }}
          onOpenAdminModal={() => {
            setAdminActiveTab('batch');
            setIsAdminOpen(true);
          }}
        />

        {/* Warehouse Inventory Distribution Dashboard Section */}
        <WarehouseInventoryChart />

        {/* Controls and Filters Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Catalog Inventory</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                {filteredProducts.length} items
              </span>
              {skuSearchQuery.trim() && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 font-semibold">
                  <ScanBarcode className="w-3 h-3 text-sky-400" />
                  SKU Search Active
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Available across East Coast, West Coast, and Midwest hubs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Dedicated Warehouse SKU Code Search Input with Visual Error & Validation State */}
            <div className="relative flex items-center">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-all shadow-inner relative z-10 ${
                  skuValidationStatus.isError
                    ? 'bg-rose-950/40 border-2 border-rose-500 shadow-rose-500/20 ring-2 ring-rose-500/30 text-rose-200'
                    : isSafeModeEnabled && safeModeSuppressedProducts.length > 0
                    ? 'bg-amber-950/30 border-2 border-amber-500/80 shadow-amber-500/20 ring-2 ring-amber-500/30 text-amber-200'
                    : exactSkuProduct
                    ? 'bg-emerald-950/30 border border-emerald-500/80 shadow-emerald-500/20 ring-1 ring-emerald-500/40 text-emerald-200'
                    : skuSearchQuery.trim()
                    ? 'border-sky-500/70 ring-1 ring-sky-500/30 text-white bg-neutral-900'
                    : 'border-neutral-800 focus-within:border-sky-500/60 text-neutral-300 bg-neutral-900'
                }`}
              >
                {skuValidationStatus.isError ? (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 animate-pulse" />
                ) : isSafeModeEnabled && safeModeSuppressedProducts.length > 0 ? (
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" />
                ) : (
                  <ScanBarcode
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      exactSkuProduct
                        ? 'text-emerald-400'
                        : skuSearchQuery.trim()
                        ? 'text-sky-400'
                        : 'text-neutral-400'
                    }`}
                  />
                )}

                <input
                  id="sku-search-input"
                  type="text"
                  value={skuSearchQuery}
                  onChange={(e) => setSkuSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && skuSearchQuery.trim()) {
                      if (!skuValidationStatus.isError) {
                        trackSkuSearch(skuSearchQuery);
                      }
                      setIsSkuInputFocused(false);
                      const inputElement = document.getElementById('sku-search-input');
                      if (inputElement) inputElement.blur();
                    } else if (e.key === 'Tab' && skuValidationStatus.isError && skuValidationStatus.suggestion) {
                      e.preventDefault();
                      setSkuSearchQuery(skuValidationStatus.suggestion);
                      trackSkuSearch(skuValidationStatus.suggestion);
                    }
                  }}
                  onFocus={() => setIsSkuInputFocused(true)}
                  onBlur={() => setTimeout(() => setIsSkuInputFocused(false), 200)}
                  placeholder="Search SKU (e.g. AUD-REF-8040)..."
                  className={`bg-transparent text-xs placeholder:text-neutral-500 focus:outline-none font-mono uppercase w-36 sm:w-48 tracking-wider ${
                    skuValidationStatus.isError
                      ? 'text-rose-200 placeholder:text-rose-400/50'
                      : exactSkuProduct
                      ? 'text-emerald-200'
                      : 'text-white'
                  }`}
                  title="Warehouse SKU Search: Filter catalog specifically by full product SKU code"
                  aria-label="Search by SKU code"
                  aria-invalid={skuValidationStatus.isError}
                  autoComplete="off"
                />

                {/* Clear input button */}
                {skuSearchQuery && (
                  <button
                    id="sku-search-clear-btn"
                    onClick={() => setSkuSearchQuery('')}
                    className={`p-0.5 rounded transition-colors ml-0.5 cursor-pointer ${
                      skuValidationStatus.isError
                        ? 'text-rose-400 hover:text-white hover:bg-rose-900/50'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                    title="Clear SKU search"
                    aria-label="Clear SKU search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Voice Dictation (Web Speech API) */}
                <VoiceDictationButton
                  id="storefront-sku-voice-dictation-btn"
                  onTranscript={(text) => {
                    setSkuSearchQuery(text);
                    trackSkuSearch(text);
                  }}
                  title="Dictate SKU code hands-free (Web Speech API)"
                  className="ml-0.5"
                />

                {/* 'Scan SKU' button in the SKU search input field */}
                <button
                  id="sku-search-scan-btn"
                  type="button"
                  onClick={() => setIsSkuScannerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sky-400 hover:text-sky-300 font-semibold text-[11px] border border-neutral-700/80 transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-sm ml-0.5"
                  title="Scan SKU barcode or QR code with camera"
                  aria-label="Scan SKU barcode or QR code with camera"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>Scan</span>
                </button>

                {exactSkuProduct && (
                  <button
                    id="sku-quick-restock-btn"
                    onClick={() => {
                      setSkuAdjustProduct(exactSkuProduct);
                      setIsAdminOpen(true);
                    }}
                    className="ml-1 px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Quick Restock</span>
                  </button>
                )}
              </div>

              {/* Visual Error Callout / Typo Catching Banner */}
              {skuValidationStatus.isError && (
                <div
                  id="sku-search-error-state"
                  className="absolute top-full left-0 mt-1.5 z-40 w-72 sm:w-84 p-2.5 rounded-xl bg-neutral-900 border border-rose-500/60 shadow-xl shadow-rose-950/40 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-rose-300 text-[11px] uppercase tracking-wider">
                          {skuValidationStatus.status === 'malformed' ? 'Malformed SKU Code' : 'SKU Not Found'}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                          TYPO DETECTED
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 mt-1 leading-snug">
                        {skuValidationStatus.message}
                      </p>

                      {/* Intelligent Did-You-Mean Typo Suggestion */}
                      {skuValidationStatus.suggestion && (
                        <div className="mt-2 pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-neutral-400">
                            Did you mean <strong className="text-sky-300 font-mono">{skuValidationStatus.suggestion}</strong>?
                          </span>
                          <button
                            id="sku-error-apply-suggestion-btn"
                            type="button"
                            onClick={() => {
                              if (skuValidationStatus.suggestion) {
                                setSkuSearchQuery(skuValidationStatus.suggestion);
                                trackSkuSearch(skuValidationStatus.suggestion);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            <span>Apply</span>
                            <CornerDownLeft className="w-3 h-3 text-sky-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Safe Mode Intercept Callout Popover (when SKU has quarantine/damage audit records) */}
              {isSafeModeEnabled && safeModeSuppressedProducts.length > 0 && !skuValidationStatus.isError && (
                <div
                  id="sku-safe-mode-callout-popover"
                  className="absolute top-full left-0 mt-1.5 z-40 w-80 sm:w-96 p-3 rounded-xl bg-neutral-900 border border-amber-500/60 shadow-2xl shadow-amber-950/60 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
                  role="alert"
                >
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-amber-300 text-[11px] uppercase tracking-wider">
                          Safe Mode Intercept Active
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                          {safeModeSuppressedProducts[0].safety.statusLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 mt-1 leading-snug">
                        Cross-referenced warehouse audit log: <strong className="text-white font-mono">{safeModeSuppressedProducts[0].product.sku}</strong> is withheld from search results to prevent distribution of quarantined or damaged goods.
                      </p>

                      {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry && (
                        <div className="mt-2 p-2 rounded-lg bg-neutral-950/90 border border-neutral-800 text-[10px] font-mono text-neutral-400 space-y-1.5">
                          <div className="flex items-center justify-between gap-1.5 border-b border-neutral-800/80 pb-1.5">
                            <span className="text-neutral-300 font-medium truncate flex items-center gap-1">
                              <FileText className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>Audit Record ID: <strong className="text-white font-mono">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id}</strong></span>
                            </span>
                            <button
                              id="copy-callout-audit-id-btn"
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyAuditId(safeModeSuppressedProducts[0].safety.primaryFlaggedEntry!.id);
                              }}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border shrink-0 ${
                                copiedAuditId === safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id
                                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                                  : 'bg-neutral-850 hover:bg-neutral-800 text-sky-300 hover:text-white border-neutral-700/80 active:scale-95'
                              }`}
                              title={`Copy Audit Record ID ${safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id} to clipboard`}
                              aria-label={`Copy Audit Record ID ${safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id}`}
                            >
                              {copiedAuditId === safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id ? (
                                <>
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                  <span className="text-emerald-300 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-2.5 h-2.5 text-sky-400" />
                                  <span>Copy ID</span>
                                </>
                              )}
                            </button>
                          </div>
                          <div className="text-amber-200/90 font-medium truncate">
                            Reason: {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.reason}
                          </div>
                          <div className="truncate">
                            Auditor: {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.operatorId} • {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.warehouse}
                          </div>
                        </div>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                        <button
                          id="safe-mode-callout-view-audit-btn"
                          type="button"
                          onClick={() => setSafeModeAuditSku(safeModeSuppressedProducts[0].product.sku)}
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                        >
                          <FileText className="w-3 h-3 text-sky-400" />
                          <span>View Audit Trail</span>
                        </button>
                        <button
                          id="safe-mode-callout-disable-btn"
                          type="button"
                          onClick={() => {
                            setIsSafeModeEnabled(false);
                            addAlert('warning', 'Safe Mode Deactivated', 'Quarantine and damage audit filtering disabled. All items are now displayed.');
                          }}
                          className="text-[10px] text-neutral-400 hover:text-white underline cursor-pointer"
                        >
                          Disable Safe Mode
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* SKU Predictive Autocomplete Dropdown (when not in full error) */}
              {isSkuInputFocused && (!exactSkuProduct) && !skuValidationStatus.isError && (skuSuggestions.length > 0 || trendingSkuSearches.length > 0) && (
                <div className="absolute top-full left-0 w-full mt-1.5 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-xl z-50 overflow-hidden min-w-max">
                  {skuSearchQuery.trim() && skuSuggestions.length > 0 ? (
                    <div className="divide-y divide-neutral-800/50">
                      {skuSuggestions.map((sku, index) => {
                        const prod = products.find(p => p.sku === sku);
                        if (!prod) return null;
                        const safety = isSafeModeEnabled ? checkSkuSafety(sku) : null;
                        const isFlagged = safety && !safety.isSafe;

                        return (
                          <button
                            key={sku}
                            onClick={() => {
                              setSkuSearchQuery(sku);
                              trackSkuSearch(sku);
                              setIsSkuInputFocused(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 hover:bg-neutral-800 focus:bg-neutral-800 transition-colors flex items-center justify-between group ${
                              isFlagged ? 'bg-amber-950/20' : ''
                            }`}
                          >
                            <div className="flex flex-col min-w-0 pr-3">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-mono font-medium ${isFlagged ? 'text-amber-300' : 'text-sky-400 group-hover:text-sky-300'}`}>
                                  {sku}
                                </span>
                                {isFlagged && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                                    <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                                    <span>{safety.statusLabel}</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-neutral-400 truncate">
                                {prod.name}
                              </span>
                            </div>
                            {prod.stock <= prod.lowStockThreshold && (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  {trendingSkuSearches.length > 0 && !skuSearchQuery.trim() && (
                    <div className="p-2 bg-neutral-950/50">
                      <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2 px-1">Trending Searches</div>
                      <div className="flex flex-wrap gap-1.5">
                        {trendingSkuSearches.map(trend => (
                          <button
                            key={trend.query}
                            onClick={() => {
                              setSkuSearchQuery(trend.query);
                              trackSkuSearch(trend.query);
                              setIsSkuInputFocused(false);
                            }}
                            className="px-2 py-1 rounded bg-neutral-800/50 hover:bg-neutral-700 border border-neutral-700/50 text-[11px] font-mono text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <span>{trend.query}</span>
                            <span className="text-[9px] text-neutral-500 bg-neutral-900 px-1 rounded-sm">{trend.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {exactSkuProduct && isSafeModeEnabled && searchedSkuSafety && !searchedSkuSafety.isSafe ? (
                <button
                  id="quarantined-sku-match-badge"
                  type="button"
                  onClick={() => setSafeModeAuditSku(exactSkuProduct.sku)}
                  title={`Flagged in warehouse audit log: ${searchedSkuSafety.statusLabel} - Click to inspect audit trail`}
                  aria-label={`View audit log for quarantined SKU ${exactSkuProduct.sku}`}
                  className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-xl border ml-2 whitespace-nowrap transition-all duration-150 cursor-pointer shadow-sm active:scale-95 bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-500/30"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 stroke-[2.5] animate-pulse" />
                  <span className="font-semibold text-amber-300">{searchedSkuSafety.statusLabel}: {exactSkuProduct.sku}</span>
                </button>
              ) : exactSkuProduct ? (
                <button
                  id="verified-sku-match-badge"
                  type="button"
                  onClick={() => handleCopySku(exactSkuProduct.sku, exactSkuProduct.name)}
                  title={`Exact match: ${exactSkuProduct.name} - Click to copy SKU (${exactSkuProduct.sku}) to clipboard`}
                  aria-label={`Copy verified SKU ${exactSkuProduct.sku} to clipboard`}
                  className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1.5 rounded-xl border ml-2 whitespace-nowrap transition-all duration-150 cursor-pointer shadow-sm active:scale-95 ${
                    copiedSku === exactSkuProduct.sku
                      ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400 shadow-emerald-500/20 ring-1 ring-emerald-500/50'
                      : 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30 hover:border-sky-400/80 hover:text-white'
                  }`}
                >
                  {copiedSku === exactSkuProduct.sku ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                      <span className="font-semibold text-emerald-300">Copied {exactSkuProduct.sku}!</span>
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                      <span>
                        Verified: <strong className="font-bold">{exactSkuProduct.sku}</strong>
                      </span>
                      <Copy className="w-3 h-3 text-sky-400/90 ml-0.5" />
                    </>
                  )}
                </button>
              ) : null}
            </div>

            {/* SKU Search 'Safe Mode' Toggle */}
            <button
              id="sku-safe-mode-toggle-btn"
              type="button"
              onClick={() => {
                const nextVal = !isSafeModeEnabled;
                setIsSafeModeEnabled(nextVal);
                addAlert(
                  nextVal ? 'info' : 'warning',
                  nextVal ? 'Safe Mode Activated' : 'Safe Mode Deactivated',
                  nextVal
                    ? "SKU search is actively cross-referencing warehouse audit logs to block 'Under Quarantine' and 'Damaged' items."
                    : "Safe Mode deactivated. Search will now return inventory without quarantine/damaged audit restrictions."
                );
              }}
              title={
                isSafeModeEnabled
                  ? "Safe Mode: ACTIVE. Cross-referencing warehouse audit logs to ensure searched SKUs are not 'Under Quarantine' or 'Damaged'. Click to toggle off."
                  : "Safe Mode: OFF. Click to activate warehouse audit log quarantine & damage protection."
              }
              aria-pressed={isSafeModeEnabled}
              aria-label="Toggle SKU Search Safe Mode"
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-sm ${
                isSafeModeEnabled
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50 hover:bg-emerald-950/60 ring-1 ring-emerald-500/30 shadow-emerald-950/20'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:border-neutral-700'
              }`}
            >
              {isSafeModeEnabled ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Safe Mode</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    ON
                  </span>
                </>
              ) : (
                <>
                  <Shield className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span>Safe Mode</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-500 font-medium border border-neutral-700">
                    OFF
                  </span>
                </>
              )}
            </button>

            {/* Wishlist Only Toggle */}
            <button
              id="filter-wishlist-toggle-btn"
              onClick={() => setOnlyWishlist(!onlyWishlist)}
              className={`flex items-center gap-1.5 text-xs select-none px-3 py-2 rounded-xl border transition-all ${
                onlyWishlist
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'text-neutral-300 bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 ${
                  onlyWishlist || wishlistProductIds.length > 0 ? 'text-rose-400 fill-rose-500/40' : 'text-neutral-400'
                }`}
              />
              <span>Wishlist Only</span>
              {wishlistProductIds.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-neutral-800 text-rose-300 font-bold border border-neutral-700">
                  {wishlistProductIds.length}
                </span>
              )}
            </button>

            {/* In-Stock Only Toggle */}
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none bg-neutral-900 px-3 py-2 rounded-xl border border-neutral-800 hover:border-neutral-700">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-neutral-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-neutral-950 cursor-pointer"
              />
              <span>In Stock Only</span>
            </label>

            {/* Low-Stock Threshold Filter Toggle */}
            <button
              id="filter-low-stock-toggle-btn"
              type="button"
              onClick={() => setOnlyLowStock(!onlyLowStock)}
              title={
                onlyLowStock
                  ? 'Exclusively viewing products below low-stock threshold. Click to view all products.'
                  : `Filter catalog to exclusively view ${lowStockCount} products currently below their low-stock thresholds.`
              }
              className={`flex items-center gap-1.5 text-xs select-none px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                onlyLowStock
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/70 shadow-sm ring-1 ring-amber-500/40 font-semibold'
                  : 'text-neutral-300 bg-neutral-900 border-neutral-800 hover:border-amber-500/40 hover:text-amber-300'
              }`}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 ${
                  onlyLowStock ? 'text-amber-400 fill-amber-500/20' : 'text-neutral-400'
                }`}
              />
              <span>Low Stock Only</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold border ${
                  onlyLowStock
                    ? 'bg-amber-500/30 text-amber-200 border-amber-500/50'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                }`}
              >
                {lowStockCount}
              </span>
            </button>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs text-neutral-300 hover:border-neutral-700">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
              <select
                id="catalog-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="featured" className="bg-neutral-900 text-white">Featured Selection</option>
                <option value="price-asc" className="bg-neutral-900 text-white">Price: Low to High</option>
                <option value="price-desc" className="bg-neutral-900 text-white">Price: High to Low</option>
                <option value="stock-desc" className="bg-neutral-900 text-white">Highest Stock Units</option>
                <option value="stock-asc" className="bg-neutral-900 text-white">Low Stock Warning</option>
                <option value="rating" className="bg-neutral-900 text-white">Highest Rated</option>
              </select>
            </div>

            {/* Bulk Inventory Update */}
            <button
              id="bulk-inventory-update-btn"
              type="button"
              onClick={handleBulkInventoryUpdate}
              title={`Batch-adjust stock levels for ${filteredProducts.length} visible items`}
              className="flex items-center gap-1.5 text-xs text-neutral-200 bg-sky-600 hover:bg-sky-500 border border-sky-500/50 hover:text-white px-3 py-2 rounded-xl transition-all shadow-xs shadow-sky-500/20 cursor-pointer group"
            >
              <Layers className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap text-white">Bulk Update</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-sky-700 text-white font-semibold border border-sky-600">
                {filteredProducts.length}
              </span>
            </button>

            {/* Export Filtered SKUs to CSV */}
            <button
              id="export-filtered-skus-btn"
              type="button"
              onClick={exportFilteredSkusToCsv}
              title={`Export ${filteredProducts.length} filtered inventory items as CSV`}
              className="flex items-center gap-1.5 text-xs text-neutral-200 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-sky-500/60 hover:text-white px-3 py-2 rounded-xl transition-all shadow-xs cursor-pointer group"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-medium whitespace-nowrap">Export CSV</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded-md bg-neutral-800 text-sky-300 font-semibold border border-neutral-700">
                {filteredProducts.length}
              </span>
            </button>
          </div>
        </div>

        {/* Quick SKU Code Lookup Chips Bar for Warehouse Personnel */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6 p-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-neutral-400 font-mono flex items-center gap-1 mr-1">
              <Barcode className="w-3.5 h-3.5 text-sky-400" />
              Warehouse SKUs:
            </span>
            {availableSkus.map((sku, index) => {
              const isSelected = skuSearchQuery.trim().toUpperCase() === sku.toUpperCase();
              const safety = isSafeModeEnabled ? checkSkuSafety(sku) : null;
              const isFlagged = safety && !safety.isSafe;

              return (
                <button
                  key={sku}
                  id={`sku-chip-${sku}`}
                  onClick={() => setSkuSearchQuery(isSelected ? '' : sku)}
                  title={
                    isSelected
                      ? `Clear SKU filter ${sku}`
                      : isFlagged
                      ? `[SAFE MODE] Flagged in audit log: ${safety?.statusLabel || 'Flagged'}`
                      : `Filter catalog specifically for SKU ${sku}`
                  }
                  className={`font-mono text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-sky-500/25 text-sky-300 border-sky-400/80 font-bold shadow-xs ring-1 ring-sky-500/30'
                      : isFlagged
                      ? 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:border-amber-400/70 hover:bg-amber-900/40'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {isFlagged && <ShieldAlert className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                  <span>{sku}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {onlyLowStock && (
              <span
                id="active-low-stock-filter-chip"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-mono"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Low Stock Filter Active</span>
                <button
                  id="active-low-stock-clear-btn"
                  onClick={() => setOnlyLowStock(false)}
                  className="hover:text-white ml-0.5 p-0.5 rounded hover:bg-amber-500/30 transition-colors cursor-pointer"
                  title="Disable low-stock filter"
                  aria-label="Disable low-stock filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              id="quick-export-skus-csv-btn"
              onClick={exportFilteredSkusToCsv}
              className="text-[11px] text-neutral-400 hover:text-sky-300 flex items-center gap-1 font-mono transition-colors hover:underline cursor-pointer"
              title="Download CSV for currently visible SKU list"
            >
              <Download className="w-3 h-3 text-sky-400" />
              <span>Export CSV ({filteredProducts.length})</span>
            </button>

            {skuSearchQuery.trim() && (
              <button
                id="clear-all-sku-filter-btn"
                onClick={() => setSkuSearchQuery('')}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-mono transition-colors hover:underline cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset SKU Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* Safe Mode Quarantine / Damaged Intercept Banner */}
        {isSafeModeEnabled && safeModeSuppressedProducts.length > 0 && (
          <div
            id="sku-safe-mode-intercept-alert"
            className="mb-6 p-4 sm:p-5 rounded-2xl bg-amber-950/30 border-2 border-amber-500/80 shadow-xl shadow-amber-950/40 text-amber-200 animate-in fade-in slide-in-from-top-2 duration-200"
            role="alert"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-400 shrink-0 mt-0.5 shadow-sm">
                  <ShieldAlert className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm sm:text-base text-white tracking-tight flex items-center gap-2">
                      <span>Safe Mode Intercept</span>
                      <span className="text-neutral-500 font-normal">|</span>
                      <span className="text-amber-400 font-mono text-xs uppercase tracking-wider">
                        {safeModeSuppressedProducts.length} Item{safeModeSuppressedProducts.length > 1 ? 's' : ''} Flagged in Warehouse Audit Log
                      </span>
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {safeModeSuppressedProducts[0].safety.statusLabel}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed max-w-3xl">
                    In compliance with warehouse audit integrity, SKU search results have withheld{' '}
                    <strong className="text-white font-mono">{safeModeSuppressedProducts.map(p => p.product.sku).join(', ')}</strong>.
                    The warehouse audit log records this inventory as{' '}
                    <strong className="text-amber-300">"{safeModeSuppressedProducts[0].safety.statusLabel}"</strong>, preventing accidental customer order allocation or release of quarantined stock.
                  </p>

                  {/* Audit trail summary card */}
                  {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry && (
                    <div className="mt-3 p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs text-neutral-300 space-y-2 font-mono">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-400 text-[11px] flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-sky-400" />
                            Audit Record ID: <strong className="text-neutral-200 font-mono">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id}</strong>
                          </span>
                          <button
                            id="copy-intercept-banner-audit-id-btn"
                            type="button"
                            onClick={() => handleCopyAuditId(safeModeSuppressedProducts[0].safety.primaryFlaggedEntry!.id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer border active:scale-95 shadow-2xs ${
                              copiedAuditId === safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id
                                ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50'
                                : 'bg-neutral-800 hover:bg-neutral-700 text-sky-300 hover:text-white border-neutral-700'
                            }`}
                            title={`Copy Audit Record ID ${safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id} to clipboard`}
                            aria-label={`Copy Audit Record ID ${safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id}`}
                          >
                            {copiedAuditId === safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-300 font-bold">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-sky-400" />
                                <span>Copy ID</span>
                              </>
                            )}
                          </button>
                        </div>
                        <span className="text-neutral-400 text-[11px]">
                          Logged: <span className="text-neutral-200">{new Date(safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.timestamp).toLocaleString()}</span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-neutral-500">Flagged Reason: </span>
                          <span className="text-rose-300 font-semibold">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.reason}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Facility / Hub: </span>
                          <span className="text-neutral-200">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.warehouse}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Inspector / Auditor: </span>
                          <span className="text-sky-300">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.operatorId} ({safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.operatorName || 'Auditor'})</span>
                        </div>
                        <div>
                          <span className="text-neutral-500">Batch Number: </span>
                          <span className="text-neutral-200">{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.batchNumber || 'N/A'}</span>
                        </div>
                      </div>

                      {safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.notes && (
                        <div className="pt-1.5 border-t border-neutral-800/80 text-[11px] text-neutral-400 italic">
                          "{safeModeSuppressedProducts[0].safety.primaryFlaggedEntry.notes}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-row md:flex-col gap-2 shrink-0 pt-2 md:pt-0">
                <button
                  id="safe-mode-view-audit-btn"
                  type="button"
                  onClick={() => setSafeModeAuditSku(safeModeSuppressedProducts[0].product.sku)}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-semibold transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Open complete immutable audit trail for this SKU"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-400" />
                  <span>View Full Audit Trail</span>
                </button>

                <button
                  id="safe-mode-override-btn"
                  type="button"
                  onClick={() => {
                    setIsSafeModeEnabled(false);
                    addAlert('warning', 'Safe Mode Temporarily Disabled', 'Quarantine and damage audit filtering disabled. All items are now displayed.');
                  }}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-semibold transition-all cursor-pointer"
                  title="Disable Safe Mode to override quarantine filter"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Disable Safe Mode</span>
                </button>

                <button
                  id="safe-mode-clear-search-btn"
                  type="button"
                  onClick={() => setSkuSearchQuery('')}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-transparent hover:bg-neutral-900/60 text-neutral-400 hover:text-white text-xs transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Search</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Safe Mode Clean Verification Banner */}
        {isSafeModeEnabled && exactSkuProduct && searchedSkuSafety && searchedSkuSafety.isSafe && (
          <div
            id="sku-safe-mode-verified-banner"
            className="mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-950/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Safe Mode Audit Verified: <strong className="font-mono text-white">{exactSkuProduct.sku}</strong> passed cross-reference check (0 quarantine or damage records). Ready for order fulfillment.
              </span>
            </div>
            <button
              onClick={() => setSafeModeAuditSku(exactSkuProduct.sku)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer shrink-0"
            >
              Inspect Log
            </button>
          </div>
        )}

        {/* Safe Mode OFF Warning Banner */}
        {!isSafeModeEnabled && exactSkuProduct && searchedSkuSafety && !searchedSkuSafety.isSafe && (
          <div
            id="sku-safe-mode-disabled-warning-banner"
            className="mb-4 px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Safe Mode is <strong>OFF</strong>. Caution: <strong className="font-mono text-white">{exactSkuProduct.sku}</strong> has audit flags ({searchedSkuSafety.statusLabel}).
              </span>
            </div>
            <button
              onClick={() => {
                setIsSafeModeEnabled(true);
                addAlert('info', 'Safe Mode Activated', 'Quarantine and damage audit filtering re-enabled.');
              }}
              className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors cursor-pointer shrink-0"
            >
              Enable Safe Mode
            </button>
          </div>
        )}

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          isSafeModeEnabled && safeModeSuppressedProducts.length > 0 ? (
            <div className="py-16 text-center space-y-3 bg-amber-950/15 rounded-2xl border-2 border-amber-500/40 p-6">
              <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
              <h3 className="text-base font-bold text-white">Safe Mode Active: Results Withheld</h3>
              <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                Inventory matching <strong className="font-mono text-amber-300">{skuSearchQuery.toUpperCase()}</strong> was verified against warehouse audit logs and flagged as <strong className="text-amber-300">"{safeModeSuppressedProducts[0].safety.statusLabel}"</strong>. Results are withheld to protect warehouse dispatch compliance.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  id="empty-state-view-audit-btn"
                  onClick={() => setSafeModeAuditSku(safeModeSuppressedProducts[0].product.sku)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Audit Trail</span>
                </button>
                <button
                  id="empty-state-disable-safe-mode-btn"
                  onClick={() => {
                    setIsSafeModeEnabled(false);
                    addAlert('warning', 'Safe Mode Deactivated', 'Quarantine filtering disabled.');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Disable Safe Mode (Supervisor Override)</span>
                </button>
                <button
                  id="empty-state-clear-sku-btn"
                  onClick={() => setSkuSearchQuery('')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear Search</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center space-y-3 bg-neutral-900/30 rounded-2xl border border-neutral-800">
              <Filter className="w-10 h-10 text-neutral-600 mx-auto stroke-1" />
              <h3 className="text-base font-semibold text-neutral-200">No matching products found</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {onlyLowStock
                  ? 'No products are currently at or below their low-stock thresholds in this filtered view.'
                  : skuSearchQuery.trim()
                  ? `No inventory items matched SKU "${skuSearchQuery.toUpperCase()}". Verify the SKU formatting or clear the SKU search.`
                  : 'Try resetting your search query or selecting "All Catalog" to view all hardware.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {onlyLowStock && (
                  <button
                    id="empty-state-clear-low-stock-btn"
                    onClick={() => setOnlyLowStock(false)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-colors cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Disable Low-Stock Filter</span>
                  </button>
                )}
                {skuSearchQuery.trim() && (
                  <button
                    id="empty-state-clear-sku-btn"
                    onClick={() => setSkuSearchQuery('')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-semibold hover:bg-sky-500/30 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Clear SKU Search ({skuSearchQuery.toUpperCase()})</span>
                  </button>
                )}
              </div>
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Security & Infrastructure Pillar Section */}
        <section className="mt-16 sm:mt-24 pt-12 border-t border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Bank-Grade Payment Vault</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Card numbers are tokenized client-side and verified via Luhn algorithm and 3D-Secure 2.0. No raw financial data is ever retained in memory.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Authoritative Inventory Locks</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Atomic database reservations prevent overselling during flash sales. As stock decrements, live WebSocket feeds update all connected shoppers instantly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Automated Warehouse Routing</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Orders are mapped to the nearest logistics hub (Newark, Bay Area, Midwest) with live consignment barcode tracking from packing through delivery.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Newsletter */}
      <NewsletterSubscription />

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950 py-10 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white tracking-tight">OMNISTORE PRO</span>
            <span className="text-neutral-600">|</span>
            <span>PCI-DSS Level 1 Compliant Enterprise Commerce Engine</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
            <span>•</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-white transition-colors underline decoration-dotted"
            >
              Open Live Warehouse Console
            </button>
          </div>
        </div>
      </footer>

      {/* Overlays & Modals */}
      <UserProfileModal />
      <ScannerModal
        isOpen={isSkuScannerOpen}
        onClose={() => setIsSkuScannerOpen(false)}
        onScan={handleSkuScanned}
        products={products}
      />
      <SkuAuditLogModal
        isOpen={!!safeModeAuditSku}
        onClose={() => setSafeModeAuditSku(null)}
        sku={safeModeAuditSku || undefined}
      />
      <ProductDetailModal />
      <ProductQrCodeModal />
      <InventoryAlertModal />
      <CartDrawer />
      <CheckoutModal />
      <WarehouseAdminModal />
      <OrderTrackingModal />
      <OrderHistoryModal />
      <ProductComparisonModal />
      <ComparisonBar />
      <NotificationToasts />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <StorefrontContent />
    </StoreProvider>
  );
}
