import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  MapPin,
  Boxes,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  PackageCheck,
  Maximize2,
  ChevronRight,
  Barcode,
  QrCode
} from 'lucide-react';
import { Product, ScanLogEntry } from '../types';
import { useStore } from '../context/StoreContext';
import { VoiceDictationButton } from './VoiceDictationButton';

let _globalIdCounter = 0;
const _getUniqueId = (prefix = "id") => `${prefix}_${Date.now()}_${++_globalIdCounter}`;

interface WarehouseBarcodeScannerProps {
  initialProductId?: string | null;
  onClose?: () => void;
}

// Generate realistic deterministic barcode bars based on SKU
function getBarcodeBars(sku: string) {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash = (hash * 37 + sku.charCodeAt(i)) % 99991;
  }
  const bars: { width: number; isSpace: boolean }[] = [];
  // Generate 48 bars
  for (let i = 0; i < 46; i++) {
    const val = Math.abs(Math.sin(hash + i * 2.1) * 10);
    const width = (val % 3.5) + 1.2;
    const isSpace = (i + Math.floor(val)) % 5 === 0;
    bars.push({ width: Math.max(1, Math.round(width)), isSpace });
  }
  return bars;
}

// Helper to derive realistic warehouse storage coordinates from SKU
function getStorageCoordinates(sku: string) {
  let hash = 0;
  for (let i = 0; i < sku.length; i++) {
    hash += sku.charCodeAt(i) * (i + 1);
  }
  const aisle = String(1 + (hash % 8)).padStart(2, '0');
  const rackLetters = ['A', 'B', 'C', 'D', 'E'];
  const rack = rackLetters[hash % rackLetters.length];
  const shelf = 1 + (hash % 4);
  const bin = 10 + (hash % 30);
  const serial = `TRK-${hash % 9000 + 1000}-${sku.replace(/[^A-Z0-9]/g, '').slice(-3)}`;

  return {
    aisle: `Aisle ${aisle}`,
    rack: `Rack ${rack}`,
    shelf: `Shelf ${shelf}`,
    bin: `Bin ${bin}`,
    fullLocation: `Aisle ${aisle} • Rack ${rack} • Shelf ${shelf} • Bin ${bin}`,
    serial
  };
}

// Safe Web Audio API synthesizer for the classic warehouse optical scanner beep
function playScannerBeep() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch {
    // Audio may be blocked until user gesture, ignore gracefully
  }
}

