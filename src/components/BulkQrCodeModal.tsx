import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  QrCode,
  Printer,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  Layers,
  MapPin,
  Boxes,
  Barcode,
  CheckSquare,
  Square,
  Sparkles,
  ExternalLink,
  Tag,
  Grid,
  Maximize2,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { Product } from '../types';
import { VoiceDictationButton } from './VoiceDictationButton';

export interface BulkQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  selectedProductIds?: string[];
  initialCategory?: string;
  initialWarehouse?: string;
  initialSearch?: string;
  title?: string;
}

export type LabelSize = 'standard' | 'compact' | 'industrial';
export type LabelPayloadFormat = 'sku' | 'url' | 'json';

export const BulkQrCodeModal: React.FC<BulkQrCodeModalProps> = ({
  isOpen,
  onClose,
  products,
  selectedProductIds: externalSelectedIds,
  initialCategory = 'all',
  initialWarehouse = 'all',
  initialSearch = '',
  title = 'Bulk SKU QR Code Generator & Label Print Hub'
}) => {
  // Filtering states inside the modal
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState(initialCategory);
  const [warehouseFilter, setWarehouseFilter] = useState(initialWarehouse);
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

  // Label formatting preferences
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [payloadFormat, setPayloadFormat] = useState<LabelPayloadFormat>('sku');
  const [includeBarcode, setIncludeBarcode] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [includeWarehouse, setIncludeWarehouse] = useState(true);
  const [includeBinLocation, setIncludeBinLocation] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedSku, setCopiedSku] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Extract unique categories & warehouses
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set)];
  }, [products]);

  const warehouses = useMemo(() => {
    const set = new Set(products.map(p => p.warehouse.split('(')[0].trim()));
    return ['all', ...Array.from(set)];
  }, [products]);

  // Filtered products in current view
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Category match
      if (categoryFilter !== 'all' && product.category !== categoryFilter) {
        return false;
      }
      // Warehouse match
      if (warehouseFilter !== 'all' && !product.warehouse.toLowerCase().includes(warehouseFilter.toLowerCase())) {
        return false;
      }
      // Stock status match
      if (stockStatusFilter === 'in_stock' && product.stock <= 0) return false;
      if (stockStatusFilter === 'low_stock' && (product.stock <= 0 || product.stock > product.lowStockThreshold)) return false;
      if (stockStatusFilter === 'out_of_stock' && product.stock > 0) return false;

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = product.name.toLowerCase().includes(q);
        const matchesSku = product.sku.toLowerCase().includes(q);
        const matchesCategory = product.category.toLowerCase().includes(q);
        const matchesWarehouse = product.warehouse.toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCategory && !matchesWarehouse) {
          return false;
        }
      }
      return true;
    });
  }, [products, categoryFilter, warehouseFilter, stockStatusFilter, searchQuery]);

  // Initial selection initialization when opened or filtered view changes
  useEffect(() => {
    if (isOpen) {
      if (externalSelectedIds && externalSelectedIds.length > 0) {
        // Pre-select items passed from warehouse admin
        setSelectedIds(externalSelectedIds);
      } else {
        // Default to all products in current filtered view
        setSelectedIds(filteredProducts.map(p => p.id));
      }
    }
  }, [isOpen, externalSelectedIds]);

  // Active items selected for QR generation
  const activeProducts = useMemo(() => {
    return filteredProducts.filter(p => selectedIds.includes(p.id));
  }, [filteredProducts, selectedIds]);

  // Generate QR Code data URLs for active products
  useEffect(() => {
    if (!isOpen || activeProducts.length === 0) {
      setQrCodeUrls({});
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    const generateBatch = async () => {
      const generated: Record<string, string> = {};
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

      for (const prod of activeProducts) {
        let payload = prod.sku;
        if (payloadFormat === 'url') {
          payload = `${origin}${pathname}?product=${encodeURIComponent(prod.id)}#${encodeURIComponent(prod.sku)}`;
        } else if (payloadFormat === 'json') {
          payload = JSON.stringify({
            sku: prod.sku,
            id: prod.id,
            name: prod.name,
            price: prod.price,
            wh: prod.warehouse.split('(')[0].trim()
          });
        }

        try {
          const url = await QRCode.toDataURL(payload, {
            width: labelSize === 'compact' ? 180 : labelSize === 'industrial' ? 320 : 240,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: {
              dark: '#0a0a0a',
              light: '#ffffff'
            }
          });
          generated[prod.id] = url;
        } catch (err) {
          console.error(`Failed to generate QR for ${prod.sku}:`, err);
        }
      }

      if (isMounted) {
        setQrCodeUrls(generated);
        setIsGenerating(false);
      }
    };

    generateBatch();

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeProducts, payloadFormat, labelSize]);

  // Select all / Deselect all handlers
  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredProducts.map(p => p.id);
    setSelectedIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const handleDeselectAllFiltered = () => {
    const allFilteredIds = new Set(filteredProducts.map(p => p.id));
    setSelectedIds(prev => prev.filter(id => !allFilteredIds.has(id)));
  };

  const toggleSelectProduct = (productId: string) => {
    setSelectedIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  };

  // Pseudo-deterministic warehouse storage bin derived from SKU
  const getBinLocation = (sku: string) => {
    const hash = sku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const aisle = String.fromCharCode(65 + (hash % 8)); // A-H
    const rack = ((hash % 14) + 1).toString().padStart(2, '0'); // 01-14
    const shelf = ((hash % 4) + 1); // 1-4
    const bin = ((hash % 6) + 1); // 1-6
    return `BAY-${aisle}${rack}-${shelf}B${bin}`;
  };

  // Copy single SKU
  const handleCopySku = (sku: string) => {
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedSku(sku);
      setTimeout(() => setCopiedSku(null), 2000);
    });
  };

  // Print Labels layout generator
  const handlePrintLabels = () => {
    if (activeProducts.length === 0) return;
    setIsPrinting(true);

    const gridColumns = labelSize === 'compact' ? 4 : labelSize === 'industrial' ? 2 : 3;

    const labelsHtml = activeProducts.map((p) => {
      const qrDataUrl = qrCodeUrls[p.id] || '';
      const bin = getBinLocation(p.sku);
      const whName = p.warehouse.split('(')[0].trim();

      return `
        <div class="label ${labelSize}">
          <div class="label-header">
            <span class="brand-tag">OMNISTORE FULFILLMENT</span>
            <span class="stock-pill">${p.stock} In Stock</span>
          </div>

          <div class="qr-container">
            ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code for ${p.sku}" />` : `<div class="qr-placeholder">${p.sku}</div>`}
          </div>

          <div class="sku-code">${p.sku}</div>
          <div class="product-name">${p.name}</div>

          <div class="label-meta">
            ${includeWarehouse ? `<div class="meta-item"><span class="meta-label">HUB:</span> ${whName}</div>` : ''}
            ${includeBinLocation ? `<div class="meta-item"><span class="meta-label">LOC:</span> ${bin}</div>` : ''}
            ${includePrice ? `<div class="meta-item meta-price">$${p.price.toFixed(2)}</div>` : ''}
          </div>

          ${
            includeBarcode
              ? `
            <div class="barcode-simulation">
              <div class="barcode-bars"></div>
              <div class="barcode-text">*${p.sku}*</div>
            </div>
          `
              : ''
          }
        </div>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Warehouse Inventory SKU Labels (${activeProducts.length} Items) - ${new Date().toLocaleDateString()}</title>
          <style>
            @page {
              size: auto;
              margin: 0.35in;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 15px;
              background: #ffffff;
              color: #111111;
            }
            .header-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #000;
              padding-bottom: 8px;
              margin-bottom: 16px;
            }
            .header-title {
              font-size: 16px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-date {
              font-size: 11px;
              font-family: monospace;
              color: #555;
            }
            .label-grid {
              display: grid;
              grid-template-columns: repeat(${gridColumns}, 1fr);
              gap: 12px;
            }
            .label {
              border: 1.5px solid #000;
              border-radius: 6px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              text-align: center;
              background: #fff;
              page-break-inside: avoid;
              position: relative;
            }
            .label.compact {
              padding: 6px;
              font-size: 11px;
            }
            .label.industrial {
              padding: 16px;
              border-width: 2px;
            }
            .label-header {
              display: flex;
              justify-content: space-between;
              width: 100%;
              font-size: 8px;
              font-family: monospace;
              font-weight: 700;
              color: #666;
              border-bottom: 1px dashed #ccc;
              padding-bottom: 4px;
              margin-bottom: 6px;
            }
            .stock-pill {
              background: #000;
              color: #fff;
              padding: 1px 4px;
              border-radius: 3px;
            }
            .qr-container {
              margin: 4px 0;
              display: flex;
              justify-content: center;
            }
            .label.compact .qr-container img {
              width: 80px;
              height: 80px;
            }
            .label.standard .qr-container img {
              width: 110px;
              height: 110px;
            }
            .label.industrial .qr-container img {
              width: 140px;
              height: 140px;
            }
            .sku-code {
              font-family: "Courier New", Courier, monospace;
              font-weight: 900;
              font-size: 14px;
              letter-spacing: 1.2px;
              margin-top: 4px;
              background: #f0f0f0;
              padding: 2px 6px;
              border-radius: 3px;
              width: 90%;
            }
            .label.compact .sku-code {
              font-size: 11px;
            }
            .label.industrial .sku-code {
              font-size: 17px;
            }
            .product-name {
              font-size: 10px;
              font-weight: 700;
              margin: 4px 0 6px 0;
              line-height: 1.2;
              max-height: 2.4em;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-meta {
              display: flex;
              flex-wrap: wrap;
              gap: 4px;
              justify-content: center;
              font-size: 8.5px;
              font-family: monospace;
              width: 100%;
              margin-top: 4px;
              border-top: 1px dashed #eee;
              padding-top: 4px;
            }
            .meta-item {
              background: #f8f8f8;
              border: 1px solid #ddd;
              padding: 1px 4px;
              border-radius: 2px;
            }
            .meta-label {
              font-weight: bold;
              color: #555;
            }
            .meta-price {
              font-weight: 800;
              background: #e6f7ec;
              border-color: #8ed8a4;
            }
            .barcode-simulation {
              margin-top: 6px;
              width: 85%;
              text-align: center;
            }
            .barcode-bars {
              height: 14px;
              background: repeating-linear-gradient(
                90deg,
                #000 0px,
                #000 1.5px,
                #fff 1.5px,
                #fff 3px,
                #000 3px,
                #000 5px,
                #fff 5px,
                #fff 6.5px,
                #000 6.5px,
                #000 7.5px
              );
              border-radius: 1px;
            }
            .barcode-text {
              font-family: monospace;
              font-size: 7.5px;
              letter-spacing: 2px;
              color: #333;
              margin-top: 1px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <div>
              <div class="header-title">Warehouse Physical Inventory SKU Barcode & QR Labels</div>
              <div style="font-size: 10px; color: #444; margin-top: 2px;">
                Generated for ${activeProducts.length} hardware inventory units • Preset: ${labelSize.toUpperCase()} Label
              </div>
            </div>
            <div class="header-date">
              ${new Date().toLocaleString()}
            </div>
          </div>

          <div class="label-grid">
            ${labelsHtml.join('')}
          </div>

          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setIsPrinting(false);
        return;
      }
    } catch {
      // ignore
    }

    // Fallback to hidden iframe for environments that restrict window.open
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
          setIsPrinting(false);
        }, 1500);
      }, 500);
    } else {
      setIsPrinting(false);
    }
  };

  // Download all generated QR code images as JSON / text inventory index
  const handleDownloadIndex = () => {
    const payload = activeProducts.map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      warehouse: p.warehouse,
      binLocation: getBinLocation(p.sku),
      qrPayload: payloadFormat === 'sku' ? p.sku : payloadFormat === 'url' ? `${window.location.origin}/?product=${p.id}#${p.sku}` : { sku: p.sku, id: p.id },
      qrDataUrl: qrCodeUrls[p.id] || null
    }));

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `omnistore-sku-qr-index-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="bulk-qr-modal-backdrop"
        className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          id="bulk-qr-modal-container"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-950 border border-neutral-800 rounded-3xl max-w-6xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] my-auto"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/10">
                <QrCode className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>{title}</span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      PRINT LABELS
                    </span>
                  </h3>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Generate scannable QR tags and high-contrast warehouse bin labels for optical inventory management.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="bulk-qr-print-action-btn"
                onClick={handlePrintLabels}
                disabled={activeProducts.length === 0 || isGenerating}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Open system print dialog with pre-formatted grid of labels"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Print {activeProducts.length} Labels</span>
              </button>

              <button
                id="bulk-qr-download-index-btn"
                onClick={handleDownloadIndex}
                disabled={activeProducts.length === 0}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Download JSON index of all QR code data URLs and inventory metadata"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export Index</span>
              </button>

              <button
                id="bulk-qr-close-btn"
                onClick={onClose}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                title="Close modal (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Controls Bar: Filters & Label Options */}
          <div className="p-3 sm:p-4 bg-neutral-900/40 border-b border-neutral-800/80 space-y-3">
            {/* Top row: Filter inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              {/* Search */}
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by SKU or speak code..."
                  className="w-full pl-8 pr-16 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-white placeholder:text-neutral-500 focus:outline-none focus:border-sky-500 text-xs font-mono"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <VoiceDictationButton
                    id="bulk-qr-voice-dictation-btn"
                    onTranscript={(text) => setSearchQuery(text)}
                    title="Speak SKU code hands-free (Web Speech API)"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-sky-500 text-xs cursor-pointer capitalize"
                >
                  <option value="all">All Categories ({products.length})</option>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({products.filter(p => p.category === cat).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse selector */}
              <div>
                <select
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-sky-500 text-xs cursor-pointer"
                >
                  <option value="all">All Fulfillment Hubs</option>
                  {warehouses.filter(w => w !== 'all').map(wh => (
                    <option key={wh} value={wh}>
                      {wh} ({products.filter(p => p.warehouse.includes(wh)).length})
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock status filter */}
              <div>
                <select
                  value={stockStatusFilter}
                  onChange={(e) => setStockStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 focus:outline-none focus:border-sky-500 text-xs cursor-pointer"
                >
                  <option value="all">All Stock Levels</option>
                  <option value="in_stock">In Stock Only</option>
                  <option value="low_stock">Low Stock (≤ 4 units)</option>
                  <option value="out_of_stock">Out of Stock Only</option>
                </select>
              </div>
            </div>

            {/* Bottom row: Label customization & batch selection toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-neutral-800/60">
              {/* Batch selection summary & actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-neutral-400">
                  Showing <strong className="text-white">{filteredProducts.length}</strong> SKUs • Selected{' '}
                  <strong className="text-sky-400">{activeProducts.length}</strong>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    id="bulk-qr-select-all-btn"
                    onClick={handleSelectAllFiltered}
                    className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CheckSquare className="w-3 h-3 text-sky-400" />
                    <span>Select All in View</span>
                  </button>
                  <button
                    id="bulk-qr-deselect-all-btn"
                    onClick={handleDeselectAllFiltered}
                    className="px-2 py-1 rounded-lg bg-neutral-800/70 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                    <span>Deselect All</span>
                  </button>
                </div>
              </div>

              {/* Label Format Configuration */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Format selection */}
                <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <span>Encoded:</span>
                  <div className="inline-flex rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
                    {(['sku', 'url', 'json'] as LabelPayloadFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setPayloadFormat(fmt)}
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase transition-colors cursor-pointer ${
                          payloadFormat === fmt
                            ? 'bg-sky-500/20 text-sky-400 font-bold border border-sky-500/40'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Label Size */}
                <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                  <span>Size:</span>
                  <div className="inline-flex rounded-lg bg-neutral-950 p-0.5 border border-neutral-800">
                    {(['compact', 'standard', 'industrial'] as LabelSize[]).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setLabelSize(sz)}
                        className={`px-2 py-0.5 rounded-md text-[10px] capitalize transition-colors cursor-pointer ${
                          labelSize === sz
                            ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                            : 'text-neutral-400 hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Additional label details toggles */}
                <div className="flex items-center gap-2 text-[11px]">
                  <label className="flex items-center gap-1 text-neutral-400 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeBarcode}
                      onChange={(e) => setIncludeBarcode(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-950 text-sky-500 focus:ring-0"
                    />
                    <span>1D Barcode</span>
                  </label>
                  <label className="flex items-center gap-1 text-neutral-400 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeBinLocation}
                      onChange={(e) => setIncludeBinLocation(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-950 text-sky-500 focus:ring-0"
                    />
                    <span>Storage Bin</span>
                  </label>
                  <label className="flex items-center gap-1 text-neutral-400 hover:text-white cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includePrice}
                      onChange={(e) => setIncludePrice(e.target.checked)}
                      className="rounded border-neutral-700 bg-neutral-950 text-sky-500 focus:ring-0"
                    />
                    <span>Price</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of Generated Scannable QR Labels */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-neutral-950">
            {isGenerating && Object.keys(qrCodeUrls).length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                <h4 className="text-sm font-bold text-white">Synthesizing High-Resolution QR Matrices...</h4>
                <p className="text-xs text-neutral-400">Rendering scannable barcodes for {activeProducts.length} selected SKUs.</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-neutral-400 space-y-2">
                <AlertCircle className="w-8 h-8 text-neutral-500 mx-auto" />
                <p className="text-sm font-semibold text-neutral-300">No SKUs match your filter criteria.</p>
                <p className="text-xs text-neutral-500">Try loosening search keywords or clearing warehouse filters.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                    setWarehouseFilter('all');
                    setStockStatusFilter('all');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs text-white transition-colors cursor-pointer mt-2"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div
                className={`grid gap-3.5 ${
                  labelSize === 'compact'
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                    : labelSize === 'industrial'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                }`}
              >
                {filteredProducts.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  const qrUrl = qrCodeUrls[product.id];
                  const binLocation = getBinLocation(product.sku);
                  const isCopied = copiedSku === product.sku;

                  return (
                    <div
                      key={product.id}
                      className={`group relative rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-neutral-900/90 border-neutral-700 shadow-md hover:border-sky-500/60'
                          : 'bg-neutral-950/60 border-neutral-800/80 opacity-60 hover:opacity-90'
                      }`}
                    >
                      {/* Top Header of the Label */}
                      <div className="p-3 border-b border-neutral-800/70 flex items-center justify-between gap-2 bg-neutral-900/40">
                        <button
                          type="button"
                          onClick={() => toggleSelectProduct(product.id)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-sky-500 border-sky-400 text-neutral-950'
                              : 'border-neutral-700 bg-neutral-950 text-transparent'
                          }`}
                          title={isSelected ? 'Deselect from print run' : 'Select for print run'}
                        >
                          <Check className={`w-3.5 h-3.5 stroke-[3] ${isSelected ? 'block' : 'hidden'}`} />
                        </button>

                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 truncate">
                            {product.category}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                              product.stock <= 0
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : product.stock <= product.lowStockThreshold
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {product.stock} in stock
                          </span>
                        </div>
                      </div>

                      {/* Main QR Code Section */}
                      <div className="p-3.5 flex flex-col items-center justify-center text-center">
                        <div className="relative p-2.5 bg-white rounded-xl shadow-lg border border-neutral-200 group-hover:scale-[1.02] transition-transform">
                          {qrUrl ? (
                            <img
                              src={qrUrl}
                              alt={`QR for ${product.sku}`}
                              className={`object-contain ${
                                labelSize === 'compact'
                                  ? 'w-24 h-24'
                                  : labelSize === 'industrial'
                                  ? 'w-40 h-40'
                                  : 'w-32 h-32'
                              }`}
                            />
                          ) : (
                            <div className="w-32 h-32 flex items-center justify-center bg-neutral-100 text-neutral-400">
                              <QrCode className="w-8 h-8 animate-pulse text-neutral-400" />
                            </div>
                          )}

                          {/* Center small overlay icon */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-6 h-6 rounded-md bg-white border border-neutral-300 shadow-sm flex items-center justify-center">
                              <Barcode className="w-3.5 h-3.5 text-neutral-900" />
                            </div>
                          </div>
                        </div>

                        {/* SKU Badge & Copy Button */}
                        <div className="mt-3 w-full">
                          <button
                            type="button"
                            onClick={() => handleCopySku(product.sku)}
                            className="w-full px-2 py-1 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-xs font-bold border border-neutral-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer group/sku"
                            title="Click to copy exact SKU"
                          >
                            <span>{product.sku}</span>
                            {isCopied ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-neutral-500 group-hover/sku:text-neutral-300" />
                            )}
                          </button>

                          <h5 className="text-xs font-semibold text-neutral-200 truncate mt-1.5" title={product.name}>
                            {product.name}
                          </h5>
                        </div>

                        {/* Metadata Tags (Fulfillment Dock, Bin, Price) */}
                        <div className="mt-2.5 w-full space-y-1">
                          {includeWarehouse && (
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                              <span className="text-neutral-500">Dock:</span>
                              <span className="truncate max-w-[150px]">{product.warehouse.split('(')[0].trim()}</span>
                            </div>
                          )}

                          {includeBinLocation && (
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                              <span className="text-neutral-500">Storage Loc:</span>
                              <span className="text-sky-400 font-bold">{binLocation}</span>
                            </div>
                          )}

                          {includePrice && (
                            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                              <span className="text-neutral-500">MSRP:</span>
                              <span className="text-emerald-400 font-bold">${product.price.toFixed(2)}</span>
                            </div>
                          )}
                        </div>

                        {/* Optional 1D Barcode Strip */}
                        {includeBarcode && (
                          <div className="mt-2 w-full pt-2 border-t border-neutral-800/80">
                            <div className="h-3 w-full bg-[repeating-linear-gradient(90deg,#888_0px,#888_1px,#111_1px,#111_2px,#888_2px,#888_4px,#111_4px,#111_5px)] rounded-xs opacity-75" />
                            <div className="text-[9px] font-mono text-neutral-500 mt-0.5 tracking-widest text-center">
                              *{product.sku}*
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="p-2 border-t border-neutral-800/70 bg-neutral-900/50 flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500 text-[10px] font-mono">
                          {payloadFormat.toUpperCase()} ENCODED
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleSelectProduct(product.id)}
                            className="text-[10px] font-medium text-neutral-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            {isSelected ? 'Exclude' : 'Include'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-neutral-800 bg-neutral-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-400">
              <Boxes className="w-4 h-4 text-emerald-400" />
              <span>
                Ready for thermal adhesive sheets (Avery 5160 / Zebra ZD421 / DYMO 4XL / A4 Avery grid).
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                Close Hub
              </button>

              <button
                type="button"
                onClick={handlePrintLabels}
                disabled={activeProducts.length === 0 || isPrinting}
                className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold flex items-center gap-2 shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4 stroke-[2.5]" />
                <span>Launch Print Layout ({activeProducts.length} Labels)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
