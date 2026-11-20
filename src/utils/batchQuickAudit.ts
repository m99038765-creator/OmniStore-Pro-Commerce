import { Product, SkuAuditLogEntry } from '../types';
import {
  checkSkuAuditLogSafety,
  isAuditEntryDamagedClearance,
  isAuditEntryQuarantineClearance,
  isAuditEntryQuarantineOrDamaged
} from './skuAuditSafety';

export type QuickAuditDiscrepancyCode =
  | 'quarantine_flag'
  | 'damaged_flag'
  | 'stock_mismatch'
  | 'warehouse_mismatch'
  | 'unreconciled_variance'
  | 'missing_audit_record';

export type QuickAuditSeverity = 'critical' | 'warning';

export interface QuickAuditIssue {
  code: QuickAuditDiscrepancyCode;
  severity: QuickAuditSeverity;
  label: string;
  detail: string;
  auditEntryId?: string;
}

export interface SkuQuickAuditResult {
  productId: string;
  sku: string;
  productName: string;
  product: Product;
  hasDiscrepancy: boolean;
  severity: 'critical' | 'warning' | 'clean';
  issues: QuickAuditIssue[];
  matchedAuditLogCount: number;
  latestAuditEntry: SkuAuditLogEntry | null;
  auditedStock: number;
  masterLogStock: number | null;
  stockDelta: number | null;
}

export interface BatchQuickAuditReport {
  ranAt: string;
  ranAtDisplay: string;
  totalChecked: number;
  discrepancySkuCount: number;
  verifiedSkuCount: number;
  criticalSkuCount: number;
  totalIssueCount: number;
  totalMasterLogEntriesScanned: number;
  resultsByProductId: Record<string, SkuQuickAuditResult>;
  discrepantItems: SkuQuickAuditResult[];
  verifiedItems: SkuQuickAuditResult[];
}

function normalizeSku(sku: string): string {
  return (sku || '').trim().toUpperCase();
}

function stripSkuDelimiters(sku: string): string {
  return normalizeSku(sku).replace(/[-\s_]/g, '');
}

function normalizeWarehouse(name?: string): string {
  return (name || '').split('(')[0].trim().toLowerCase();
}

function shortWarehouse(name?: string): string {
  return (name || '').split('(')[0].trim() || name || 'Unknown Hub';
}

function isClearanceOrReconcileEntry(entry: SkuAuditLogEntry): boolean {
  if (isAuditEntryDamagedClearance(entry) || isAuditEntryQuarantineClearance(entry)) {
    return true;
  }
  const combined = `${entry.reason || ''} ${entry.notes || ''}`.toLowerCase();
  return (
    combined.includes('batch clear & reconcile') ||
    combined.includes('regional conflict reconciled') ||
    combined.includes('auditor clearance') ||
    combined.includes('cleared by auditor')
  );
}

/**
 * Validates every selected SKU against the authoritative master audit log.
 * Checks:
 *  1. Active Quarantine / Damaged audit flags
 *  2. Live catalog stock count vs. latest master audit log balance (`newStock`)
 *  3. Assigned warehouse hub vs. latest master audit log hub
 *  4. Unreconciled negative variance / cycle-count / write-off entries
 *  5. Missing master audit log baseline for the SKU
 */
