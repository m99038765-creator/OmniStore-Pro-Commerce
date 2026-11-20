import { SkuAuditLogEntry, SkuSafetyCheckResult } from '../types';
import { INITIAL_SKU_AUDIT_LOGS } from '../data/initialAuditLogs';

/**
 * Checks whether an audit log entry explicitly clears a previously applied Damaged flag.
 */
export function isAuditEntryDamagedClearance(entry: SkuAuditLogEntry): boolean {
  const reasonText = (entry.reason || '').toLowerCase();
  const notesText = (entry.notes || '').toLowerCase();
  const combined = `${reasonText} ${notesText}`;

  return (
    combined.includes('damaged flag cleared') ||
    combined.includes('damage flag cleared') ||
    combined.includes('damaged status cleared') ||
    combined.includes('cleared damaged') ||
    combined.includes('flags cleared') ||
    combined.includes('auditor clearance') ||
    combined.includes('cleared by auditor')
  );
}

/**
 * Checks whether an audit log entry explicitly clears a previously applied Quarantine flag.
 */
export function isAuditEntryQuarantineClearance(entry: SkuAuditLogEntry): boolean {
  const reasonText = (entry.reason || '').toLowerCase();
  const notesText = (entry.notes || '').toLowerCase();
  const combined = `${reasonText} ${notesText}`;

  return (
    combined.includes('quarantine cleared') ||
    combined.includes('quarantine flag cleared') ||
    combined.includes('quarantine released') ||
    combined.includes('released from quarantine') ||
    combined.includes('cleared quarantine') ||
    combined.includes('flags cleared') ||
    combined.includes('auditor clearance') ||
    combined.includes('cleared by auditor')
  );
}

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
  // Explicitly cleared Quarantine or Damaged status entries are clean resolution records, not active flags
  if (isAuditEntryDamagedClearance(entry) || isAuditEntryQuarantineClearance(entry)) {
    return {
      isFlagged: false,
      isQuarantine: false,
      isDamaged: false,
      flagType: null,
      statusLabel: 'Clean'
    };
  }

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

  // Evaluate chronologically (oldest -> newest) so auditor clearance entries supersede older flags
  const chronologicalLogs = [...matchingLogs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let quarantineEntries: SkuAuditLogEntry[] = [];
  let damagedEntries: SkuAuditLogEntry[] = [];

  for (const entry of chronologicalLogs) {
    const clearsQuarantine = isAuditEntryQuarantineClearance(entry);
    const clearsDamaged = isAuditEntryDamagedClearance(entry);

    if (clearsQuarantine || clearsDamaged) {
      if (clearsQuarantine) quarantineEntries = [];
      if (clearsDamaged) damagedEntries = [];
      continue;
    }

    const check = isAuditEntryQuarantineOrDamaged(entry);
    if (check.isFlagged) {
      if (check.isQuarantine) quarantineEntries.push(entry);
      if (check.isDamaged) damagedEntries.push(entry);
    }
  }

  const hasQuarantine = quarantineEntries.length > 0;
  const hasDamaged = damagedEntries.length > 0;

  // Deduplicate active flagged entries
  const flaggedMap = new Map<string, SkuAuditLogEntry>();
  for (const entry of [...quarantineEntries, ...damagedEntries]) {
    flaggedMap.set(entry.id, entry);
  }
  const flaggedEntries = Array.from(flaggedMap.values());

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
