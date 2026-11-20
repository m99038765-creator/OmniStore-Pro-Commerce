import { jsPDF } from 'jspdf';
import { Product, SkuAuditLogEntry } from '../types';
import {
  isAuditEntryDamagedClearance,
  isAuditEntryQuarantineClearance,
  isAuditEntryQuarantineOrDamaged
} from './skuAuditSafety';

export type ComplianceEntryTag =
  | 'QUARANTINE'
  | 'DAMAGED'
  | 'MANUAL ADJ'
  | 'CLEARED';

export interface WeeklyComplianceEntry {
  id: string;
  timestamp: string;
  formattedDate: string;
  sku: string;
  productName: string;
  warehouse: string;
  operatorId: string;
  adjustmentType: SkuAuditLogEntry['adjustmentType'];
  adjustmentValue: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes?: string;
  isQuarantine: boolean;
  isDamaged: boolean;
  isManualAdjustment: boolean;
  isClearance: boolean;
  tags: ComplianceEntryTag[];
}

export interface WarehouseComplianceBreakdown {
  warehouse: string;
  totalEntries: number;
  quarantineCount: number;
  damageCount: number;
  manualAdjustmentCount: number;
  netDelta: number;
}

export interface WeeklyComplianceAuditSummary {
  reportId: string;
  generatedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  generatedBy: string;
  totalEntries: number;
  quarantineCount: number;
  damageCount: number;
  manualAdjustmentCount: number;
  clearanceCount: number;
  netStockDelta: number;
  totalAbsVariance: number;
  uniqueSkusAffected: number;
  warehousesCovered: number;
  warehouseBreakdown: WarehouseComplianceBreakdown[];
  entries: WeeklyComplianceEntry[];
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isAutomatedOperator(entry: SkuAuditLogEntry): boolean {
  const op = `${entry.operatorId || ''} ${entry.operatorName || ''}`.toLowerCase();
  return (
    op.includes('sys-auto') ||
    op.includes('automated gantry') ||
    op.includes('automated pos') ||
    op.includes('robot')
  );
}

function formatShortTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${min}`;
}

function formatDateOnly(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Aggregates all quarantine, damage, and manual stock adjustment audit entries
 * from the last 7 days into a structured Weekly Compliance Audit dataset.
 */
export function aggregateWeeklyComplianceAuditData(
  auditLogs: SkuAuditLogEntry[],
  products: Product[],
  generatedBy = 'Warehouse Compliance Officer'
): WeeklyComplianceAuditSummary {
  const now = new Date();
  const periodStart = new Date(now.getTime() - SEVEN_DAYS_MS);
  const cutoffMs = periodStart.getTime();

  const productBySku = new Map<string, Product>();
  products.forEach((p) => productBySku.set(p.sku.toUpperCase(), p));

  const entries: WeeklyComplianceEntry[] = [];

  for (const log of auditLogs) {
    const parsedTime = new Date(log.timestamp).getTime();
    if (Number.isNaN(parsedTime) || parsedTime < cutoffMs || parsedTime > now.getTime() + 60_000) {
      continue;
    }

    const safety = isAuditEntryQuarantineOrDamaged(log);
    const clearsQuarantine = isAuditEntryQuarantineClearance(log);
    const clearsDamaged = isAuditEntryDamagedClearance(log);
    const isClearance = clearsQuarantine || clearsDamaged;

    const isQuarantine = safety.isQuarantine || clearsQuarantine;
    const isDamaged = safety.isDamaged || clearsDamaged;
    const isManualAdjustment = !isAutomatedOperator(log);

    // Include any entry that is a quarantine event, damage event, or manual stock adjustment
    if (!isQuarantine && !isDamaged && !isManualAdjustment) {
      continue;
    }

    const tags: ComplianceEntryTag[] = [];
    if (safety.isQuarantine) tags.push('QUARANTINE');
    if (safety.isDamaged) tags.push('DAMAGED');
    if (isClearance) tags.push('CLEARED');
    if (isManualAdjustment) tags.push('MANUAL ADJ');

    const matchedProd = productBySku.get((log.sku || '').toUpperCase());

    entries.push({
      id: log.id,
      timestamp: log.timestamp,
      formattedDate: formatShortTimestamp(log.timestamp),
      sku: log.sku,
      productName: log.productName || matchedProd?.name || log.sku,
      warehouse: log.warehouse || matchedProd?.warehouse || 'Bay Area Hub (WH-01)',
      operatorId: log.operatorId || 'OP-ADMIN',
      adjustmentType: log.adjustmentType,
      adjustmentValue: log.adjustmentValue,
      previousStock: log.previousStock,
      newStock: log.newStock,
      reason: log.reason || 'Manual stock adjustment',
      notes: log.notes,
      isQuarantine: safety.isQuarantine,
      isDamaged: safety.isDamaged,
      isManualAdjustment,
      isClearance,
      tags
    });
  }

  // Sort newest first
  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // Build per-warehouse breakdown
  const whMap = new Map<string, WarehouseComplianceBreakdown>();
  const uniqueSkus = new Set<string>();
  let quarantineCount = 0;
  let damageCount = 0;
  let manualAdjustmentCount = 0;
  let clearanceCount = 0;
  let netStockDelta = 0;
  let totalAbsVariance = 0;

  entries.forEach((e) => {
    uniqueSkus.add(e.sku.toUpperCase());
    if (e.isQuarantine) quarantineCount += 1;
    if (e.isDamaged) damageCount += 1;
    if (e.isManualAdjustment) manualAdjustmentCount += 1;
    if (e.isClearance) clearanceCount += 1;
    netStockDelta += e.adjustmentValue;
    totalAbsVariance += Math.abs(e.adjustmentValue);

    const existing = whMap.get(e.warehouse) || {
      warehouse: e.warehouse,
      totalEntries: 0,
      quarantineCount: 0,
      damageCount: 0,
      manualAdjustmentCount: 0,
      netDelta: 0
    };
    existing.totalEntries += 1;
    if (e.isQuarantine) existing.quarantineCount += 1;
    if (e.isDamaged) existing.damageCount += 1;
    if (e.isManualAdjustment) existing.manualAdjustmentCount += 1;
    existing.netDelta += e.adjustmentValue;
    whMap.set(e.warehouse, existing);
  });

  const warehouseBreakdown = Array.from(whMap.values()).sort(
    (a, b) => b.totalEntries - a.totalEntries
  );

  const dateStamp = formatDateOnly(now).replace(/-/g, '');
  const hashSuffix = String(
    Math.abs(entries.length * 137 + totalAbsVariance * 29 + 1047) % 9000 + 1000
  );

  return {
    reportId: `WCAR-${dateStamp}-${hashSuffix}`,
    generatedAt: now,
    periodStart,
    periodEnd: now,
    generatedBy,
    totalEntries: entries.length,
    quarantineCount,
    damageCount,
    manualAdjustmentCount,
    clearanceCount,
    netStockDelta,
    totalAbsVariance,
    uniqueSkusAffected: uniqueSkus.size,
    warehousesCovered: warehouseBreakdown.length,
    warehouseBreakdown,
    entries
  };
}

/**
 * Generates and downloads a formatted multi-page 'Weekly Compliance Audit Report' PDF
 * covering all quarantine, damage, and manual stock adjustment entries from the last 7 days.
 */
export function downloadWeeklyComplianceAuditPdf(
  auditLogs: SkuAuditLogEntry[],
  products: Product[],
  generatedBy = 'Warehouse Compliance Officer'
): WeeklyComplianceAuditSummary {
  const summary = aggregateWeeklyComplianceAuditData(auditLogs, products, generatedBy);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 612 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt
  const marginX = 36;
  const contentWidth = pageWidth - marginX * 2;
  let y = 0;

  const drawPageFooter = (pageNum: number, totalPages: number) => {
    doc.setDrawColor(215, 222, 232);
    doc.setLineWidth(0.6);
    doc.line(marginX, pageHeight - 38, pageWidth - marginX, pageHeight - 38);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Weekly Compliance Audit Report · ${summary.reportId} · Confidential Internal Inventory Control`,
      marginX,
      pageHeight - 24
    );
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 24,
      { align: 'right' }
    );
  };

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 54) {
      doc.addPage();
      y = 42;
      return true;
    }
    return false;
  };

  // --- Header Banner ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 94, 'F');

  doc.setFillColor(16, 185, 129); // Emerald 500 accent bar
  doc.rect(0, 94, pageWidth, 3.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text('WEEKLY COMPLIANCE AUDIT REPORT', marginX, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    '7-Day Aggregated Ledger: Quarantine Holds, Damage Write-Offs & Manual Stock Adjustments',
    marginX,
    56
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Window: ${formatDateOnly(summary.periodStart)} to ${formatDateOnly(summary.periodEnd)}   |   Prepared By: ${summary.generatedBy}`,
    marginX,
    76
  );

  // Right-side Report ID Badge
  doc.setFillColor(30, 41, 59);
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(pageWidth - marginX - 148, 22, 148, 42, 6, 6, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(52, 211, 153);
  doc.text(summary.reportId, pageWidth - marginX - 74, 39, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Generated ${formatShortTimestamp(summary.generatedAt.toISOString())}`,
    pageWidth - marginX - 74,
    54,
    { align: 'center' }
  );

  y = 114;

  // --- Executive KPI Cards (4 columns) ---
  const kpiCards = [
    {
      label: 'TOTAL 7D EVENTS',
      value: String(summary.totalEntries),
      sub: `${summary.uniqueSkusAffected} SKUs · ${summary.warehousesCovered} Hubs`,
      accent: [14, 165, 233] as [number, number, number]
    },
    {
      label: 'QUARANTINE HOLDS',
      value: String(summary.quarantineCount),
      sub: summary.clearanceCount > 0 ? `${summary.clearanceCount} cleared in 7d` : 'QA / Isolation flags',
      accent: [245, 158, 11] as [number, number, number]
    },
    {
      label: 'DAMAGE INCIDENTS',
      value: String(summary.damageCount),
      sub: 'Write-offs & defects',
      accent: [244, 63, 94] as [number, number, number]
    },
    {
      label: 'MANUAL ADJUSTMENTS',
      value: String(summary.manualAdjustmentCount),
      sub: `Net ${summary.netStockDelta >= 0 ? `+${summary.netStockDelta}` : summary.netStockDelta}u (±${summary.totalAbsVariance}u)`,
      accent: [16, 185, 129] as [number, number, number]
    }
  ];

  const cardGap = 10;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 58;

  kpiCards.forEach((card, idx) => {
    const cx = marginX + idx * (cardWidth + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.8);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 6, 6, 'FD');

    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, y + 6, 3.5, cardHeight - 12, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cx + 10, y + 16);

    doc.setFont('courier', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, cx + 10, y + 36);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(card.sub, cx + 10, y + 49);
  });

  y += cardHeight + 18;

  // --- Regional Warehouse Compliance Breakdown ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Regional Warehouse Compliance Breakdown (Last 7 Days)', marginX, y);
  y += 10;

  if (summary.warehouseBreakdown.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, 30, 5, 5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('No quarantine, damage, or manual stock adjustment records logged within the past 7 days.', marginX + 12, y + 19);
    y += 44;
  } else {
    // Table Header
    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, y, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(248, 250, 252);
    doc.text('WAREHOUSE LOCATION', marginX + 8, y + 13);
    doc.text('TOTAL', marginX + 245, y + 13, { align: 'right' });
    doc.text('QUARANTINE', marginX + 320, y + 13, { align: 'right' });
    doc.text('DAMAGED', marginX + 392, y + 13, { align: 'right' });
    doc.text('MANUAL ADJ', marginX + 468, y + 13, { align: 'right' });
    doc.text('NET DELTA', marginX + contentWidth - 8, y + 13, { align: 'right' });
    y += 20;

    summary.warehouseBreakdown.forEach((wh, idx) => {
      ensureSpace(22);
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, 19, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + 19, marginX + contentWidth, y + 19);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(wh.warehouse, marginX + 8, y + 13);

      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(String(wh.totalEntries), marginX + 245, y + 13, { align: 'right' });
      doc.text(String(wh.quarantineCount), marginX + 320, y + 13, { align: 'right' });
      doc.text(String(wh.damageCount), marginX + 392, y + 13, { align: 'right' });
      doc.text(String(wh.manualAdjustmentCount), marginX + 468, y + 13, { align: 'right' });

      const deltaStr = wh.netDelta >= 0 ? `+${wh.netDelta}` : `${wh.netDelta}`;
      if (wh.netDelta < 0) doc.setTextColor(190, 18, 60);
      else if (wh.netDelta > 0) doc.setTextColor(5, 150, 105);
      else doc.setTextColor(71, 85, 105);
      doc.setFont('courier', 'bold');
      doc.text(`${deltaStr} u`, marginX + contentWidth - 8, y + 13, { align: 'right' });

      y += 19;
    });

    y += 18;
  }

  // --- Section 2: Quarantine & Damage Incident Highlight ---
  const incidentEntries = summary.entries.filter((e) => e.isQuarantine || e.isDamaged);
  ensureSpace(64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `2. Quarantine & Damage Incident Register (${incidentEntries.length} Flagged Record${incidentEntries.length === 1 ? '' : 's'})`,
    marginX,
    y
  );
  y += 10;

  if (incidentEntries.length === 0) {
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(marginX, y, contentWidth, 26, 5, 5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(6, 95, 70);
    doc.text(
      'Zero active quarantine or damage write-off incidents recorded in the last 7 days.',
      marginX + 10,
      y + 16
    );
    y += 38;
  } else {
    incidentEntries.forEach((inc) => {
      const reasonLines = doc.splitTextToSize(
        `${inc.reason}${inc.notes ? ` — ${inc.notes}` : ''}`,
        contentWidth - 20
      );
      const boxHeight = 28 + reasonLines.length * 10.5;
      ensureSpace(boxHeight + 6);

      doc.setFillColor(255, 241, 242);
      doc.setDrawColor(253, 164, 175);
      doc.roundedRect(marginX, y, contentWidth, boxHeight, 5, 5, 'FD');

      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(159, 18, 57);
      const flagLabel = [
        inc.isQuarantine ? 'QUARANTINE' : null,
        inc.isDamaged ? 'DAMAGED' : null
      ]
        .filter(Boolean)
        .join(' + ');
      doc.text(`[${flagLabel}] ${inc.sku}`, marginX + 10, y + 14);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(inc.productName.slice(0, 44), marginX + 160, y + 14);

      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${inc.formattedDate} · ${inc.warehouse.split('(')[0].trim()} · ${inc.operatorId}`,
        marginX + contentWidth - 10,
        y + 14,
        { align: 'right' }
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(reasonLines, marginX + 10, y + 26);

      y += boxHeight + 6;
    });
    y += 10;
  }

  // --- Section 3: Complete 7-Day Compliance Audit Ledger ---
  ensureSpace(64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    `3. Complete 7-Day Compliance Audit Ledger (${summary.entries.length} Entries)`,
    marginX,
    y
  );
  y += 10;

  const drawLedgerHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, contentWidth, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(248, 250, 252);
    doc.text('DATE / TIME', marginX + 6, y + 13);
    doc.text('SKU & HUB', marginX + 86, y + 13);
    doc.text('CLASSIFICATION', marginX + 194, y + 13);
    doc.text('DELTA', marginX + 292, y + 13, { align: 'right' });
    doc.text('OPERATOR & AUDIT REASON', marginX + 304, y + 13);
    y += 20;
  };

  if (summary.entries.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, y, contentWidth, 28, 5, 5, 'FD');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No qualifying compliance audit entries found for the last 7 days.', marginX + 10, y + 17);
    y += 38;
  } else {
    drawLedgerHeader();

    summary.entries.forEach((entry, idx) => {
      const reasonText = `${entry.operatorId} — ${entry.reason}${
        entry.notes ? ` (${entry.notes})` : ''
      }`;
      const wrappedReason = doc.splitTextToSize(reasonText, contentWidth - 310);
      const rowHeight = Math.max(26, wrappedReason.length * 9.5 + 10);

      if (ensureSpace(rowHeight + 2)) {
        drawLedgerHeader();
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(226, 232, 240);
      doc.line(marginX, y + rowHeight, marginX + contentWidth, y + rowHeight);

      // Date / Time
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text(entry.formattedDate, marginX + 6, y + 11);
      doc.setFontSize(6.8);
      doc.setTextColor(148, 163, 184);
      doc.text(entry.adjustmentType.toUpperCase(), marginX + 6, y + 21);

      // SKU & Hub
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(15, 23, 42);
      doc.text(entry.sku, marginX + 86, y + 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(entry.warehouse.split('(')[0].trim().slice(0, 20), marginX + 86, y + 21);

      // Classification tags
      const tagStr = entry.tags.join(' · ');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      if (entry.isDamaged) doc.setTextColor(190, 18, 60);
      else if (entry.isQuarantine) doc.setTextColor(180, 83, 9);
      else if (entry.isClearance) doc.setTextColor(5, 150, 105);
      else doc.setTextColor(3, 105, 161);
      const wrappedTags = doc.splitTextToSize(tagStr, 86);
      doc.text(wrappedTags, marginX + 194, y + 11);

      // Delta + Stock transition
      const deltaLabel =
        entry.adjustmentValue >= 0
          ? `+${entry.adjustmentValue}`
          : `${entry.adjustmentValue}`;
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.2);
      if (entry.adjustmentValue < 0) doc.setTextColor(190, 18, 60);
      else if (entry.adjustmentValue > 0) doc.setTextColor(5, 150, 105);
      else doc.setTextColor(71, 85, 105);
      doc.text(deltaLabel, marginX + 292, y + 11, { align: 'right' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${entry.previousStock}->${entry.newStock}`,
        marginX + 292,
        y + 21,
        { align: 'right' }
      );

      // Operator & Audit Reason
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.4);
      doc.setTextColor(30, 41, 59);
      doc.text(wrappedReason, marginX + 304, y + 11);

      y += rowHeight;
    });
  }

  // Add consistent footers to every page
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(p, totalPages);
  }

  const filename = `Weekly-Compliance-Audit-Report-${formatDateOnly(summary.generatedAt)}.pdf`;
  doc.save(filename);

  return summary;
}
