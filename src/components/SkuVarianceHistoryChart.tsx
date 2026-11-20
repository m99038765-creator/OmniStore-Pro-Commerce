import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Activity,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowRight
} from 'lucide-react';
import { SkuAuditLogEntry } from '../types';
import {
  isAuditEntryDamagedClearance,
  isAuditEntryQuarantineClearance,
  isAuditEntryQuarantineOrDamaged
} from '../utils/skuAuditSafety';

interface SkuVarianceHistoryChartProps {
  sku: string;
  logs: SkuAuditLogEntry[];
  currentStock: number;
  lowStockThreshold?: number;
  isLoading?: boolean;
}

export interface VarianceTimelinePoint {
  id: string;
  label: string;
  fullTimestamp: string;
  stockCount: number;
  previousStock: number;
  adjustmentValue: number;
  recordedDiscrepancy: number;
  signedVariance: number;
  cumulativeDiscrepancy: number;
  isDiscrepancyEvent: boolean;
  isFlaggedEvent: boolean;
  isClearanceEvent: boolean;
  isBaseline?: boolean;
  isLiveCheckpoint?: boolean;
  reason: string;
  operator: string;
  statusTag: string;
}

function classifyAuditDiscrepancy(entry: SkuAuditLogEntry): {
  isDiscrepancy: boolean;
  isFlagged: boolean;
  isClearance: boolean;
  statusTag: string;
} {
  const isClearance =
    isAuditEntryDamagedClearance(entry) ||
    isAuditEntryQuarantineClearance(entry) ||
    (entry.reason || '').toLowerCase().includes('batch clear & reconcile') ||
    (entry.reason || '').toLowerCase().includes('regional conflict reconciled');

  if (isClearance) {
    return {
      isDiscrepancy: false,
      isFlagged: false,
      isClearance: true,
      statusTag: 'Cleared / Reconciled'
    };
  }

  const safety = isAuditEntryQuarantineOrDamaged(entry);
  if (safety.isFlagged) {
    return {
      isDiscrepancy: true,
      isFlagged: true,
      isClearance: false,
      statusTag: safety.statusLabel
    };
  }

  const combined = `${entry.reason || ''} ${entry.notes || ''}`.toLowerCase();
  const isCycleVariance = entry.adjustmentType === 'cycle_count' && entry.adjustmentValue !== 0;
  const isNegativeWriteOff = entry.adjustmentType === 'subtract' && entry.adjustmentValue < 0;
  const hasDiscrepancyKeyword =
    combined.includes('discrepancy') ||
    combined.includes('variance') ||
    combined.includes('write-off') ||
    combined.includes('missing');

  if (isCycleVariance || isNegativeWriteOff || hasDiscrepancyKeyword) {
    return {
      isDiscrepancy: true,
      isFlagged: false,
      isClearance: false,
      statusTag:
        entry.adjustmentType === 'cycle_count'
          ? 'Cycle Count Variance'
          : isNegativeWriteOff
          ? 'Stock Reduction / Loss'
          : 'Audit Discrepancy'
    };
  }

  return {
    isDiscrepancy: false,
    isFlagged: false,
    isClearance: false,
    statusTag: entry.adjustmentType === 'restock' ? 'Restock Intake' : 'Standard Adjustment'
  };
}

function formatAxisLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Audit';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatFullTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function buildSkuVarianceTimeline(
  logs: SkuAuditLogEntry[],
  currentStock: number
): VarianceTimelinePoint[] {
  if (!logs || logs.length === 0) {
    return [
      {
        id: 'live-only',
        label: 'Live Now',
        fullTimestamp: formatFullTime(new Date().toISOString()),
        stockCount: currentStock,
        previousStock: currentStock,
        adjustmentValue: 0,
        recordedDiscrepancy: 0,
        signedVariance: 0,
        cumulativeDiscrepancy: 0,
        isDiscrepancyEvent: false,
        isFlaggedEvent: false,
        isClearanceEvent: false,
        isLiveCheckpoint: true,
        reason: 'Current live warehouse stock (no audit entries recorded yet)',
        operator: 'Live Inventory Feed',
        statusTag: 'Live Stock'
      }
    ];
  }

  const chronological = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const points: VarianceTimelinePoint[] = [];
  const earliest = chronological[0];
  const earliestMs = new Date(earliest.timestamp).getTime();
  const baselineIso = Number.isFinite(earliestMs)
    ? new Date(earliestMs - 4 * 60 * 60 * 1000).toISOString()
    : earliest.timestamp;

  // Opening baseline point derived from the earliest log's previousStock
  points.push({
    id: 'opening-baseline',
    label: 'Baseline',
    fullTimestamp: formatFullTime(baselineIso),
    stockCount: earliest.previousStock,
    previousStock: earliest.previousStock,
    adjustmentValue: 0,
    recordedDiscrepancy: 0,
    signedVariance: 0,
    cumulativeDiscrepancy: 0,
    isDiscrepancyEvent: false,
    isFlaggedEvent: false,
    isClearanceEvent: false,
    isBaseline: true,
    reason: 'Opening inventory balance prior to earliest recorded audit entry',
    operator: 'Ledger Baseline',
    statusTag: 'Baseline'
  });

  let cumulativeDiscrepancy = 0;

  for (const entry of chronological) {
    const classification = classifyAuditDiscrepancy(entry);
    const recordedDiscrepancy = classification.isDiscrepancy
      ? Math.max(1, Math.abs(entry.adjustmentValue || 1))
      : 0;
    const signedVariance = classification.isDiscrepancy ? entry.adjustmentValue : 0;
    cumulativeDiscrepancy += recordedDiscrepancy;

    points.push({
      id: entry.id,
      label: formatAxisLabel(entry.timestamp),
      fullTimestamp: formatFullTime(entry.timestamp),
      stockCount: entry.newStock,
      previousStock: entry.previousStock,
      adjustmentValue: entry.adjustmentValue,
      recordedDiscrepancy,
      signedVariance,
      cumulativeDiscrepancy,
      isDiscrepancyEvent: classification.isDiscrepancy,
      isFlaggedEvent: classification.isFlagged,
      isClearanceEvent: classification.isClearance,
      reason: entry.reason,
      operator: entry.operatorName || entry.operatorId,
      statusTag: classification.statusTag
    });
  }

  // Final Live Checkpoint comparing current catalog stock to the latest master audit log balance
  const latest = chronological[chronological.length - 1];
  const liveDrift = currentStock - latest.newStock;
  const liveAbsDrift = Math.abs(liveDrift);
  cumulativeDiscrepancy += liveAbsDrift;

  points.push({
    id: 'live-checkpoint',
    label: 'Live Now',
    fullTimestamp: formatFullTime(new Date().toISOString()),
    stockCount: currentStock,
    previousStock: latest.newStock,
    adjustmentValue: liveDrift,
    recordedDiscrepancy: liveAbsDrift,
    signedVariance: liveDrift,
    cumulativeDiscrepancy,
    isDiscrepancyEvent: liveDrift !== 0,
    isFlaggedEvent: false,
    isClearanceEvent: false,
    isLiveCheckpoint: true,
    reason:
      liveDrift !== 0
        ? `Live catalog stock (${currentStock}u) differs from latest audit ledger balance (${latest.newStock}u)`
        : 'Live catalog stock matches latest audit ledger balance',
    operator: 'Live Inventory Feed',
    statusTag: liveDrift !== 0 ? `Live Drift (${liveDrift > 0 ? `+${liveDrift}` : liveDrift}u)` : 'Aligned'
  });

  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: VarianceTimelinePoint }>;
  metricMode: 'absolute' | 'signed';
}

const VarianceTooltip: React.FC<CustomTooltipProps> = ({ active, payload, metricMode }) => {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="rounded-xl bg-neutral-950/95 border border-neutral-700 p-3 shadow-2xl max-w-[280px] text-xs space-y-2 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-1.5">
        <span className="font-mono text-[10px] text-neutral-400 flex items-center gap-1">
          <Clock className="w-3 h-3 text-neutral-500" />
          {pt.fullTimestamp}
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
            pt.isFlaggedEvent || pt.isDiscrepancyEvent
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/45'
              : pt.isClearanceEvent
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/45'
              : 'bg-sky-500/15 text-sky-300 border-sky-500/35'
          }`}
        >
          {pt.statusTag}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
          <span className="text-[9px] uppercase font-mono text-sky-400 block">Stock Count</span>
          <div className="font-mono font-bold text-sm text-white flex items-center gap-1 mt-0.5">
            <span>{pt.stockCount}u</span>
            {!pt.isBaseline && pt.adjustmentValue !== 0 && (
              <span
                className={`text-[10px] ${
                  pt.adjustmentValue > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                ({pt.adjustmentValue > 0 ? `+${pt.adjustmentValue}` : pt.adjustmentValue})
              </span>
            )}
          </div>
        </div>

        <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800">
          <span className="text-[9px] uppercase font-mono text-rose-400 block">
            {metricMode === 'absolute' ? 'Audit Discrepancy' : 'Signed Variance'}
          </span>
          <div
            className={`font-mono font-bold text-sm mt-0.5 ${
              pt.recordedDiscrepancy > 0 ? 'text-rose-300' : 'text-emerald-400'
            }`}
          >
            {metricMode === 'absolute'
              ? `${pt.recordedDiscrepancy}u`
              : pt.signedVariance > 0
              ? `+${pt.signedVariance}u`
              : `${pt.signedVariance}u`}
          </div>
        </div>
      </div>

      <div className="space-y-0.5 text-[11px]">
        <p className="text-neutral-200 font-medium leading-snug">{pt.reason}</p>
        <p className="text-[10px] font-mono text-neutral-500">Operator: {pt.operator}</p>
      </div>
    </div>
  );
};

