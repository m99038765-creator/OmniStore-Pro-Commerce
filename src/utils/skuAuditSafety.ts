import { SkuAuditLogEntry, SkuSafetyCheckResult } from '../types';
import { INITIAL_SKU_AUDIT_LOGS } from '../data/initialAuditLogs';

/**
 * Evaluates whether an audit log entry flags an item as 'Under Quarantine' or 'Damaged'.
 */
export function isAuditEntryQuarantineOrDamaged(entry: SkuAuditLogEntry): {
  isFlagged: boolean;
  isQuarantine: boolean;
  isDamaged: boolean;
  flagType: 'quarantine' | 'damaged' | 'both' | null;
  statusLabel: string;
} {
  const reasonText = (entry.reason || '').toLowerCase();
  const notesText = (entry.notes || '').toLowerCase();
  const combined = `${reasonText} ${notesText}`;

  // Checks for 'Under Quarantine' status keywords
  const isQuarantine =
    combined.includes('quarantin') ||
    combined.includes('under quarantine') ||
    combined.includes('quarantined') ||
    combined.includes('qa hold') ||
    combined.includes('isolation hold');

  // Checks for 'Damaged' status keywords
  const isDamaged =
    combined.includes('damage') ||
    combined.includes('damaged') ||
    combined.includes('carton impact') ||
    combined.includes('defect');

  if (isQuarantine && isDamaged) {
    return {
      isFlagged: true,
      isQuarantine: true,
      isDamaged: true,
      flagType: 'both',
      statusLabel: 'Under Quarantine & Damaged'
    };
  } else if (isQuarantine) {
    return {
      isFlagged: true,
      isQuarantine: true,
      isDamaged: false,
      flagType: 'quarantine',
      statusLabel: 'Under Quarantine'
    };
  } else if (isDamaged) {
    return {
      isFlagged: true,
      isQuarantine: false,
      isDamaged: true,
      flagType: 'damaged',
      statusLabel: 'Damaged'
    };
  }

  return {
    isFlagged: false,
    isQuarantine: false,
    isDamaged: false,
    flagType: null,
    statusLabel: 'Clean'
  };
}

/**
 * Cross-references a SKU against the warehouse audit log to ensure the SKU
 * being searched for has not been flagged for 'Under Quarantine' or 'Damaged' status.
 *
 * @param sku The SKU code to check
 * @param providedLogs Optional live audit logs array to cross-reference (falls back to initial audit logs)
 * @returns SkuSafetyCheckResult with flags, labels, and exact audit records
 */
export function checkSkuAuditLogSafety(
  sku: string,
  providedLogs?: SkuAuditLogEntry[]
): SkuSafetyCheckResult {
  const raw = (sku || '').trim().toUpperCase();
  if (!raw) {
    return {
      isSafe: true,
      flagType: null,
      statusLabel: 'Clean',
      flaggedEntries: []
    };
  }

  const cleanRaw = raw.replace(/[-\s_]/g, '');
  const logsToSearch = providedLogs && providedLogs.length > 0 ? providedLogs : INITIAL_SKU_AUDIT_LOGS;

  // Filter audit records matching this SKU (supporting both exact and hyphen-tolerant codes)
  const matchingLogs = logsToSearch.filter(log => {
    const logSku = (log.sku || '').toUpperCase();
    const cleanLogSku = logSku.replace(/[-\s_]/g, '');
    return logSku === raw || cleanLogSku === cleanRaw;
  });

  const flaggedEntries: SkuAuditLogEntry[] = [];
  let hasQuarantine = false;
  let hasDamaged = false;

  for (const entry of matchingLogs) {
    const check = isAuditEntryQuarantineOrDamaged(entry);
    if (check.isFlagged) {
      flaggedEntries.push(entry);
      if (check.isQuarantine) hasQuarantine = true;
      if (check.isDamaged) hasDamaged = true;
    }
  }

  if (flaggedEntries.length === 0) {
    return {
      isSafe: true,
      flagType: null,
      statusLabel: 'Clean (No Quarantine or Damage Flags)',
      flaggedEntries: []
    };
  }

  // Sort flagged entries by timestamp descending (newest write-off/hold first)
  flaggedEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const flagType: 'quarantine' | 'damaged' | 'both' =
    hasQuarantine && hasDamaged ? 'both' : hasQuarantine ? 'quarantine' : 'damaged';

  const statusLabel =
    flagType === 'both'
      ? 'Under Quarantine & Damaged'
      : flagType === 'quarantine'
      ? 'Under Quarantine'
      : 'Damaged';

  return {
    isSafe: false,
    flagType,
    statusLabel,
    flaggedEntries,
    primaryFlaggedEntry: flaggedEntries[0]
  };
}

/**
 * Quick boolean checker for whether a SKU is flagged in audit logs.
 */
export function isSkuAuditFlagged(sku: string, logs?: SkuAuditLogEntry[]): boolean {
  return !checkSkuAuditLogSafety(sku, logs).isSafe;
}