export const WarehouseBarcodeScanner: React.FC<WarehouseBarcodeScannerProps> = ({
  initialProductId,
  onClose
}) => {
  const { products, restockProduct, setQrCodeProduct } = useStore();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId || products[0]?.id || ''
  );
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'scanned'>('idle');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanLogs, setScanLogs] = useState<ScanLogEntry[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const activeProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  const barcodeBars = activeProduct ? getBarcodeBars(activeProduct.sku) : [];
  const coords = activeProduct ? getStorageCoordinates(activeProduct.sku) : null;

  // Auto-scan on initial mount if opened for a specific product
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
      handleTriggerScan();
    }
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [initialProductId]);

  const handleTriggerScan = () => {
    if (scanState === 'scanning') return;
    setScanState('scanning');
    setFeedbackMessage(null);

    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);

    // Run 1.35s scanning optical pass
    scanTimerRef.current = setTimeout(() => {
      if (soundEnabled) {
        playScannerBeep();
      }
      setScanState('scanned');

      // Record tracking scan entry
      if (activeProduct && coords) {
        const newLog: ScanLogEntry = {
          id: _getUniqueId("scan"),
          productId: activeProduct.id,
          productName: activeProduct.name,
          sku: activeProduct.sku,
          trackingSerial: coords.serial,
          warehouse: activeProduct.warehouse,
          binLocation: coords.fullLocation,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          action: 'cycle_count',
          actionLabel: 'Optical SKU Verified',
          stockOnHand: activeProduct.stock
        };

        setScanLogs((prev) => [newLog, ...prev.slice(0, 9)]);
      }
    }, 1350);
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProductId(id);
    setScanState('idle');
  };

  const handleQuickCycleCountVerify = () => {
    if (!activeProduct || !coords) return;
    const newLog: ScanLogEntry = {
      id: _getUniqueId("scan"),
      productId: activeProduct.id,
      productName: activeProduct.name,
      sku: activeProduct.sku,
      trackingSerial: coords.serial,
      warehouse: activeProduct.warehouse,
      binLocation: coords.fullLocation,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      action: 'inspection',
      actionLabel: 'Inventory Audit Verified (Pass)',
      stockOnHand: activeProduct.stock
    };
    setScanLogs((prev) => [newLog, ...prev.slice(0, 9)]);
    setFeedbackMessage(`Cycle count verified for SKU ${activeProduct.sku}. Tagged in automated system.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleRestockOne = async () => {
    if (!activeProduct) return;
    await restockProduct(activeProduct.id, 1);
    setFeedbackMessage(`Restocked +1 unit of ${activeProduct.sku}. Authoritative sync broadcasted.`);
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleScanRandom = () => {
    if (products.length === 0) return;
    const otherProducts = products.filter((p) => p.id !== selectedProductId);
    const target = otherProducts.length > 0 ? otherProducts[Math.floor(Math.random() * otherProducts.length)] : products[0];
    setSelectedProductId(target.id);
    setScanState('scanning');
    setFeedbackMessage(null);

    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    scanTimerRef.current = setTimeout(() => {
      if (soundEnabled) playScannerBeep();
      setScanState('scanned');
      const targetCoords = getStorageCoordinates(target.sku);
      setScanLogs((prev) => [
        {
          id: _getUniqueId("scan"),
          productId: target.id,
          productName: target.name,
          sku: target.sku,
          trackingSerial: targetCoords.serial,
          warehouse: target.warehouse,
          binLocation: targetCoords.fullLocation,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          action: 'cycle_count',
          actionLabel: 'Random Audit Scan',
          stockOnHand: target.stock
        },
        ...prev.slice(0, 9)
      ]);
    }, 1300);
  };

  if (!activeProduct) return null;

  const isOutOfStock = activeProduct.stock <= 0;
  const isLowStock = activeProduct.stock > 0 && activeProduct.stock <= activeProduct.lowStockThreshold;

  return (
    <div id="warehouse-barcode-scanner-root" className="space-y-4">
      {/* Scanner Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ScanLine className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Optical Barcode & SKU Telemetry Scanner</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
                LASER READY
              </span>
            </h4>
            <p className="text-[11px] text-neutral-400">
              Simulate physical handheld laser scanning to verify aisle bin locations and stock tracking tags.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Beep Toggle */}
          <button
            id="scanner-sound-toggle-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-neutral-900 border-neutral-700 text-emerald-400 hover:bg-neutral-800'
                : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:bg-neutral-800'
            }`}
            title={soundEnabled ? 'Scanner Beep: On' : 'Scanner Beep: Muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-[10px] font-mono hidden sm:inline">{soundEnabled ? 'Audio On' : 'Muted'}</span>
          </button>

          {/* Random Scan Button */}
          <button
            id="scanner-random-scan-btn"
            onClick={handleScanRandom}
            disabled={scanState === 'scanning'}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Scan Random Item</span>
          </button>

          {/* Close if inline in a modal sub-view */}
          {onClose && (
            <button
              onClick={onClose}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800"
            >
              Exit Scanner
            </button>
          )}
        </div>
      </div>

      {/* Target Item Selector Strip with Voice Dictation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-[11px] font-mono text-neutral-400 shrink-0 uppercase">Select Target:</span>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 shrink-0 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-lg">
            <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">Voice Pick:</span>
            <VoiceDictationButton
              id="barcode-scanner-voice-pick-btn"
              onTranscript={(spokenSku) => {
                const target = products.find(
                  p => p.sku.toLowerCase() === spokenSku.toLowerCase() ||
                       p.sku.toLowerCase().includes(spokenSku.toLowerCase()) ||
                       spokenSku.toLowerCase().includes(p.sku.toLowerCase())
                );
                if (target) {
                  handleSelectProduct(target.id);
                }
              }}
              title="Speak SKU code to target for optical scanning"
              size="sm"
            />
          </div>
          {products.map((p, index) => {
            const isSelected = p.id === selectedProductId;
            return (
              <button
                key={p.id}
                id={`target-sku-${p.id}`}
                onClick={() => handleSelectProduct(p.id)}
                disabled={scanState === 'scanning'}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-sm font-semibold'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{p.sku}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optical Scanner Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Viewfinder Canvas */}
        <div className="lg:col-span-7 bg-neutral-900/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center relative overflow-hidden shadow-inner min-h-[260px]">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)',
              backgroundSize: '16px 16px'
            }}
          />

          {/* Scanner Optics HUD Corner Reticles */}
          <div className="absolute inset-4 pointer-events-none">
            {/* Top-Left */}
            <div
              className={`absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 transition-colors duration-300 ${
                scanState === 'scanned'
                  ? 'border-emerald-400'
                  : scanState === 'scanning'
                  ? 'border-rose-400'
                  : 'border-neutral-600'
              }`}
            />
            {/* Top-Right */}
            <div
              className={`absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 transition-colors duration-300 ${
                scanState === 'scanned'
                  ? 'border-emerald-400'
                  : scanState === 'scanning'
                  ? 'border-rose-400'
                  : 'border-neutral-600'
              }`}
            />
            {/* Bottom-Left */}
            <div
              className={`absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 transition-colors duration-300 ${
                scanState === 'scanned'
                  ? 'border-emerald-400'
                  : scanState === 'scanning'
                  ? 'border-rose-400'
                  : 'border-neutral-600'
              }`}
            />
            {/* Bottom-Right */}
            <div
              className={`absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 transition-colors duration-300 ${
                scanState === 'scanned'
                  ? 'border-emerald-400'
                  : scanState === 'scanning'
                  ? 'border-rose-400'
                  : 'border-neutral-600'
              }`}
            />

            {/* Crosshair Center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`w-6 h-6 border rounded-full transition-all duration-300 ${
                  scanState === 'scanning'
                    ? 'border-rose-500/70 scale-125 animate-ping'
                    : scanState === 'scanned'
                    ? 'border-emerald-500/80 scale-100'
                    : 'border-neutral-700/50'
                }`}
              />
            </div>
          </div>

          {/* Physical Barcode Tag Label */}
          <div
            id="optical-barcode-target-tag"
            className={`relative bg-neutral-100 text-neutral-950 px-6 py-4 rounded-xl border shadow-xl transition-transform duration-300 max-w-sm w-full select-none ${
              scanState === 'scanning' ? 'scale-[1.02] border-rose-500/50' : scanState === 'scanned' ? 'border-emerald-500/50' : 'border-neutral-300'
            }`}
          >
            {/* Label Header */}
            <div className="flex items-center justify-between border-b border-neutral-300 pb-1.5 mb-2 text-[10px] font-mono tracking-wider text-neutral-600">
              <span className="font-bold uppercase">OMNISTORE LOGISTICS</span>
              <span>ISO 9001 / CODE-128</span>
            </div>

            {/* SVG Barcode Visualizer */}
            <div className="flex items-end justify-center gap-[2.5px] h-16 bg-white p-2 rounded border border-neutral-300 overflow-hidden">
              {barcodeBars.map((bar, idx) => (
                <div
                  key={idx}
                  style={{ width: `${bar.width}px` }}
                  className={`h-full ${bar.isSpace ? 'bg-transparent' : 'bg-neutral-950'}`}
                />
              ))}
            </div>

            {/* SKU and Numeric payload */}
            <div className="mt-2 text-center">
              <span className="font-mono text-xs font-black tracking-widest text-neutral-900 block">
                {activeProduct.sku}
              </span>
              <span className="font-mono text-[10px] text-neutral-500 tracking-wider">
                {coords?.serial} • {activeProduct.category.toUpperCase()}
              </span>
            </div>

            {/* Moving Laser Scan Beam Overlay */}
            {scanState === 'scanning' && (
              <motion.div
                initial={{ top: '8%' }}
                animate={{ top: ['8%', '88%', '8%'] }}
                transition={{
                  repeat: Infinity,
                  duration: 1.1,
                  ease: 'easeInOut'
                }}
                className="absolute left-2 right-2 h-1 pointer-events-none z-20"
              >
                {/* Glowing Laser line */}
                <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e,0_0_4px_#ffffff]" />
                {/* Gradient diffuse laser flare */}
                <div className="w-full h-8 -mt-4 bg-gradient-to-b from-rose-500/20 via-rose-500/10 to-transparent blur-[2px]" />
              </motion.div>
            )}

            {/* Scan Success Green Flash */}
            {scanState === 'scanned' && (
              <motion.div
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 bg-emerald-400/25 rounded-xl pointer-events-none"
              />
            )}
          </div>

          {/* Scanner Status Indicator & Action Bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 z-10 w-full max-w-sm justify-between">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              {scanState === 'scanning' && (
                <span className="text-rose-400 flex items-center gap-1.5 animate-pulse font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  ACQUIRING LASER LOCK...
                </span>
              )}
              {scanState === 'scanned' && (
                <span className="text-emerald-400 flex items-center gap-1.5 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PAYLOAD DECODED (100%)
                </span>
              )}
              {scanState === 'idle' && (
                <span className="text-neutral-400 flex items-center gap-1.5">
                  <ScanLine className="w-3.5 h-3.5" />
                  OPTICAL SENSOR READY
                </span>
              )}
            </div>

            <button
              id="trigger-barcode-scan-button"
              onClick={handleTriggerScan}
              disabled={scanState === 'scanning'}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition-all shadow-md active:scale-95 ${
                scanState === 'scanning'
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
              }`}
            >
              <ScanLine className={`w-4 h-4 ${scanState === 'scanning' ? 'animate-spin' : ''}`} />
              <span>{scanState === 'scanning' ? 'Scanning...' : 'Trigger Scan'}</span>
            </button>
          </div>
        </div>

        {/* Scanned Telemetry & Tracking Dossier */}
        <div className="lg:col-span-5 bg-neutral-900/60 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400">
                Item Telemetry Dossier
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  scanState === 'scanned'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {scanState === 'scanned' ? 'VERIFIED ACTIVE' : 'PENDING SCAN'}
              </span>
            </div>

            {/* Product Quick Info Card */}
            <div className="mt-3 flex items-start gap-3 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              <img
                src={activeProduct.images[0]}
                alt={activeProduct.name}
                className="w-12 h-12 rounded-lg object-cover bg-neutral-900 shrink-0 border border-neutral-800"
              />
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-white truncate">{activeProduct.name}</h5>
                <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                  <span className="font-mono text-emerald-400 font-bold">${activeProduct.price.toFixed(2)}</span>
                  <span>•</span>
                  <span className="font-mono">{activeProduct.sku}</span>
                </div>
                <span className="text-[10px] font-mono text-neutral-500 mt-0.5 block truncate">
                  {coords?.serial}
                </span>
              </div>
            </div>

            {/* Location & Physical Inventory Specs */}
            <div className="mt-3 space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>Assigned Location</span>
                </div>
                <span className="font-mono text-white text-[11px] text-right font-medium">
                  {coords?.fullLocation}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  <Boxes className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>Stock On Hand</span>
                </div>
                <div className="text-right">
                  <span
                    className={`font-mono font-bold text-xs ${
                      isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {activeProduct.stock} units
                  </span>
                  {activeProduct.reserved > 0 && (
                    <span className="text-[10px] text-neutral-500 font-mono block">
                      ({activeProduct.reserved} reserved)
                    </span>
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 text-neutral-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Condition Check</span>
                </div>
                <span className="font-mono text-emerald-400 text-[11px] font-medium">
                  Passed QA Inspection
                </span>
              </div>
            </div>

            {/* Action Feedback message */}
            {feedbackMessage && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-[11px] bg-emerald-950/80 border border-emerald-800 text-emerald-300 p-2 rounded-lg flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span>{feedbackMessage}</span>
              </motion.div>
            )}
          </div>

          {/* Tracking Actions */}
          <div className="pt-2 border-t border-neutral-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                id="scanner-audit-verify-btn"
                onClick={handleQuickCycleCountVerify}
                className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border border-neutral-700"
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                <span>Log Cycle Count</span>
              </button>

              <button
                id="scanner-restock-one-btn"
                onClick={handleRestockOne}
                className="px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Restock +1</span>
              </button>
            </div>

            {/* Generate Mobile QR Code Button */}
            <button
              id="scanner-open-qr-modal-btn"
              onClick={() => setQrCodeProduct(activeProduct)}
              className="w-full px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Generate Mobile QR Code for this SKU</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scanned Tracking Logs Feed */}
      {scanLogs.length > 0 && (
        <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Recent Barcode Tracking Audit Logs ({scanLogs.length})
              </span>
            </div>
            <button
              onClick={() => setScanLogs([])}
              className="text-[10px] text-neutral-400 hover:text-neutral-200 underline font-mono"
            >
              Clear Audit Log
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {scanLogs.map((log, index) => (
              <div
                key={log.id}
                className="text-[11px] font-mono p-2 rounded-lg bg-neutral-950/70 border border-neutral-800/70 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-neutral-500 text-[10px]">{log.timestamp}</span>
                  <span className="text-emerald-400 font-bold">{log.sku}</span>
                  <span className="text-neutral-300 truncate max-w-[140px] sm:max-w-xs">
                    {log.productName}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0 text-neutral-400 text-[10px]">
                  <span className="text-neutral-400">{log.binLocation}</span>
                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-emerald-300 font-bold border border-neutral-700">
                    {log.stockOnHand} on-hand
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
