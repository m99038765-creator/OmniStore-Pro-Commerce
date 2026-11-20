import React, { useMemo, useState } from 'react';
import {
  X,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ClipboardCheck,
  Sliders,
  MapPin,
  Activity
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import {
  computeInventoryIntegritySummary,
  SkuInventoryIntegrityRow,
  StockTrendPoint
} from '../utils/inventoryIntegritySummary';

interface InventoryIntegritySummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuditLog?: (product: Product) => void;
  onOpenStockAdjust?: (product: Product) => void;
  onSendToBatchReconcile?: (skus: string[]) => void;
}

type SortField =
  | 'status'
  | 'sku'
  | 'netChange30d'
  | 'totalDecreaseUnits30d'
  | 'recordedSalesUnits30d'
  | 'unmatchedDecreaseUnits'
  | 'integrityScore';

const TrendSparkline: React.FC<{ points: StockTrendPoint[]; hasAnomaly: boolean }> = ({
  points,
  hasAnomaly
}) => {
  if (!points || points.length === 0) return null;
  const width = 112;
  const height = 28;
  const padX = 4;
  const padY = 4;
  const stocks = points.map((p) => p.stock);
  const minVal = Math.min(...stocks);
  const maxVal = Math.max(...stocks);
  const span = Math.max(1, maxVal - minVal);

  const coords = points.map((pt, i) => {
    const x = padX + (i / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((pt.stock - minVal) / span) * (height - padY * 2);
    return { x, y, pt };
  });

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const strokeColor = hasAnomaly ? '#f43f5e' : '#10b981';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-label="30-day stock trend sparkline"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polylinePoints}
      />
      {coords.map((c, idx) =>
        c.pt.hasAnomaly ? (
          <g key={`anom-${idx}`}>
            <circle cx={c.x} cy={c.y} r="4.2" fill="#f43f5e" fillOpacity="0.28" />
            <circle cx={c.x} cy={c.y} r="2.3" fill="#fb7185" stroke="#fff" strokeWidth="0.6" />
          </g>
        ) : idx === coords.length - 1 ? (
          <circle key={`end-${idx}`} cx={c.x} cy={c.y} r="2" fill={strokeColor} />
        ) : null
      )}
    </svg>
  );
};

