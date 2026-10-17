import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Camera,
  AlertTriangle,
  Upload,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Zap,
  FlipHorizontal,
  Barcode,
  QrCode,
  Volume2,
  VolumeX,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  Copy,
  Check,
  Search
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { VoiceDictationButton } from './VoiceDictationButton';
import {
  evaluateAndPlaySkuAudio,
  playSkuSuccessSound,
  playSkuErrorSound,
  isScannerAudioMuted,
  setScannerAudioMuted,
  SkuScanEvaluation
} from '../utils/scannerAudio';

export interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  products?: Product[];
  title?: string;
  subtitle?: string;
}

// Extract clean SKU from QR / Barcode decoded string
export function extractSkuFromDecodedText(decodedText: string, products: Product[] = []): string {
  const text = (decodedText || '').trim();
  if (!text) return '';

  // 1. Direct match with product SKU (case-insensitive)
  const exactProd = products.find(p => p.sku.toLowerCase() === text.toLowerCase());
  if (exactProd) return exactProd.sku;

  // 2. Try JSON parsing
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.sku && typeof parsed.sku === 'string') {
        return parsed.sku.trim();
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // 3. Regex for "SKU: <value>" or "SKU = <value>" or "SKU - <value>"
  const skuLabelMatch = text.match(/SKU\s*[:=-]\s*([A-Za-z0-9_-]+)/i);
  if (skuLabelMatch && skuLabelMatch[1]) {
    const candidate = skuLabelMatch[1].trim();
    const matchInList = products.find(p => p.sku.toLowerCase() === candidate.toLowerCase());
    return matchInList ? matchInList.sku : candidate;
  }

  // 4. URL hash or query param: e.g. #AUD-REF-8040 or ?sku=AUD-REF-8040
  const urlMatch = text.match(/[#&?]sku=([A-Za-z0-9_-]+)/i) || text.match(/#([A-Za-z0-9_-]{3,})/);
  if (urlMatch && urlMatch[1]) {
    const candidate = urlMatch[1].trim();
    const matched = products.find(p => p.sku.toLowerCase() === candidate.toLowerCase());
    if (matched) return matched.sku;
  }

  // 5. URL with product ID: e.g. product=prod_...
  const prodIdMatch = text.match(/[?&]product=([A-Za-z0-9_-]+)/i);
  if (prodIdMatch && prodIdMatch[1]) {
    const matched = products.find(p => p.id === prodIdMatch[1]);
    if (matched) return matched.sku;
  }

  // 6. Check if text contains any known product SKU as a substring
  for (const p of products) {
    if (text.toUpperCase().includes(p.sku.toUpperCase())) {
      return p.sku;
    }
  }

  // 7. Fallback to clean trimmed string (strip wrapping quotes, brackets)
  return text.replace(/^["'\[]+|["'\]]+$/g, '').trim();
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  products: propsProducts,
  title = 'Scan SKU Barcode / QR Code',
  subtitle = 'Point camera at any hardware barcode, warehouse bin tag, or product QR code'
}) => {
  const store = useStore();
  const products = propsProducts && propsProducts.length > 0 ? propsProducts : store.products;
  const { warehouseAuditLogs } = store;

  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanEvaluation, setScanEvaluation] = useState<SkuScanEvaluation | null>(null);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [audioMuted, setAudioMuted] = useState<boolean>(() => isScannerAudioMuted());
  const [customTestInput, setCustomTestInput] = useState('');
  const [copiedAuditId, setCopiedAuditId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerElementId = 'sku-camera-scanner-viewfinder';

  // Toggle sound preference
  const handleToggleSound = () => {
    const nextVal = !audioMuted;
    setAudioMuted(nextVal);
    setScannerAudioMuted(nextVal);
  };

  // Clean shutdown helper
  const stopCamera = useCallback(async () => {
    if (!scannerRef.current) return;
    try {
      const state = scannerRef.current.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scannerRef.current.stop();
      }
      scannerRef.current.clear();
    } catch {
      // Safe ignore
    }
  }, []);

  // Handle detection with Audio Feedback logic
  const handleProcessScan = useCallback((rawText: string) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    // Evaluate SKU validity, quarantine state, and trigger audio
    const evaluation = evaluateAndPlaySkuAudio(rawText, products, warehouseAuditLogs);
    setScanEvaluation(evaluation);

    // Stop the camera viewfinder
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          scannerRef.current.stop().catch(() => {}).finally(() => {
            scannerRef.current?.clear();
          });
        } else {
          scannerRef.current.clear();
        }
      } catch {
        // Safe ignore
      }
    }

    // Auto-proceed if SKU is valid
    if (evaluation.status === 'valid') {
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = setTimeout(() => {
        onScan(evaluation.extractedSku);
        onClose();
      }, 850);
    }
    // If unknown or quarantined: do not auto-close; let the operator examine the error and choose action
  }, [products, warehouseAuditLogs, onScan, onClose]);

  // Resume camera scanner after examining an unknown/quarantined SKU
  const handleResetScan = useCallback(() => {
    if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
    setScanEvaluation(null);
    isStoppingRef.current = false;
    startCamera(selectedCameraId || undefined);
  }, [selectedCameraId]);

  // Start Camera Stream
  const startCamera = useCallback(async (cameraId?: string) => {
    setCameraState('initializing');
    setErrorMessage(null);
    isStoppingRef.current = false;

    // Small delay to allow DOM render of the viewfinder div
    await new Promise(resolve => setTimeout(resolve, 120));

    const element = document.getElementById(readerElementId);
    if (!element) {
      setErrorMessage('Scanner viewfinder DOM element failed to initialize.');
      setCameraState('error');
      return;
    }

    try {
      // Clean up previous scanner if any
      await stopCamera();

      // Retrieve available cameras if not loaded
      try {
        const availableDevices = await Html5Qrcode.getCameras();
        if (availableDevices && availableDevices.length > 0) {
          setCameras(availableDevices);
          if (!selectedCameraId && !cameraId) {
            // Prefer environment (back) camera if available
            const backCam = availableDevices.find(d =>
              d.label.toLowerCase().includes('back') ||
              d.label.toLowerCase().includes('rear') ||
              d.label.toLowerCase().includes('environment')
            );
            cameraId = backCam ? backCam.id : availableDevices[0].id;
            setSelectedCameraId(cameraId);
          }
        }
      } catch {
        // Non-fatal, can still attempt start with constraints
      }

      const scanner = new Html5Qrcode(readerElementId, { verbose: false });
      scannerRef.current = scanner;

      const cameraConfig = cameraId
        ? { deviceId: { exact: cameraId } }
        : { facingMode: 'environment' };

      await scanner.start(
        cameraConfig,
        {
          fps: 12,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.floor(minEdge * 0.72);
            return { width: Math.max(edge, 180), height: Math.max(edge, 180) };
          },
          aspectRatio: 1.0
        },
        (decodedText) => {
          handleProcessScan(decodedText);
        },
        () => {
          // Frame read attempt - safe to ignore
        }
      );

      setCameraState('active');
    } catch (err: unknown) {
      console.warn('Camera start error:', err);
      const errStr = err instanceof Error ? err.message : String(err);
      if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
        setErrorMessage('Camera access was denied. Please allow camera permissions in your browser, or upload an image of the barcode below.');
      } else if (errStr.includes('NotFound') || errStr.includes('DevicesNotFoundError')) {
        setErrorMessage('No camera device detected on this system. You can upload an image or use sample test SKUs below.');
      } else {
        setErrorMessage('Camera stream could not be started. You can upload an image file or test with sample SKUs.');
      }
      setCameraState('error');
    }
  }, [selectedCameraId, stopCamera, handleProcessScan]);

  // Switch camera when user toggles
  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    startCamera(nextCamera.id);
  };

  // Image file upload scanner
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setErrorMessage(null);

    try {
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(readerElementId, { verbose: false });
        scannerRef.current = scanner;
      }

      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }

      const decodedText = await scanner.scanFile(file, true);
      handleProcessScan(decodedText);
    } catch (err) {
      console.warn('File scan error:', err);
      playSkuErrorSound();
      setErrorMessage('Could not decode a valid barcode or QR code in the uploaded image. Please try another image or test with sample SKUs.');
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCopyAuditId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedAuditId(id);
      setTimeout(() => setCopiedAuditId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setScanEvaluation(null);
      startCamera();
    } else {
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      stopCamera();
    }

    return () => {
      if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="scanner-modal-backdrop"
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-neutral-950/85 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-inner">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{title}</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Optical Vision
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[240px] sm:max-w-xs">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Audio Feedback Toggle */}
              <button
                id="scanner-audio-toggle-btn"
                type="button"
                onClick={handleToggleSound}
                className={`p-2 rounded-xl border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                  !audioMuted
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                }`}
                title={!audioMuted ? 'Audio feedback: Active (Success Chime & Error Buzzer)' : 'Audio feedback: Muted'}
                aria-label="Toggle scanner audio feedback"
              >
                {!audioMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span className="text-[10px] font-mono font-semibold hidden sm:inline">
                  {!audioMuted ? 'Audio ON' : 'Muted'}
                </span>
              </button>

              <button
                id="close-scanner-modal-btn"
                onClick={onClose}
                className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                title="Close scanner (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Audio Feedback Status Notice Banner */}
          <div className="px-4 py-1.5 bg-neutral-900/40 border-b border-neutral-800/80 flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-neutral-400">
              <span className={`w-2 h-2 rounded-full ${!audioMuted ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'}`} />
              <span>Audio Feedback:</span>
              <strong className={!audioMuted ? 'text-emerald-300' : 'text-neutral-500'}>
                {!audioMuted ? 'Enabled (Dual-tone Success Chime / Warning Error Buzzer)' : 'Muted'}
              </strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => playSkuSuccessSound()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-colors cursor-pointer"
                title="Test valid SKU success chime audio"
              >
                Test Success 🔔
              </button>
              <button
                type="button"
                onClick={() => playSkuErrorSound()}
                className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                title="Test unknown or quarantined SKU error buzzer audio"
              >
                Test Error ⚠️
              </button>
            </div>
          </div>

          {/* Viewfinder & Video Frame */}
          <div className="relative bg-neutral-950 p-4 sm:p-5 flex flex-col items-center justify-center min-h-[320px]">
            {/* Camera Viewport Container */}
            <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[310px] rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex items-center justify-center">
              {/* HTML5 QR code renders inside here */}
              <div
                id={readerElementId}
                className="w-full h-full flex items-center justify-center text-white [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
              />

              {/* Viewfinder Overlays & Reticle (Active when camera is running) */}
              {cameraState === 'active' && !scanEvaluation && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  {/* Outer reticle */}
                  <div className="relative w-48 h-48 sm:w-52 sm:h-52 border-2 border-dashed border-sky-400/50 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/10">
                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-sky-400 rounded-tl-sm" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-sky-400 rounded-tr-sm" />
                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-sky-400 rounded-bl-sm" />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-sky-400 rounded-br-sm" />

                    {/* Animated Scanning Laser Line */}
                    <motion.div
                      animate={{ y: [-80, 80, -80] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-full h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_12px_rgba(56,189,248,0.8)]"
                    />

                    {/* Center crosshair */}
                    <div className="w-3 h-3 border border-sky-400/40 rounded-full flex items-center justify-center">
                      <div className="w-1 h-1 bg-sky-400 rounded-full" />
                    </div>
                  </div>

                  {/* Live Target Status Badge */}
                  <div className="absolute bottom-3 px-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-700/80 backdrop-blur-md flex items-center gap-1.5 text-[10px] font-mono text-neutral-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>ALIGNED OPTICAL FEED</span>
                  </div>
                </div>
              )}

              {/* Initializing / Loading Spinner */}
              {cameraState === 'initializing' && !errorMessage && !scanEvaluation && (
                <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-neutral-300 font-medium">Accessing optical camera...</p>
                  <span className="text-[11px] text-neutral-500">Requesting sensor stream</span>
                </div>
              )}

              {/* Error State Fallback inside viewport */}
              {cameraState === 'error' && !scanEvaluation && (
                <div className="absolute inset-0 bg-neutral-950 p-5 flex flex-col items-center justify-center text-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-neutral-200">Camera Feed Restricted</h4>
                  <p className="text-[11px] text-neutral-400 line-clamp-3 max-w-[220px]">
                    {errorMessage || 'Unable to open camera stream. Use image upload or sample SKUs below.'}
                  </p>
                  <button
                    onClick={() => startCamera(selectedCameraId || undefined)}
                    className="mt-1 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Camera</span>
                  </button>
                </div>
              )}

              {/* 1. DETECTION STATE: VALID SKU (Played Success Sound) */}
              {scanEvaluation && scanEvaluation.status === 'valid' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center gap-2.5 p-5 text-center z-20"
                >
                  <div className="w-13 h-13 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                      Valid SKU Detected
                    </span>
                    <h4 className="text-sm font-bold text-white font-mono mt-1 px-3 py-1 rounded-xl bg-neutral-900 border border-emerald-500/30 inline-block">
                      {scanEvaluation.extractedSku}
                    </h4>
                  </div>
                  {scanEvaluation.matchedProduct && (
                    <div className="max-w-[230px]">
                      <p className="text-xs font-semibold text-neutral-200 line-clamp-1">
                        {scanEvaluation.matchedProduct.name}
                      </p>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">
                        ${scanEvaluation.matchedProduct.price.toFixed(2)} • {scanEvaluation.matchedProduct.warehouse.split('(')[0].trim()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <span>Played Success Chime</span>
                  </div>

                  {/* Quick Reserve Button */}
                  {scanEvaluation.matchedProduct && (
                    <button
                      id="scanner-quick-reserve-btn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (scanEvaluation.matchedProduct) {
                          store.reserveItem(scanEvaluation.matchedProduct.id);
                          if (autoCloseTimeoutRef.current) clearTimeout(autoCloseTimeoutRef.current);
                          autoCloseTimeoutRef.current = setTimeout(() => {
                            onScan(scanEvaluation.extractedSku);
                            onClose();
                          }, 1200);
                        }
                      }}
                      className="mt-1 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
                      title="Immediately secure 15-minute stock lock bypassing standard checkout"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current text-neutral-950" />
                      <span>⚡ Quick Reserve (15m Lock)</span>
                    </button>
                  )}

                  <p className="text-[10px] text-neutral-400 animate-pulse">
                    Filtering catalog view...
                  </p>
                </motion.div>
              )}

              {/* 2. DETECTION STATE: UNKNOWN SKU (Played Error Sound) */}
              {scanEvaluation && scanEvaluation.status === 'unknown' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center gap-2 p-4 text-center z-20"
                >
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-950/50">
                    <HelpCircle className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block">
                      Unknown SKU Detected
                    </span>
                    <h4 className="text-xs font-bold text-white font-mono mt-1 px-2.5 py-0.5 rounded-lg bg-neutral-900 border border-rose-500/30 max-w-[220px] truncate mx-auto">
                      {scanEvaluation.extractedSku || scanEvaluation.scannedText}
                    </h4>
                  </div>

                  <p className="text-[11px] text-neutral-300 max-w-[230px] leading-tight">
                    Barcode was decoded, but code does not match any SKU in current catalog.
                  </p>

                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono text-rose-300">
                    <Volume2 className="w-3 h-3 text-rose-400" />
                    <span>Played Error Buzzer</span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <button
                      id="unknown-sku-rescan-btn"
                      type="button"
                      onClick={handleResetScan}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Scan Again</span>
                    </button>
                    <button
                      id="unknown-sku-proceed-btn"
                      type="button"
                      onClick={() => {
                        onScan(scanEvaluation.extractedSku);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Search Anyway</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 3. DETECTION STATE: QUARANTINED SKU (Played Error Sound) */}
              {scanEvaluation && scanEvaluation.status === 'quarantined' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center gap-2 p-4 text-center z-20"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-950/50">
                    <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                      Quarantined SKU Intercepted
                    </span>
                    <h4 className="text-xs font-bold text-white font-mono mt-0.5 px-2.5 py-0.5 rounded-lg bg-neutral-900 border border-amber-500/40 inline-block">
                      {scanEvaluation.extractedSku}
                    </h4>
                  </div>

                  <div className="bg-neutral-900/90 border border-amber-500/30 rounded-xl p-2 text-left max-w-[240px] text-[10px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-amber-300 font-bold">
                      <span>HOLD STATUS:</span>
                      <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {scanEvaluation.safetyResult?.statusLabel || 'Under Quarantine'}
                      </span>
                    </div>
                    {scanEvaluation.safetyResult?.primaryFlaggedEntry && (
                      <p className="text-neutral-400 text-[10px] line-clamp-2">
                        {scanEvaluation.safetyResult.primaryFlaggedEntry.reason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                    <Volume2 className="w-3 h-3 text-amber-400" />
                    <span>Played Error Buzzer (Quarantine Alert)</span>
                  </div>

                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      id="quarantined-sku-rescan-btn"
                      type="button"
                      onClick={handleResetScan}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Scan Another</span>
                    </button>
                    <button
                      id="quarantined-sku-proceed-btn"
                      type="button"
                      onClick={() => {
                        onScan(scanEvaluation.extractedSku);
                        onClose();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <span>Proceed with Hold</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Viewfinder Controls Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3.5 w-full">
              {cameras.length > 1 && cameraState === 'active' && !scanEvaluation && (
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Switch between front and back camera"
                >
                  <FlipHorizontal className="w-3.5 h-3.5 text-sky-400" />
                  <span>Switch Camera</span>
                </button>
              )}

              {/* Hidden File Input for Image Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="sku-qr-file-input"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileScanning}
                className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                title="Upload image containing a barcode or QR code"
              >
                {isFileScanning ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    <span>Decoding Image...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload Image</span>
                  </>
                )}
              </button>

              {/* Hands-Free Voice Dictation Alternative */}
              <div className="flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-xl border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">Voice Dictate SKU:</span>
                <VoiceDictationButton
                  id="scanner-modal-voice-dictation-btn"
                  onTranscript={(text) => handleProcessScan(text)}
                  title="Speak SKU code hands-free into scanner"
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Quick Test / Audio Verification Lab */}
          <div className="p-4 bg-neutral-900/70 border-t border-neutral-800 space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Audio Feedback Verification Suite:</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Click to test instant audio</span>
            </div>

            {/* Test Group 1: Valid SKUs (Success Sound) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>VALID SKUs (Triggers 'Success' Sound):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['AUD-REF-8040', 'DSP-EQ-4080', 'CAM-CINE-6K', 'OPT-ANAMOR-35'].map((sku) => (
                  <button
                    key={sku}
                    id={`test-scan-valid-${sku}`}
                    type="button"
                    onClick={() => handleProcessScan(sku)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                    title={`Test valid SKU ${sku} - plays success chime`}
                  >
                    <span>{sku}</span>
                    <span className="text-[9px] opacity-75 font-sans">✓ Pass</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Group 2: Quarantined SKUs (Error Sound) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-amber-400">
                <ShieldAlert className="w-3 h-3" />
                <span>QUARANTINED SKUs (Triggers 'Error' Sound):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { sku: 'DISP-OLED-49', label: 'Under Quarantine (QA Hold)' },
                  { sku: 'COMP-TB4-4TB', label: 'Quarantined (Damaged Write-Off)' }
                ].map((item) => (
                  <button
                    key={item.sku}
                    id={`test-scan-quarantined-${item.sku}`}
                    type="button"
                    onClick={() => handleProcessScan(item.sku)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-mono text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
                    title={`Test quarantined SKU ${item.sku} - plays warning error sound`}
                  >
                    <span className="font-bold">{item.sku}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Test Group 3: Unknown SKUs (Error Sound) */}
            <div>
              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-mono text-rose-400">
                <HelpCircle className="w-3 h-3" />
                <span>UNKNOWN SKUs (Triggers 'Error' Sound):</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {['UNKNOWN-SKU-999', 'EXT-NONCATALOG-404', 'INVALID-QR-CODE'].map((sku) => (
                  <button
                    key={sku}
                    id={`test-scan-unknown-${sku}`}
                    type="button"
                    onClick={() => handleProcessScan(sku)}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-mono text-[11px] transition-all cursor-pointer active:scale-95 flex items-center gap-1"
                    title={`Test unknown code ${sku} - plays rejection error sound`}
                  >
                    <span>{sku}</span>
                    <span className="text-[9px] opacity-75 font-sans">✕ Unknown</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Barcode Input Test */}
            <div className="pt-1 flex items-center gap-2">
              <input
                id="scanner-custom-test-input"
                type="text"
                value={customTestInput}
                onChange={(e) => setCustomTestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customTestInput.trim()) {
                    handleProcessScan(customTestInput.trim());
                  }
                }}
                placeholder="Type or paste custom SKU / barcode string to test..."
                className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
              <button
                id="scanner-custom-test-btn"
                type="button"
                onClick={() => {
                  if (customTestInput.trim()) {
                    handleProcessScan(customTestInput.trim());
                  }
                }}
                disabled={!customTestInput.trim()}
                className="px-3 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-neutral-950 text-xs font-bold font-mono transition-colors cursor-pointer"
              >
                Scan Code
              </button>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-neutral-400" />
              <span>Supports 1D Barcode & 2D QR</span>
            </span>
            <span className="flex items-center gap-1.5 text-sky-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>Real-Time Synthesizer Sound Engine</span>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
