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
  Image as ImageIcon
} from 'lucide-react';
import { Product } from '../types';
import { VoiceDictationButton } from './VoiceDictationButton';

export interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  products?: Product[];
  title?: string;
  subtitle?: string;
}

// Audio feedback on successful scan using Web Audio API
function playScanSuccessChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // Ignore audio failures if browser restricts audio context before interaction
  }
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
  products = [],
  title = 'Scan SKU Barcode / QR Code',
  subtitle = 'Point camera at any hardware barcode, warehouse bin tag, or product QR code'
}) => {
  const [cameraState, setCameraState] = useState<'initializing' | 'active' | 'error'>('initializing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedSku, setDetectedSku] = useState<string | null>(null);
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerElementId = 'sku-camera-scanner-viewfinder';

  // Sample SKUs from current catalog for easy bypass / manual testing
  const sampleSkus = products.length > 0
    ? products.slice(0, 5).map(p => p.sku)
    : ['AUD-REF-8040', 'DSP-EQ-4080', 'CAM-CINE-6K', 'OPT-PRIME-85', 'DISP-4K-OLED'];

  // Handle successful detection
  const handleSuccessfulScan = useCallback((rawText: string) => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    playScanSuccessChime();
    const finalSku = extractSkuFromDecodedText(rawText, products);
    setDetectedSku(finalSku || rawText);

    // Stop the camera smoothly
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

    // Give visual confirmation before completing scan
    setTimeout(() => {
      onScan(finalSku || rawText);
      onClose();
    }, 700);
  }, [products, onScan, onClose]);

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
          handleSuccessfulScan(decodedText);
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
        setErrorMessage('No camera device detected on this system. You can upload an image or use sample SKUs below.');
      } else {
        setErrorMessage('Camera stream could not be started. You can upload an image file or test with sample SKUs.');
      }
      setCameraState('error');
    }
  }, [selectedCameraId, stopCamera, handleSuccessfulScan]);

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
      // Ensure we have a scanner instance for file scanning
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(readerElementId, { verbose: false });
        scannerRef.current = scanner;
      }

      // Stop video stream if running
      const state = scanner.getState();
      if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
        await scanner.stop();
      }

      const decodedText = await scanner.scanFile(file, true);
      handleSuccessfulScan(decodedText);
    } catch (err) {
      console.warn('File scan error:', err);
      setErrorMessage('Could not find or decode a valid barcode or QR code in the uploaded image. Please try another image or test with sample SKUs.');
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setDetectedSku(null);
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
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
          className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col my-auto"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 flex items-center justify-between border-b border-neutral-800 bg-neutral-900/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shadow-inner">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <span>{title}</span>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Live Vision
                  </span>
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5 truncate max-w-[260px] sm:max-w-xs">
                  {subtitle}
                </p>
              </div>
            </div>

            <button
              id="close-scanner-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
              title="Close scanner (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Viewfinder & Video Frame */}
          <div className="relative bg-neutral-950 p-4 sm:p-5 flex flex-col items-center justify-center min-h-[320px]">
            {/* Camera Viewport Container */}
            <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[300px] rounded-2xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex items-center justify-center">
              {/* HTML5 QR code renders inside here */}
              <div
                id={readerElementId}
                className="w-full h-full flex items-center justify-center text-white [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
              />

              {/* Viewfinder Overlays & Reticle (Active when camera is running) */}
              {cameraState === 'active' && !detectedSku && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6">
                  {/* Outer dimmed border */}
                  <div className="relative w-48 h-48 sm:w-52 sm:h-52 border-2 border-dashed border-sky-400/50 rounded-2xl flex items-center justify-center shadow-lg shadow-sky-500/10">
                    {/* Corner Target Accents */}
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
              {cameraState === 'initializing' && !errorMessage && (
                <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center gap-3 p-4 text-center">
                  <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-neutral-300 font-medium">Accessing optical camera...</p>
                  <span className="text-[11px] text-neutral-500">Requesting sensor stream</span>
                </div>
              )}

              {/* Error State Fallback inside viewport */}
              {cameraState === 'error' && (
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

              {/* Detection Success State Banner */}
              {detectedSku && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center gap-3 p-6 text-center z-20"
                >
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                      SKU Successfully Detected
                    </span>
                    <h4 className="text-base font-bold text-white font-mono mt-1 px-3 py-1 rounded-xl bg-neutral-900 border border-emerald-500/30">
                      {detectedSku}
                    </h4>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Populating search field & filtering catalog...
                  </p>
                </motion.div>
              )}
            </div>

            {/* Viewfinder Controls Bar */}
            <div className="flex items-center gap-2 mt-3.5">
              {cameras.length > 1 && cameraState === 'active' && (
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
              <div className="ml-auto flex items-center gap-1.5 bg-neutral-900/80 px-2.5 py-1 rounded-xl border border-neutral-800">
                <span className="text-[11px] text-neutral-400 font-mono hidden sm:inline">Voice Dictate SKU:</span>
                <VoiceDictationButton
                  id="scanner-modal-voice-dictation-btn"
                  onTranscript={(text) => handleSuccessfulScan(text)}
                  title="Speak SKU code hands-free into scanner"
                  size="sm"
                />
              </div>
            </div>
          </div>

          {/* Quick Test / Sample SKU Bypass (Instant scan simulation) */}
          <div className="p-4 bg-neutral-900/60 border-t border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-sky-400" />
                Quick-Fill Test SKUs (Bypass / Simulation):
              </span>
              <span className="text-[10px] text-neutral-500">Click to autofill</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {sampleSkus.map((sku) => (
                <button
                  key={sku}
                  type="button"
                  onClick={() => handleSuccessfulScan(sku)}
                  className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-sky-500/15 hover:border-sky-500/40 text-neutral-300 hover:text-sky-300 border border-neutral-800 font-mono text-[11px] transition-all cursor-pointer active:scale-95"
                  title={`Simulate scan for SKU ${sku}`}
                >
                  {sku}
                </button>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="px-5 py-3 bg-neutral-950 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-neutral-400" />
              <span>Supports 1D Barcode & 2D QR</span>
            </span>
            <span className="flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-neutral-400" />
              <span>Direct SKU Population</span>
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
