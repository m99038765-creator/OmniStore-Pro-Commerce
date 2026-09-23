import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  QrCode,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  Boxes,
  ShieldCheck,
  Sparkles,
  Info,
  ScanLine,
  Barcode
} from 'lucide-react';
import QRCode from 'qrcode';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

export const ProductQrCodeModal: React.FC = () => {
  const { qrCodeProduct, setQrCodeProduct, setQuickViewProduct } = useStore();
  const [payloadType, setPayloadType] = useState<'sku' | 'url' | 'specs'>('sku');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);

  const product = qrCodeProduct;

  // Build payloads
  const scanPayload = useMemo(() => {
    if (!product) return '';
    if (payloadType === 'sku') {
      return product.sku;
    }
    if (payloadType === 'url') {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
      return `${origin}${pathname}?product=${encodeURIComponent(product.id)}#${encodeURIComponent(product.sku)}`;
    } else {
      const specsList = Object.entries(product.specs || {})
        .map(([k, v]) => `• ${k}: ${v}`)
        .join('\n');

      return `[OMNISTORE HARDWARE SPECIFICATION]
Item: ${product.name}
SKU: ${product.sku}
Price: $${product.price.toFixed(2)} USD
Category: ${product.category.toUpperCase()}
Stock: ${product.stock > 0 ? `${product.stock} units available` : 'Sold Out'}
Fulfillment: ${product.warehouse}
Warranty: ${product.warranty}
Rating: ${product.rating}/5.0 (${product.reviewCount || 0} customer reviews)

Specifications:
${specsList}

Direct Verification:
${typeof window !== 'undefined' ? window.location.origin : ''}?product=${product.id}`.trim();
    }
  }, [product, payloadType]);

  // Generate QR Code data URL whenever payload changes
  useEffect(() => {
    if (!scanPayload) return;
    let isMounted = true;
    setGenerating(true);

    QRCode.toDataURL(scanPayload, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0a0a0a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setGenerating(false);
        }
      })
      .catch((err) => {
        console.error('QR code generation failed:', err);
        if (isMounted) setGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [scanPayload]);

  if (!product) return null;

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(scanPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `OMNISTORE-QR-${product.sku}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isOutOfStock = product.stock <= 0;

  return (
    <AnimatePresence>
      <div
        id="product-qr-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setQrCodeProduct(null)}
      >
        <motion.div
          id="product-qr-modal-content"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-neutral-950 border border-neutral-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative my-auto text-neutral-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-white tracking-tight truncate">
                    Product SKU & Optical QR Code
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shrink-0">
                    SCANNABLE MATRIX
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Point any smartphone camera, optical tablet scanner, or handheld warehouse reader at this code.
                </p>
              </div>
            </div>

            <button
              id="close-qr-modal-btn"
              onClick={() => setQrCodeProduct(null)}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors border border-neutral-800 cursor-pointer"
              title="Close QR Code"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Product Mini Dossier Header */}
          <div className="px-4 sm:px-6 py-3 bg-neutral-900/50 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={product.images[0]}
                alt={product.name}
                className="w-10 h-10 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0"
              />
              <div className="min-w-0">
                <div className="font-bold text-white truncate max-w-xs">{product.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 flex-wrap">
                  <span className="font-mono text-emerald-400 font-bold">${product.price.toFixed(2)}</span>
                  <span>•</span>
                  <div className="inline-flex items-center gap-1">
                    <span className="font-mono text-sky-300 font-semibold bg-sky-950/40 px-1.5 py-0.2 rounded border border-sky-800/60">
                      {product.sku}
                    </span>
                    <button
                      type="button"
                      id="copy-sku-header-btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(product.sku);
                          setCopiedSku(true);
                          setTimeout(() => setCopiedSku(false), 2000);
                        } catch {
                          // ignore
                        }
                      }}
                      className="text-neutral-400 hover:text-white transition-colors p-0.5"
                      title="Copy SKU code"
                    >
                      {copiedSku ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <span>•</span>
                  <span className="text-neutral-500 capitalize">{product.category}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold border ${
                  isOutOfStock
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}
              >
                {isOutOfStock ? 'Sold Out' : `${product.stock} in Stock`}
              </span>
              <button
                onClick={() => {
                  setQrCodeProduct(null);
                  setQuickViewProduct(product);
                }}
                className="text-xs text-neutral-400 hover:text-emerald-300 underline font-medium cursor-pointer"
              >
                View Full Specs
              </button>
            </div>
          </div>

          {/* Payload Selector Tabs */}
          <div className="px-4 sm:px-6 pt-4">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs">
              <button
                id="qr-mode-sku-btn"
                onClick={() => setPayloadType('sku')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  payloadType === 'sku'
                    ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>Product SKU ({product.sku})</span>
              </button>

              <button
                id="qr-mode-url-btn"
                onClick={() => setPayloadType('url')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  payloadType === 'url'
                    ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile Web Link</span>
              </button>

              <button
                id="qr-mode-specs-btn"
                onClick={() => setPayloadType('specs')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  payloadType === 'specs'
                    ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Spec Sheet (Offline)</span>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* QR Code Canvas Card */}
            <div className="md:col-span-6 flex flex-col items-center justify-center">
              <div
                id="qr-target-display-card"
                className="relative bg-white p-4 rounded-2xl shadow-xl border border-neutral-200 group max-w-[260px] w-full flex flex-col items-center"
              >
                {/* Visual Corner Reticles */}
                <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-600 rounded-tl-sm pointer-events-none" />
                <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-600 rounded-tr-sm pointer-events-none" />
                <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-600 rounded-bl-sm pointer-events-none" />
                <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-600 rounded-br-sm pointer-events-none" />

                {generating ? (
                  <div className="w-56 h-56 flex flex-col items-center justify-center text-neutral-500 gap-2">
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-mono">Synthesizing QR Matrix...</span>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative">
                    <img
                      src={qrDataUrl}
                      alt={`QR code for ${product.name}`}
                      className="w-56 h-56 object-contain block select-none"
                    />

                    {/* Subtle centered brand stamp */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 rounded-lg bg-neutral-950 border-2 border-white flex items-center justify-center text-emerald-400 shadow-md">
                        <span className="font-mono font-black text-[9px] tracking-tighter text-white">
                          OMNI
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-2 text-center border-t border-neutral-100 pt-2 w-full">
                  <span className="text-[10px] font-mono font-bold text-neutral-900 uppercase tracking-wider block">
                    {product.sku}
                  </span>
                  <span className="text-[9px] font-mono text-neutral-500">
                    SCAN WITH ANY CAMERA APP
                  </span>
                </div>
              </div>

              {/* Download and Preview actions */}
              <div className="flex items-center gap-2 mt-3.5">
                <button
                  id="qr-download-btn"
                  onClick={handleDownloadQr}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-800 shadow-sm"
                  title="Download PNG for shelf tags or printing"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download PNG</span>
                </button>

                <button
                  id="qr-copy-btn"
                  onClick={handleCopyPayload}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-800 shadow-sm"
                  title="Copy payload to clipboard"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Copy Payload</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Scanning Guidance & Mobile Instructions */}
            <div className="md:col-span-6 space-y-3.5">
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                  <ScanLine className="w-4 h-4 text-emerald-400" />
                  <span>How to scan from this screen:</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-white">Open Native Camera</p>
                      <p className="text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
                        Open the default Camera app on any modern iOS (iPhone/iPad) or Android device.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-white">Align with QR Matrix</p>
                      <p className="text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
                        Position your mobile lens 6–12 inches away from your computer screen until the yellow or white recognition bracket appears.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {payloadType === 'sku'
                          ? 'Instant SKU Capture'
                          : payloadType === 'url'
                          ? 'Tap Link Banner'
                          : 'View Structured Text'}
                      </p>
                      <p className="text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
                        {payloadType === 'sku'
                          ? `Your scanner or phone decodes the exact SKU "${product.sku}", instantly ready to paste into search bars, warehouse handhelds, or inventory dispatch logs.`
                          : payloadType === 'url'
                          ? 'Tap the notification to open this exact product directly on mobile with live inventory and photo galleries.'
                          : 'Your phone automatically decodes hardware specs, SKU tags, and fulfillment data into your clipboard or notes.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payload Preview Bars */}
              {payloadType === 'sku' && (
                <div className="p-3 rounded-xl bg-neutral-900/50 border border-sky-900/40 text-[11px] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Barcode className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="text-neutral-400 text-[10px] uppercase font-mono">Encoded SKU:</span>
                    <span className="text-sky-300 font-mono font-bold truncate">{product.sku}</span>
                  </div>
                  <button
                    type="button"
                    id="copy-encoded-sku-btn"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(product.sku);
                        setCopiedSku(true);
                        setTimeout(() => setCopiedSku(false), 2000);
                      } catch {
                        // ignore
                      }
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 text-sky-300 hover:text-sky-200 font-mono text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedSku ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy SKU</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {payloadType === 'url' && (
                <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-[11px] flex items-center justify-between gap-2">
                  <span className="text-neutral-400 truncate font-mono">{scanPayload}</span>
                  <a
                    id="qr-test-link-new-tab"
                    href={scanPayload}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 underline decoration-dotted"
                  >
                    <span>Test Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {payloadType === 'specs' && (
                <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800 text-[11px] flex items-center justify-between gap-2">
                  <span className="text-neutral-400 truncate font-mono">Structured technical specifications payload</span>
                  <span className="text-emerald-400 font-mono text-[10px]">Ready to scan</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