export function runBatchQuickAudit(
  selectedProducts: Product[],
  masterAuditLogs: SkuAuditLogEntry[],
  reconciledSkus: string[] = [],
  existingRanAt?: { ranAt: string; ranAtDisplay: string }
): BatchQuickAuditReport {
  const now = new Date();
  const ranAt = existingRanAt?.ranAt || now.toISOString();
  const ranAtDisplay =
    existingRanAt?.ranAtDisplay ||
    now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const reconciledSet = new Set(reconciledSkus.map(normalizeSku));
  const resultsByProductId: Record<string, SkuQuickAuditResult> = {};
  const discrepantItems: SkuQuickAuditResult[] = [];
  const verifiedItems: SkuQuickAuditResult[] = [];

  let totalIssueCount = 0;
  let criticalSkuCount = 0;

  for (const product of selectedProducts) {
    const skuNorm = normalizeSku(product.sku);
    const skuClean = stripSkuDelimiters(product.sku);

    const matchingLogs = masterAuditLogs
      .filter((entry) => {
        const entryNorm = normalizeSku(entry.sku);
        const entryClean = stripSkuDelimiters(entry.sku);
        return entryNorm === skuNorm || (skuClean.length > 0 && entryClean === skuClean);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const latestAuditEntry = matchingLogs[0] || null;
    const issues: QuickAuditIssue[] = [];

    // 1. Active Quarantine / Damaged safety flags
    const safety = checkSkuAuditLogSafety(product.sku, masterAuditLogs);
    if (!safety.isSafe) {
      const primary = safety.primaryFlaggedEntry;
      const operatorLabel = primary?.operatorName || primary?.operatorId;
      const operatorSuffix = operatorLabel ? ` (logged by ${operatorLabel})` : '';
      if (safety.flagType === 'quarantine' || safety.flagType === 'both') {
        issues.push({
          code: 'quarantine_flag',
          severity: 'critical',
          label: 'Under Quarantine',
          detail: `Active quarantine hold in master audit log: "${primary?.reason || 'Quarantine Inspection Hold'}"${operatorSuffix}.`,
          auditEntryId: primary?.id
        });
      }
      if (safety.flagType === 'damaged' || safety.flagType === 'both') {
        issues.push({
          code: 'damaged_flag',
          severity: 'critical',
          label: 'Damaged Flag',
          detail: `Active damage/defect flag in master audit log: "${primary?.reason || 'Damaged / Scrap Write-off'}"${operatorSuffix}.`,
          auditEntryId: primary?.id
        });
      }
    }

    // 2. Missing master audit baseline
    if (matchingLogs.length === 0) {
      issues.push({
        code: 'missing_audit_record',
        severity: 'warning',
        label: 'No Audit Baseline',
        detail: `No master audit log entries recorded for ${product.sku}. Run a physical cycle count to establish an audit baseline.`
      });
    } else if (latestAuditEntry) {
      // 3. Stock count mismatch against latest master audit log balance
      if (typeof latestAuditEntry.newStock === 'number' && latestAuditEntry.newStock !== product.stock) {
        const delta = product.stock - latestAuditEntry.newStock;
        const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
        issues.push({
          code: 'stock_mismatch',
          severity: 'critical',
          label: `Stock Drift (${deltaStr}u)`,
          detail: `Live stock (${product.stock}u) mismatches latest master audit balance (${latestAuditEntry.newStock}u from "${latestAuditEntry.reason}").`,
          auditEntryId: latestAuditEntry.id
        });
      }

      // 4. Warehouse hub mismatch against latest master audit entry
      const catalogWhNorm = normalizeWarehouse(product.warehouse);
      const logWhNorm = normalizeWarehouse(latestAuditEntry.warehouse);
      if (catalogWhNorm && logWhNorm && catalogWhNorm !== logWhNorm) {
        issues.push({
          code: 'warehouse_mismatch',
          severity: 'warning',
          label: 'Warehouse Hub Drift',
          detail: `Catalog hub "${shortWarehouse(product.warehouse)}" differs from latest master audit log hub "${shortWarehouse(latestAuditEntry.warehouse)}".`,
          auditEntryId: latestAuditEntry.id
        });
      }

      // 5. Unreconciled negative variance / cycle-count / write-off events since latest clearance
      if (!reconciledSet.has(skuNorm)) {
        const latestClearanceTs = matchingLogs.reduce((maxTs, entry) => {
          if (!isClearanceOrReconcileEntry(entry)) return maxTs;
          const ts = new Date(entry.timestamp).getTime();
          return Number.isFinite(ts) && ts > maxTs ? ts : maxTs;
        }, 0);

        const unreconciledVarianceEntry = matchingLogs.find((entry) => {
          if (isClearanceOrReconcileEntry(entry)) return false;
          const ts = new Date(entry.timestamp).getTime();
          if (latestClearanceTs > 0 && Number.isFinite(ts) && ts <= latestClearanceTs) {
            return false;
          }
          // Avoid duplicate alert if this exact entry is already captured as quarantine/damaged
          const entrySafety = isAuditEntryQuarantineOrDamaged(entry);
          if (entrySafety.isFlagged) return false;

          const combined = `${entry.reason || ''} ${entry.notes || ''}`.toLowerCase();
          return (
            (entry.adjustmentType === 'cycle_count' && entry.adjustmentValue !== 0) ||
            entry.adjustmentType === 'subtract' ||
            combined.includes('discrepancy') ||
            combined.includes('variance') ||
            combined.includes('write-off') ||
            combined.includes('missing')
          );
        });

        if (unreconciledVarianceEntry) {
          const val = unreconciledVarianceEntry.adjustmentValue;
          const valStr = val > 0 ? `+${val}u` : `${val}u`;
          const varianceOperator =
            unreconciledVarianceEntry.operatorName || unreconciledVarianceEntry.operatorId;
          issues.push({
            code: 'unreconciled_variance',
            severity: 'warning',
            label: `Unreconciled Variance (${valStr})`,
            detail: `Unreconciled audit adjustment "${unreconciledVarianceEntry.reason}" (${valStr}) by ${varianceOperator}.`,
            auditEntryId: unreconciledVarianceEntry.id
          });
        }
      }
    }

    const hasCritical = issues.some((i) => i.severity === 'critical');
    const hasDiscrepancy = issues.length > 0;
    const severity: 'critical' | 'warning' | 'clean' = hasCritical
      ? 'critical'
      : hasDiscrepancy
      ? 'warning'
      : 'clean';

    const masterLogStock =
      latestAuditEntry && typeof latestAuditEntry.newStock === 'number'
        ? latestAuditEntry.newStock
        : null;
    const stockDelta = masterLogStock !== null ? product.stock - masterLogStock : null;

    const result: SkuQuickAuditResult = {
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      product,
      hasDiscrepancy,
      severity,
      issues,
      matchedAuditLogCount: matchingLogs.length,
      latestAuditEntry,
      auditedStock: product.stock,
      masterLogStock,
      stockDelta
    };

    resultsByProductId[product.id] = result;
    totalIssueCount += issues.length;

    if (hasDiscrepancy) {
      discrepantItems.push(result);
      if (hasCritical) criticalSkuCount += 1;
    } else {
      verifiedItems.push(result);
    }
  }

  // Prioritize critical discrepancies first, then by issue count descending
  discrepantItems.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return b.issues.length - a.issues.length;
  });

  return {
    ranAt,
    ranAtDisplay,
    totalChecked: selectedProducts.length,
    discrepancySkuCount: discrepantItems.length,
    verifiedSkuCount: verifiedItems.length,
    criticalSkuCount,
    totalIssueCount,
    totalMasterLogEntriesScanned: masterAuditLogs.length,
    resultsByProductId,
    discrepantItems,
    verifiedItems
  };
}