export const SkuVarianceHistoryChart: React.FC<SkuVarianceHistoryChartProps> = ({
  sku,
  logs,
  currentStock,
  lowStockThreshold,
  isLoading = false
}) => {
  const [metricMode, setMetricMode] = useState<'absolute' | 'signed'>('absolute');

  const timeline = useMemo(
    () => buildSkuVarianceTimeline(logs, currentStock),
    [logs, currentStock]
  );

  const stats = useMemo(() => {
    const stockValues = timeline.map(p => p.stockCount);
    const minStock = Math.min(...stockValues);
    const maxStock = Math.max(...stockValues);
    const discrepancyPoints = timeline.filter(p => p.isDiscrepancyEvent);
    const totalDiscrepancyUnits = discrepancyPoints.reduce(
      (sum, p) => sum + p.recordedDiscrepancy,
      0
    );
    const livePoint = timeline[timeline.length - 1];
    const liveDrift = livePoint?.isLiveCheckpoint ? livePoint.signedVariance : 0;

    return {
      minStock,
      maxStock,
      fluctuationRange: maxStock - minStock,
      discrepancyCount: discrepancyPoints.length,
      totalDiscrepancyUnits,
      liveDrift,
      discrepancyPoints: [...discrepancyPoints].reverse()
    };
  }, [timeline]);

  const varianceKey = metricMode === 'absolute' ? 'recordedDiscrepancy' : 'signedVariance';
  const varianceSeriesName =
    metricMode === 'absolute'
      ? 'Audit-Recorded Discrepancy (|units|)'
      : 'Signed Variance Delta (±units)';

  if (isLoading) {
    return (
      <div className="py-14 flex flex-col items-center justify-center text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
        <p className="text-xs text-neutral-400 font-mono">
          Building historical stock &amp; discrepancy variance curve for {sku}...
        </p>
      </div>
    );
  }

  return (
    <div id="sku-variance-history-panel" className="space-y-4">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-neutral-500">
              Stock Fluctuation Band
            </span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span className="text-base font-bold text-sky-300">
              {stats.minStock}–{stats.maxStock}
            </span>
            <span className="text-[11px] text-neutral-400">units</span>
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
              Δ {stats.fluctuationRange}u swing
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-neutral-500">
              Audit Discrepancies
            </span>
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span
              className={`text-base font-bold ${
                stats.discrepancyCount > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {stats.totalDiscrepancyUnits}u
            </span>
            <span className="text-[11px] text-neutral-400">
              across {stats.discrepancyCount} event{stats.discrepancyCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-neutral-500">
              Live vs. Audit Ledger
            </span>
            {stats.liveDrift !== 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-1.5 font-mono">
            <span
              className={`text-base font-bold ${
                stats.liveDrift !== 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {stats.liveDrift === 0
                ? 'Aligned'
                : `${stats.liveDrift > 0 ? `+${stats.liveDrift}` : stats.liveDrift}u drift`}
            </span>
            <span className="text-[11px] text-neutral-400">
              {stats.liveDrift === 0 ? '(0u variance)' : 'unreconciled'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Recharts Line Chart Card */}
      <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Stock Count vs. Audit-Recorded Discrepancies</span>
            </h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Chronological stock balance compared against flagged variances, cycle counts, and live ledger drift.
            </p>
          </div>

          {/* Metric View Toggle */}
          <div className="flex items-center bg-neutral-900 p-0.5 rounded-xl border border-neutral-800 text-[11px]">
            <button
              id="variance-mode-absolute-btn"
              type="button"
              onClick={() => setMetricMode('absolute')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                metricMode === 'absolute'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-500/45'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Discrepancy (|u|)
            </button>
            <button
              id="variance-mode-signed-btn"
              type="button"
              onClick={() => setMetricMode('signed')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                metricMode === 'signed'
                  ? 'bg-rose-500/20 text-rose-200 border border-rose-500/45'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Signed Delta (±u)
            </button>
          </div>
        </div>

        {/* Chart Container */}
        <div id="sku-variance-recharts-container" className="w-full h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timeline}
              margin={{ top: 12, right: 16, left: -8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#a3a3a3', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#333333' }}
                tickLine={{ stroke: '#333333' }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="stock"
                allowDecimals={false}
                tick={{ fill: '#38bdf8', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#0c4a6e' }}
                tickLine={{ stroke: '#0c4a6e' }}
                domain={[0, 'auto']}
                label={{
                  value: 'Stock (u)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 16,
                  fill: '#38bdf8',
                  fontSize: 10
                }}
              />
              <YAxis
                yAxisId="variance"
                orientation="right"
                allowDecimals={false}
                tick={{ fill: '#fb7185', fontSize: 10, fontFamily: 'monospace' }}
                axisLine={{ stroke: '#881337' }}
                tickLine={{ stroke: '#881337' }}
                domain={metricMode === 'absolute' ? [0, 'auto'] : ['auto', 'auto']}
                label={{
                  value: metricMode === 'absolute' ? 'Discrepancy (u)' : 'Variance (±u)',
                  angle: 90,
                  position: 'insideRight',
                  offset: 10,
                  fill: '#fb7185',
                  fontSize: 10
                }}
              />

              <Tooltip content={<VarianceTooltip metricMode={metricMode} />} />

              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
              />

              {typeof lowStockThreshold === 'number' && lowStockThreshold > 0 && (
                <ReferenceLine
                  yAxisId="stock"
                  y={lowStockThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{
                    value: `Min Threshold (${lowStockThreshold}u)`,
                    position: 'insideTopRight',
                    fill: '#fbbf24',
                    fontSize: 10
                  }}
                />
              )}

              {metricMode === 'signed' && (
                <ReferenceLine
                  yAxisId="variance"
                  y={0}
                  stroke="#525252"
                  strokeDasharray="3 3"
                />
              )}

              <Line
                yAxisId="stock"
                type="monotone"
                dataKey="stockCount"
                name="Stock Count (units)"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#0ea5e9', stroke: '#082f49', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={true}
              />

              <Line
                yAxisId="variance"
                type="monotone"
                dataKey={varianceKey}
                name={varianceSeriesName}
                stroke="#f43f5e"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (typeof cx !== 'number' || typeof cy !== 'number') return <g key={props.key} />;
                  const isAlert = Boolean(payload?.isDiscrepancyEvent);
                  return (
                    <circle
                      key={props.key}
                      cx={cx}
                      cy={cy}
                      r={isAlert ? 5.5 : 3}
                      fill={isAlert ? '#f43f5e' : '#525252'}
                      stroke={isAlert ? '#fecdd3' : '#171717'}
                      strokeWidth={isAlert ? 2 : 1.5}
                    />
                  );
                }}
                activeDot={{ r: 6.5, fill: '#f43f5e', stroke: '#ffffff', strokeWidth: 2 }}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recorded Discrepancy Events Log */}
      <div className="rounded-2xl bg-neutral-950 border border-neutral-800 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Audit-Recorded Discrepancy Checkpoints ({stats.discrepancyPoints.length})</span>
          </h5>
          <span className="text-[10px] font-mono text-neutral-500">
            Newest first · {timeline.length} timeline points plotted
          </span>
        </div>

        {stats.discrepancyPoints.length === 0 ? (
          <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/35 flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Zero audit-recorded discrepancies detected for <strong className="font-mono">{sku}</strong>. All historical stock fluctuations match authorized inflows and clearances.
            </span>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {stats.discrepancyPoints.map(pt => (
              <div
                key={pt.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-rose-950/25 border border-rose-500/40 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 border border-rose-400/50">
                      {pt.signedVariance >= 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      <span>
                        {pt.signedVariance > 0 ? `+${pt.signedVariance}u` : `${pt.signedVariance}u`}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-rose-300 font-semibold">
                      {pt.statusTag}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-neutral-400">
                      <span>{pt.previousStock}u</span>
                      <ArrowRight className="w-2.5 h-2.5 text-neutral-600" />
                      <span className="text-white font-semibold">{pt.stockCount}u</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-200 truncate">{pt.reason}</p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-neutral-400 block">
                    {pt.fullTimestamp}
                  </span>
                  <span className="text-[10px] text-neutral-500 block">{pt.operator}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