export const InventoryIntegritySummaryModal: React.FC<InventoryIntegritySummaryModalProps> = ({
  isOpen,
  onClose,
  onOpenAuditLog,
  onOpenStockAdjust,
  onSendToBatchReconcile
}) => {
  const { products, orders, warehouseAuditLogs, addAlert } = useStore();

  const [filterMode, setFilterMode] = useState<'all' | 'anomalies' | 'verified'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('unmatchedDecreaseUnits');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const report = useMemo(
    () => computeInventoryIntegritySummary(products, orders, warehouseAuditLogs),
    [products, orders, warehouseAuditLogs]
  );

  const warehouses = useMemo(() => {
    const set = new Set(report.rows.map((r) => r.shortWarehouse));
    return ['all', ...Array.from(set)];
  }, [report.rows]);

  const filteredAndSortedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = report.rows.filter((row) => {
      if (filterMode === 'anomalies' && row.status === 'verified') return false;
      if (filterMode === 'verified' && row.status !== 'verified') return false;
      if (warehouseFilter !== 'all' && row.shortWarehouse !== warehouseFilter) return false;
      if (q) {
        const hit =
          row.sku.toLowerCase().includes(q) ||
          row.productName.toLowerCase().includes(q) ||
          row.warehouse.toLowerCase().includes(q) ||
          (row.primaryAnomalyReason || '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const statusRank = { critical_anomaly: 3, anomaly: 2, verified: 1 };

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'sku') {
        cmp = a.sku.localeCompare(b.sku);
      } else if (sortField === 'status') {
        cmp = statusRank[a.status] - statusRank[b.status];
      } else {
        cmp = (a[sortField] as number) - (b[sortField] as number);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [report.rows, filterMode, warehouseFilter, searchQuery, sortField, sortDir]);

  if (!isOpen) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir(field === 'sku' ? 'asc' : 'desc');
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'SKU',
      'Product Name',
      'Warehouse',
      '30d Start Stock',
      'Current Stock',
      '30d Net Delta',
      'Total Decreases (30d)',
      'Recorded Sales (30d)',
      'Unmatched Non-Sales Decreases',
      'Est. Shrinkage Exposure ($)',
      'Integrity Score (%)',
      'Anomaly Status',
      'Primary Anomaly Reason'
    ];

    const csvRows = filteredAndSortedRows.map((r) =>
      [
        r.sku,
        `"${r.productName.replace(/"/g, '""')}"`,
        `"${r.warehouse}"`,
        r.startStock30d,
        r.currentStock,
        r.netChange30d,
        r.totalDecreaseUnits30d,
        r.recordedSalesUnits30d,
        r.unmatchedDecreaseUnits,
        r.estimatedShrinkageValue,
        r.integrityScore,
        r.status.toUpperCase(),
        `"${(r.primaryAnomalyReason || 'All decreases matched to sales records').replace(/"/g, '""')}"`
      ].join(',')
    );

    const blob = new Blob([[headers.join(','), ...csvRows].join('\r\n')], {
      type: 'text/csv;charset=utf-8;'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Inventory-Integrity-Summary-30d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addAlert(
      'success',
      'Integrity Summary Exported',
      `Downloaded 30-day Inventory Integrity Summary CSV (${filteredAndSortedRows.length} SKUs).`
    );
  };

  const renderStatusBadge = (row: SkuInventoryIntegrityRow) => {
    if (row.status === 'critical_anomaly') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/25 text-rose-200 border border-rose-500/60">
          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
          <span>Critical: No Sales Record</span>
        </span>
      );
    }
    if (row.status === 'anomaly') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/20 text-amber-200 border border-amber-500/50">
          <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Anomaly: Unmatched Drop</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
        <span>Sales Verified</span>
      </span>
    );
  };

  const anomalySkus = report.rows
    .filter((r) => r.status !== 'verified')
    .map((r) => r.sku);

  return (
    <div
      id="inventory-integrity-summary-modal-backdrop"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        id="inventory-integrity-summary-modal"
        onClick={(e) => e.stopPropagation()}
        className="bg-neutral-950 border border-sky-500/35 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-100"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-950/70 via-neutral-900 to-neutral-900 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Inventory Integrity Summary (30-Day Trend)
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-500/20 text-rose-200 border border-rose-500/45">
                  {report.flaggedAnomalySkusCount} Non-Sales Drop Anomal{report.flaggedAnomalySkusCount === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Interactive 30-day stock fluctuation audit cross-referencing every inventory decrease against recorded customer sales orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSendToBatchReconcile && anomalySkus.length > 0 && (
              <button
                type="button"
                id="integrity-send-all-anomalies-reconcile-btn"
                onClick={() => {
                  onClose();
                  onSendToBatchReconcile(anomalySkus);
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/50 text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Batch Reconcile Anomalies ({anomalySkus.length})</span>
              </button>
            )}

            <button
              type="button"
              id="integrity-export-csv-btn"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
              aria-label="Close Inventory Integrity Summary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-5 py-3.5 bg-neutral-900/40 border-b border-neutral-800">
          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-500 block">
              30-Day Integrity Score
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span
                className={`text-xl font-bold font-mono ${
                  report.overallIntegrityPercent >= 90
                    ? 'text-emerald-400'
                    : report.overallIntegrityPercent >= 75
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {report.overallIntegrityPercent}%
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                {report.verifiedSkusCount}/{report.totalSkusAnalyzed} clean
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/35">
            <span className="text-[10px] font-mono uppercase text-rose-300/80 block">
              Unmatched Drop Anomalies
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono text-rose-400">
                {report.flaggedAnomalySkusCount} SKUs
              </span>
              <span className="text-[10px] font-mono text-rose-300/80">
                {report.criticalAnomalyCount} critical
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-amber-500/30">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">
              Non-Sales Stock Decreases
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-400">
                -{report.totalUnmatchedDecreaseUnits} u
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                ${report.estimatedAtRiskValue.toLocaleString()} est. value
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/90 border border-neutral-800">
            <span className="text-[10px] font-mono uppercase text-neutral-500 block">
              30-Day Sales Matched
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-bold font-mono text-sky-400">
                {report.totalRecordedSalesUnits30d} u
              </span>
              <span className="text-[10px] font-mono text-neutral-400">
                of {report.totalDecreaseUnits30d}u total drops
              </span>
            </div>
          </div>
        </div>

        {/* Interactive Filter & Search Toolbar */}
        <div className="px-5 py-3 bg-neutral-900/25 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs font-mono">
            <button
              type="button"
              id="integrity-filter-all-btn"
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                filterMode === 'all'
                  ? 'bg-neutral-800 text-white font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              All SKUs ({report.totalSkusAnalyzed})
            </button>
            <button
              type="button"
              id="integrity-filter-anomalies-btn"
              onClick={() => setFilterMode('anomalies')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 ${
                filterMode === 'anomalies'
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/50 font-bold'
                  : 'text-rose-300/80 hover:text-rose-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span>Anomalies Only ({report.flaggedAnomalySkusCount})</span>
            </button>
            <button
              type="button"
              id="integrity-filter-verified-btn"
              onClick={() => setFilterMode('verified')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 ${
                filterMode === 'verified'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/45 font-bold'
                  : 'text-neutral-400 hover:text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>Verified ({report.verifiedSkusCount})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                id="integrity-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, item, reason..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500/60"
              />
            </div>

            <select
              id="integrity-warehouse-filter"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-200 focus:outline-none focus:border-sky-500/60 cursor-pointer"
              aria-label="Filter by warehouse"
            >
              {warehouses.map((wh) => (
                <option key={wh} value={wh}>
                  {wh === 'all' ? 'All Warehouses' : wh}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Interactive 30-Day Fluctuation & Anomaly Table */}
        <div className="flex-1 overflow-auto">
          <table
            id="inventory-integrity-summary-table"
            className="w-full text-left border-collapse text-xs min-w-[820px]"
          >
            <thead className="sticky top-0 z-10 bg-neutral-900/95 backdrop-blur-xs border-b border-neutral-800 text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('sku')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    <span>SKU &amp; Product</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-2.5 px-3">30d Stock Trend</th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('netChange30d')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    <span>30d Delta</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('totalDecreaseUnits30d')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    <span>Decreases</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('recordedSalesUnits30d')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    <span>Sales Rec.</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('unmatchedDecreaseUnits')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer text-rose-300"
                  >
                    <span>No-Sale Drop</span>
                    <ArrowUpDown className="w-3 h-3 opacity-70" />
                  </button>
                </th>
                <th className="py-2.5 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('status')}
                    className="inline-flex items-center gap-1 hover:text-white cursor-pointer"
                  >
                    <span>Integrity Status</span>
                    <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/80">
              {filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-neutral-400">
                    No SKUs match the current integrity filter.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row) => {
                  const isExpanded = expandedSku === row.sku;
                  const hasAnomaly = row.status !== 'verified';
                  const matchedProduct = products.find((p) => p.id === row.productId);

                  return (
                    <React.Fragment key={row.productId}>
                      <tr
                        id={`integrity-row-${row.sku}`}
                        onClick={() => setExpandedSku(isExpanded ? null : row.sku)}
                        className={`transition-colors cursor-pointer ${
                          hasAnomaly
                            ? 'bg-rose-950/15 hover:bg-rose-950/25'
                            : 'hover:bg-neutral-900/70'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-neutral-500">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-sky-300">
                                  {row.sku}
                                </span>
                                <span className="text-[10px] font-mono text-neutral-500 inline-flex items-center gap-0.5">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {row.shortWarehouse}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-white truncate max-w-[230px]">
                                {row.productName}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <TrendSparkline points={row.trend30d} hasAnomaly={hasAnomaly} />
                            <span className="text-[10px] font-mono text-neutral-400">
                              {row.startStock30d}→<strong className="text-white">{row.currentStock}</strong>
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-mono">
                          <span
                            className={`inline-flex items-center gap-0.5 font-bold ${
                              row.netChange30d > 0
                                ? 'text-emerald-400'
                                : row.netChange30d < 0
                                ? 'text-rose-400'
                                : 'text-neutral-400'
                            }`}
                          >
                            {row.netChange30d > 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : row.netChange30d < 0 ? (
                              <TrendingDown className="w-3 h-3" />
                            ) : null}
                            <span>
                              {row.netChange30d > 0 ? `+${row.netChange30d}` : row.netChange30d}u
                            </span>
                          </span>
                          <span className="block text-[9px] text-neutral-500">
                            {row.fluctuationPercent > 0
                              ? `+${row.fluctuationPercent}%`
                              : `${row.fluctuationPercent}%`}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono text-neutral-300">
                          {row.totalDecreaseUnits30d > 0 ? `-${row.totalDecreaseUnits30d}u` : '0u'}
                        </td>

                        <td className="py-3 px-3 text-right font-mono">
                          <span className="text-sky-300 font-semibold">
                            {row.recordedSalesUnits30d}u
                          </span>
                          <span className="block text-[9px] text-neutral-500">
                            {row.orderCount30d} order{row.orderCount30d === 1 ? '' : 's'}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono">
                          {row.unmatchedDecreaseUnits > 0 ? (
                            <div>
                              <span className="font-bold text-rose-400">
                                -{row.unmatchedDecreaseUnits}u
                              </span>
                              <span className="block text-[9px] text-rose-300/80">
                                ${row.estimatedShrinkageValue.toLocaleString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-emerald-400/90 text-[11px]">0u</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {renderStatusBadge(row)}
                            <span className="text-[9px] font-mono text-neutral-500">
                              Integrity: {row.integrityScore}%
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row Investigation Panel */}
                      {isExpanded && (
                        <tr className="bg-neutral-900/80">
                          <td colSpan={7} className="px-6 py-4 border-t border-neutral-800/70">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-xs font-semibold text-white flex items-center gap-2">
                                  <span>
                                    30-Day Audit &amp; Sales Correlation Breakdown —{' '}
                                    <span className="font-mono text-sky-300">{row.sku}</span>
                                  </span>
                                  <span className="text-[10px] font-mono text-neutral-400">
                                    Restocked: +{row.restockedUnits30d}u · Sales Orders: -{row.recordedSalesUnits30d}u · Non-Sales Drops: -{row.unmatchedDecreaseUnits}u
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {hasAnomaly && onSendToBatchReconcile && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                        onSendToBatchReconcile([row.sku]);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-200 border border-orange-500/50 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <ClipboardCheck className="w-3 h-3 text-orange-400" />
                                      <span>Batch Reconcile</span>
                                    </button>
                                  )}
                                  {matchedProduct && onOpenAuditLog && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenAuditLog(matchedProduct);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <ClipboardList className="w-3 h-3 text-sky-400" />
                                      <span>Audit Log</span>
                                    </button>
                                  )}
                                  {matchedProduct && onOpenStockAdjust && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onClose();
                                        onOpenStockAdjust(matchedProduct);
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/40 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                                    >
                                      <Sliders className="w-3 h-3" />
                                      <span>Adjust Stock</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {row.anomalyEvents.length === 0 ? (
                                <div className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span>
                                    No unexplained stock decreases detected in the last 30 days. All inventory outflows correspond to verified sales orders or zero deductions occurred.
                                  </span>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-mono uppercase text-rose-300 font-bold block">
                                    Flagged Stock Decreases Without Corresponding Sales Record ({row.anomalyEvents.length})
                                  </span>
                                  {row.anomalyEvents.map((ev) => (
                                    <div
                                      key={ev.id}
                                      className="p-2.5 rounded-xl bg-rose-950/25 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]"
                                    >
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono font-bold text-rose-300">
                                            {ev.delta} units ({ev.previousStock} → {ev.newStock})
                                          </span>
                                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-rose-500/25 text-rose-200 border border-rose-500/45 font-bold">
                                            {ev.salesRecordStatus === 'no_sales_record'
                                              ? 'No Matching Sales Order'
                                              : 'Exceeds Sales Record'}
                                          </span>
                                          <span className="font-mono text-[10px] text-neutral-400">
                                            {ev.formattedDate} · {ev.operatorId}
                                          </span>
                                        </div>
                                        <p className="text-neutral-200">
                                          <strong>{ev.reason}</strong>
                                          {ev.notes ? ` — ${ev.notes}` : ''}
                                        </p>
                                      </div>
                                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 shrink-0 self-start sm:self-center">
                                        {ev.adjustmentType}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Legend */}
        <div className="px-5 py-2.5 bg-neutral-900/70 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-neutral-400">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Red sparkline dot = stock decreased without matching sales order
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Click any SKU row to inspect exact audit events
            </span>
          </div>
          <span>30-Day Window · Live Store Ledger</span>
        </div>
      </div>
    </div>
  );
};
