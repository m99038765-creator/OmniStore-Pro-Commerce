import { Product, SkuAuditLogEntry, SkuSafetyCheckResult } from '../types';
import { checkSkuAuditLogSafety, isAuditEntryQuarantineOrDamaged } from './skuAuditSafety';
import { extractSkuFromDecodedText } from '../components/ScannerModal';

// Web Audio API Context cache
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Storage key for audio preference
const SCANNER_AUDIO_MUTED_KEY = 'omnistore_scanner_audio_muted';

export function isScannerAudioMuted(): boolean {
  try {
    const val = localStorage.getItem(SCANNER_AUDIO_MUTED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export function setScannerAudioMuted(muted: boolean): void {
  try {
    localStorage.setItem(SCANNER_AUDIO_MUTED_KEY, String(muted));
  } catch {
    // ignore
  }
}

/**
 * Plays a distinct high-tech 'success' sound on valid SKU detection.
 * Crisp, pleasant ascending dual-tone chime (A5 ~880Hz -> E6 ~1320Hz -> A6 ~1760Hz shimmer)
 * with exponential decay envelope.
 */
export function playSkuSuccessSound(): void {
  if (isScannerAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Primary bell tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6
    osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.16); // A6 shimmer

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Harmonic sparkle layer
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, now + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(2637, now + 0.22); // E7

    gain2.gain.setValueAtTime(0.001, now + 0.06);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.29);

    osc2.start(now + 0.06);
    osc2.stop(now + 0.27);
  } catch (err) {
    console.warn('Could not play scan success sound:', err);
  }
}

/**
 * Plays a distinct alerting 'error' sound when an unknown or quarantined SKU is scanned.
 * Deep, unmistakable two-pulse warning buzzer (190Hz -> 140Hz with filtered low-mid buzz)
 * that is immediately recognizable as a scan rejection/alert.
 */
export function playSkuErrorSound(): void {
  if (isScannerAudioMuted()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Lowpass filter to give an authoritative scanner buzzer texture without painful highs
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.connect(ctx.destination);

    // Master gain for the error sequence
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.25, now);
    masterGain.connect(filter);

    // Pulse 1: First warning buzz (0.0s to 0.12s)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(196, now); // G3
    osc1.frequency.linearRampToValueAtTime(155, now + 0.11);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.9, now + 0.015);
    gain1.gain.setValueAtTime(0.9, now + 0.09);
    gain1.gain.linearRampToValueAtTime(0.001, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(masterGain);

    osc1.start(now);
    osc1.stop(now + 0.125);

    // Pulse 2: Second warning buzz, lower pitch (0.15s to 0.32s)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(146.8, now + 0.15); // D3
    osc2.frequency.linearRampToValueAtTime(116.5, now + 0.31); // Bb2

    gain2.gain.setValueAtTime(0.001, now + 0.15);
    gain2.gain.linearRampToValueAtTime(0.95, now + 0.165);
    gain2.gain.setValueAtTime(0.95, now + 0.28);
    gain2.gain.linearRampToValueAtTime(0.001, now + 0.32);

    osc2.connect(gain2);
    gain2.connect(masterGain);

    osc2.start(now + 0.15);
    osc2.stop(now + 0.33);
  } catch (err) {
    console.warn('Could not play scan error sound:', err);
  }
}

export type SkuScanStatus = 'valid' | 'quarantined' | 'unknown';

export interface SkuScanEvaluation {
  status: SkuScanStatus;
  scannedText: string;
  extractedSku: string;
  matchedProduct?: Product;
  safetyResult?: SkuSafetyCheckResult;
  reason: string;
  isAudioSuccess: boolean;
}

/**
 * Evaluates whether a scanned code is a valid product SKU, quarantined SKU, or unknown SKU,
 * and triggers the appropriate audio feedback.
 */
export function evaluateAndPlaySkuAudio(
  scannedText: string,
  products: Product[],
  auditLogs?: SkuAuditLogEntry[]
): SkuScanEvaluation {
  const extracted = extractSkuFromDecodedText(scannedText, products);
  const targetSku = (extracted || scannedText).trim();

  // 1. Check if the SKU matches an existing product in the catalog
  const matchedProduct = products.find(
    p => p.sku.toLowerCase() === targetSku.toLowerCase() ||
         p.sku.replace(/[-\s_]/g, '').toLowerCase() === targetSku.replace(/[-\s_]/g, '').toLowerCase()
  );

  // Unknown SKU scenario
  if (!matchedProduct) {
    playSkuErrorSound();
    return {
      status: 'unknown',
      scannedText,
      extractedSku: targetSku,
      isAudioSuccess: false,
      reason: `SKU code "${targetSku}" is unknown and not registered in the product catalog.`
    };
  }

  // 2. Check if the product's SKU is flagged as quarantined in warehouse audit logs
  const safety = checkSkuAuditLogSafety(matchedProduct.sku, auditLogs);
  const isQuarantined =
    !safety.isSafe &&
    (safety.flagType === 'quarantine' ||
     safety.flagType === 'both' ||
     safety.flaggedEntries?.some(e => isAuditEntryQuarantineOrDamaged(e).isQuarantine));

  if (isQuarantined) {
    playSkuErrorSound();
    return {
      status: 'quarantined',
      scannedText,
      extractedSku: matchedProduct.sku,
      matchedProduct,
      safetyResult: safety,
      isAudioSuccess: false,
      reason: `SKU "${matchedProduct.sku}" is Under Quarantine (${safety.statusLabel}) in the warehouse audit log.`
    };
  }

  // 3. Valid SKU detection
  playSkuSuccessSound();
  return {
    status: 'valid',
    scannedText,
    extractedSku: matchedProduct.sku,
    matchedProduct,
    safetyResult: safety,
    isAudioSuccess: true,
    reason: `Valid SKU "${matchedProduct.sku}" recognized in active inventory.`
  };
}
