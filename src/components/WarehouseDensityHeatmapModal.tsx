import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import {
  X,
  MapPin,
  Layers,
  Flame,
  TrendingDown,
  Boxes,
  AlertTriangle,
  ShieldAlert,
  FileSearch,
  Sliders,
  Filter,
  Grid3x3,
  CheckCircle2
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import {
  AISLE_DEFINITIONS,
  BAY_DEFINITIONS,
  AisleBayCell,
  AisleDensitySummary,
  buildRegionalHubHeatmap,
  extractHubShortName,
  getRegionalHubList
} from '../utils/warehouseDensityHeatmap';

type ClusterFilterMode = 'all' | 'high' | 'low';

const SVG_WIDTH = 690;
const SVG_HEIGHT = 408;
const MARGIN = { top: 36, right: 64, bottom: 56, left: 112 };

export const WarehouseDensityHeatmapModal: React.FC = () => {
  const {
    isDensityHeatmapOpen,
    setIsDensityHeatmapOpen,
    products,
    warehouseAuditLogs,
    openGlobalSkuAuditLog,
    openAdminForProduct,
    customerDefaultWarehouse
  } = useStore();

  const regionalHubs = useMemo(() => getRegionalHubList(products), [products]);

  const [selectedHub, setSelectedHub] = useState<string>('');
  const [clusterFilter, setClusterFilter] = useState<ClusterFilterMode>('all');
  const [focusedAisleCode, setFocusedAisleCode] = useState<string | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    cell: AisleBayCell;
    x: number;
    y: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  // Sync initial selected hub with user's default hub or first available hub
  useEffect(() => {
    if (!isDensityHeatmapOpen) return;
    if (!selectedHub || !regionalHubs.includes(selectedHub)) {
      const matchedDefault = regionalHubs.find(
        h =>
          customerDefaultWarehouse &&
          extractHubShortName(h).toLowerCase() ===
            extractHubShortName(customerDefaultWarehouse).toLowerCase()
      );
      setSelectedHub(matchedDefault || regionalHubs[0] || 'Bay Area Hub (WH-01)');
    }
  }, [isDensityHeatmapOpen, regionalHubs, selectedHub, customerDefaultWarehouse]);

  // Escape key to close
  useEffect(() => {
    if (!isDensityHeatmapOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDensityHeatmapOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDensityHeatmapOpen, setIsDensityHeatmapOpen]);

  // Precompute summaries for every hub so regional hub selector pills display live telemetry
  const allHubSummaries = useMemo(() => {
    return regionalHubs.map(hub => buildRegionalHubHeatmap(hub, products, warehouseAuditLogs));
  }, [regionalHubs, products, warehouseAuditLogs]);

  const activeHubData = useMemo(() => {
    return (
      allHubSummaries.find(h => h.hubName === selectedHub) ||
      allHubSummaries[0] ||
      buildRegionalHubHeatmap('Bay Area Hub (WH-01)', products, warehouseAuditLogs)
    );
  }, [allHubSummaries, selectedHub, products, warehouseAuditLogs]);

  // Selected cell object (defaults to highest-density cell in the active hub)
  const inspectedCell: AisleBayCell | null = useMemo(() => {
    if (selectedCellId) {
      const exact = activeHubData.cells.find(c => c.id === selectedCellId);
      if (exact) return exact;
    }
    const sorted = [...activeHubData.cells].sort((a, b) => b.densityPct - a.densityPct);
    return sorted[0] || null;
  }, [activeHubData, selectedCellId]);

  // Render D3 heatmap whenever active hub, filter mode, aisle focus, or selected cell changes
  useEffect(() => {
    if (!isDensityHeatmapOpen || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const innerWidth = SVG_WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

    // Color scale: Deep Navy/Blue (Low) -> Teal/Emerald (Balanced) -> Amber/Coral-Red (High Density)
    const densityInterpolator = d3.interpolateRgbBasis([
      '#18181b',
      '#1e3a8a',
      '#0284c7',
      '#0d9488',
      '#10b981',
      '#f59e0b',
      '#ef4444'
    ]);
    const colorScale = d3.scaleSequential(densityInterpolator).domain([0, 100]);

    const xScale = d3
      .scaleBand<string>()
      .domain(BAY_DEFINITIONS.map(b => b.code))
      .range([0, innerWidth])
      .padding(0.11);

    const yScale = d3
      .scaleBand<string>()
      .domain(AISLE_DEFINITIONS.map(a => a.code))
      .range([0, innerHeight])
      .padding(0.14);

    // Ensure structural layers exist once
    let defs = svg.select<SVGDefsElement>('defs');
    if (defs.empty()) {
      defs = svg.append('defs');
      const grad = defs
        .append('linearGradient')
        .attr('id', 'd3-density-legend-gradient')
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

      const stops = [0, 15, 30, 50, 68, 84, 100];
      stops.forEach(pct => {
        grad
          .append('stop')
          .attr('offset', `${pct}%`)
          .attr('stop-color', colorScale(pct));
      });
    }

    let rootG = svg.select<SVGGElement>('g.heatmap-root');
    if (rootG.empty()) {
      rootG = svg
        .append('g')
        .attr('class', 'heatmap-root')
        .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

      rootG.append('g').attr('class', 'x-axis-labels');
      rootG.append('g').attr('class', 'y-axis-labels');
      rootG.append('g').attr('class', 'aisle-avg-labels');
      rootG.append('g').attr('class', 'cells-layer');
      rootG.append('g').attr('class', 'legend-layer');
    }

    // X-axis column headers (Bays B01..B06)
    rootG
      .select<SVGGElement>('g.x-axis-labels')
      .selectAll<SVGTextElement, { code: string; label: string }>('text')
      .data(BAY_DEFINITIONS, d => d.code)
      .join('text')
      .attr('x', d => (xScale(d.code) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', -12)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a3a3a3')
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('font-weight', '700')
      .text(d => d.label.toUpperCase());

    // Y-axis row headers (Aisles A1..A6)
    rootG
      .select<SVGGElement>('g.y-axis-labels')
      .selectAll<SVGTextElement, (typeof AISLE_DEFINITIONS)[number]>('text')
      .data(AISLE_DEFINITIONS, d => d.code)
      .join('text')
      .attr('x', -12)
      .attr('y', d => (yScale(d.code) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('fill', d => (focusedAisleCode === d.code ? '#38bdf8' : '#d4d4d4'))
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('font-weight', d => (focusedAisleCode === d.code ? '700' : '600'))
      .style('cursor', 'pointer')
      .text(d => d.shortName)
      .on('click', (_event, d) => {
        setFocusedAisleCode(prev => (prev === d.code ? null : d.code));
      });

    // Right margin per-aisle average utilization badges
    rootG
      .select<SVGGElement>('g.aisle-avg-labels')
      .selectAll<SVGTextElement, AisleDensitySummary>('text')
      .data<AisleDensitySummary>(activeHubData.aisles, d => d.aisleCode)
      .join('text')
      .attr('x', innerWidth + 12)
      .attr('y', d => (yScale(d.aisleCode) ?? 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
      .attr('font-weight', '700')
      .attr('fill', d =>
        d.avgDensityPct >= 65
          ? '#fb923c'
          : d.avgDensityPct >= 30
          ? '#34d399'
          : '#60a5fa'
      )
      .text(d => `${d.avgDensityPct}%`);

    const matchesFilter = (cell: AisleBayCell): boolean => {
      if (focusedAisleCode && cell.aisleCode !== focusedAisleCode) return false;
      if (clusterFilter === 'high') return cell.clusterTier === 'high';
      if (clusterFilter === 'low') return cell.clusterTier === 'low' || cell.clusterTier === 'empty';
      return true;
    };

    const getCellFill = (cell: AisleBayCell): string => {
      if (cell.units <= 0) return '#171717';
      return colorScale(cell.densityPct);
    };

    const getCellTextColor = (cell: AisleBayCell): string => {
      if (cell.units <= 0) return '#525252';
      // Bright emerald/amber mid-high band uses dark crisp ink for accessibility
      if (cell.densityPct >= 48 && cell.densityPct <= 84) return '#09090b';
      return '#f8fafc';
    };

    // Data join for 36 aisle × bay heatmap cells
    const cellGroups = rootG
      .select<SVGGElement>('g.cells-layer')
      .selectAll<SVGGElement, AisleBayCell>('g.heatmap-cell')
      .data<AisleBayCell>(activeHubData.cells, d => d.id)
      .join(
        enter => {
          const g = enter
            .append('g')
            .attr('class', 'heatmap-cell')
            .attr(
              'transform',
              d => `translate(${xScale(d.bayCode) ?? 0},${yScale(d.aisleCode) ?? 0})`
            )
            .style('cursor', 'pointer');

          g.append('rect')
            .attr('class', 'cell-rect')
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('fill', '#171717');

          g.append('text')
            .attr('class', 'cell-units')
            .attr('x', xScale.bandwidth() / 2)
            .attr('y', yScale.bandwidth() / 2 - 4)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
            .attr('font-size', '12px')
            .attr('font-weight', '800');

          g.append('text')
            .attr('class', 'cell-pct')
            .attr('x', xScale.bandwidth() / 2)
            .attr('y', yScale.bandwidth() / 2 + 11)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
            .attr('font-size', '9.5px')
            .attr('font-weight', '600');

          g.append('circle')
            .attr('class', 'cell-alert-dot')
            .attr('cx', xScale.bandwidth() - 8)
            .attr('cy', 8)
            .attr('r', 3.5);

          return g;
        },
        update => update,
        exit => exit.remove()
      );

    cellGroups
      .on('mouseenter', (event: MouseEvent, d: AisleBayCell) => {
        if (!chartWrapperRef.current) return;
        const bounds = chartWrapperRef.current.getBoundingClientRect();
        setHoveredCell({
          cell: d,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        });
      })
      .on('mousemove', (event: MouseEvent, d: AisleBayCell) => {
        if (!chartWrapperRef.current) return;
        const bounds = chartWrapperRef.current.getBoundingClientRect();
        setHoveredCell({
          cell: d,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        });
      })
      .on('mouseleave', () => {
        setHoveredCell(null);
      })
      .on('click', (_event: MouseEvent, d: AisleBayCell) => {
        setSelectedCellId(d.id);
      });

    // Smooth D3 transitions on cell fill, border, opacity, and typography
    cellGroups
      .transition()
      .duration(320)
      .attr('opacity', d => (matchesFilter(d) ? 1 : 0.16));

    cellGroups
      .select<SVGRectElement>('rect.cell-rect')
      .transition()
      .duration(320)
      .attr('fill', d => getCellFill(d))
      .attr('stroke', d => {
        if (inspectedCell?.id === d.id) return '#ffffff';
        if (d.hasQuarantineOrDamage) return '#fb7185';
        if (d.units <= 0) return '#262626';
        return 'rgba(255,255,255,0.12)';
      })
      .attr('stroke-width', d => {
        if (inspectedCell?.id === d.id) return 2.5;
        if (d.hasQuarantineOrDamage) return 1.5;
        return 1;
      })
      .attr('stroke-dasharray', d => (d.units <= 0 && inspectedCell?.id !== d.id ? '3,3' : 'none'));

    cellGroups
      .select<SVGTextElement>('text.cell-units')
      .attr('fill', d => getCellTextColor(d))
      .text(d => (d.units > 0 ? `${d.units}u` : '—'));

    cellGroups
      .select<SVGTextElement>('text.cell-pct')
      .attr('fill', d => getCellTextColor(d))
      .attr('fill-opacity', d => (d.units > 0 ? 0.8 : 0.55))
      .text(d => (d.units > 0 ? `${d.densityPct}%` : 'Empty'));

    cellGroups
      .select<SVGCircleElement>('circle.cell-alert-dot')
      .attr('fill', d =>
        d.hasQuarantineOrDamage
          ? '#f43f5e'
          : d.hasLowStockAlert
          ? '#fbbf24'
          : 'transparent'
      )
      .attr('stroke', d =>
        d.hasQuarantineOrDamage || d.hasLowStockAlert ? '#09090b' : 'transparent'
      )
      .attr('stroke-width', 1.2);

    // Continuous D3 gradient legend at bottom
    const legendG = rootG.select<SVGGElement>('g.legend-layer');
    legendG.selectAll('*').remove();

    const legendWidth = Math.min(280, innerWidth);
    const legendX = (innerWidth - legendWidth) / 2;
    const legendY = innerHeight + 22;

    legendG
      .append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', 10)
      .attr('rx', 5)
      .attr('fill', 'url(#d3-density-legend-gradient)')
      .attr('stroke', '#333333')
      .attr('stroke-width', 0.8);

    const legendTicks = [
      { pct: 0, label: '0% Empty' },
      { pct: 25, label: 'Low Cluster' },
      { pct: 55, label: 'Balanced' },
      { pct: 100, label: 'High Cluster (100%)' }
    ];

    legendTicks.forEach(tick => {
      legendG
        .append('text')
        .attr('x', legendX + (legendWidth * tick.pct) / 100)
        .attr('y', legendY + 24)
        .attr(
          'text-anchor',
          tick.pct === 0 ? 'start' : tick.pct === 100 ? 'end' : 'middle'
        )
        .attr('fill', '#a3a3a3')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, Menlo, monospace')
        .text(tick.label);
    });
  }, [isDensityHeatmapOpen, activeHubData, clusterFilter, focusedAisleCode, inspectedCell]);

  if (!isDensityHeatmapOpen) return null;

  return (
    <div
      id="warehouse-density-heatmap-backdrop"
      className="fixed inset-0 z-[75] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) setIsDensityHeatmapOpen(false);
      }}
    >
      <div
        id="warehouse-density-heatmap-modal"
        className="w-full max-w-6xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/70 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
              <Grid3x3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Warehouse Inventory Density Heatmap
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  D3 Spatial Matrix
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  {activeHubData.shortName} ({activeHubData.hubCode})
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Select a regional fulfillment hub to inspect high-density vs. low-density inventory clusters across every aisle and racking bay.
              </p>
            </div>
          </div>

          <button
            id="close-density-heatmap-modal-btn"
            type="button"
            onClick={() => setIsDensityHeatmapOpen(false)}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Close heatmap (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Regional Hub Selector + Cluster Filter Controls */}
        <div className="px-4 sm:px-5 py-3 bg-neutral-900/40 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
          {/* Regional Hub Selector Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mr-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-sky-400" />
              Regional Hub:
            </span>
            {allHubSummaries.map(hub => {
              const isActive = hub.hubName === activeHubData.hubName;
              return (
                <button
                  key={hub.hubName}
                  id={`density-hub-tab-${hub.hubCode.toLowerCase()}`}
                  type="button"
                  onClick={() => {
                    setSelectedHub(hub.hubName);
                    setSelectedCellId(null);
                    setFocusedAisleCode(null);
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-sky-500/20 text-white border-sky-400 ring-1 ring-sky-500/40 shadow-sm'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                  }`}
                >
                  <span>{hub.shortName}</span>
                  <span className="text-[10px] font-mono text-neutral-400">
                    {hub.hubCode}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      hub.avgDensityPct >= 65
                        ? 'bg-amber-500/20 text-amber-300'
                        : hub.avgDensityPct >= 30
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-sky-500/20 text-sky-300'
                    }`}
                  >
                    {hub.avgDensityPct}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* High vs. Low Cluster Isolation Filter */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-[11px]">
            <span className="px-1.5 text-neutral-500 flex items-center gap-1">
              <Filter className="w-3 h-3" />
            </span>
            <button
              id="density-filter-all-btn"
              type="button"
              onClick={() => setClusterFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                clusterFilter === 'all'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              All Bays ({activeHubData.cells.length})
            </button>
            <button
              id="density-filter-high-btn"
              type="button"
              onClick={() => setClusterFilter('high')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                clusterFilter === 'high'
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50'
                  : 'text-neutral-400 hover:text-amber-300'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>High ≥65% ({activeHubData.highClusterCount})</span>
            </button>
            <button
              id="density-filter-low-btn"
              type="button"
              onClick={() => setClusterFilter('low')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                clusterFilter === 'low'
                  ? 'bg-sky-500/25 text-sky-200 border border-sky-500/50'
                  : 'text-neutral-400 hover:text-sky-300'
              }`}
            >
              <TrendingDown className="w-3 h-3 text-sky-400" />
              <span>
                Low &lt;30% ({activeHubData.lowClusterCount + activeHubData.emptyBayCount})
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* Hub KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                Hub Floor Utilization
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                <span className="text-xl font-bold text-white">
                  {activeHubData.avgDensityPct}%
                </span>
                <span className="text-[11px] text-neutral-400">
                  ({activeHubData.totalUnits}/{activeHubData.totalCapacity}u)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-amber-500/30">
              <span className="text-[10px] font-mono uppercase text-amber-300/80 block">
                High-Density Clusters
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                <span className="text-xl font-bold text-amber-400">
                  {activeHubData.highClusterCount}
                </span>
                <span className="text-[11px] text-neutral-400">bays ≥65% full</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-sky-500/30">
              <span className="text-[10px] font-mono uppercase text-sky-300/80 block">
                Low / Sparse Clusters
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                <span className="text-xl font-bold text-sky-400">
                  {activeHubData.lowClusterCount + activeHubData.emptyBayCount}
                </span>
                <span className="text-[11px] text-neutral-400">
                  bays &lt;30% ({activeHubData.emptyBayCount} empty)
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                Primary Hub SKUs
              </span>
              <div className="mt-1 flex items-baseline gap-1.5 font-mono">
                <span className="text-xl font-bold text-emerald-400">
                  {activeHubData.hubProductsCount}
                </span>
                <span className="text-[11px] text-neutral-400">active catalog lines</span>
              </div>
            </div>
          </div>

          {/* Main Grid: Left D3 Heatmap (lg:col-span-8), Right Bay & Aisle Inspector (lg:col-span-4) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* D3 Heatmap Canvas */}
            <div className="lg:col-span-8 rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4 flex flex-col space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>Aisle × Bay Density Matrix — {activeHubData.shortName}</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Click any bay cell to inspect stored SKUs or click an aisle label to isolate a single aisle.
                  </p>
                </div>

                <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Flagged SKU
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Low Stock
                  </span>
                  {focusedAisleCode && (
                    <button
                      type="button"
                      onClick={() => setFocusedAisleCode(null)}
                      className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 cursor-pointer"
                    >
                      Clear Aisle Focus ({focusedAisleCode})
                    </button>
                  )}
                </div>
              </div>

              {/* D3 SVG Container + Interactive Hover Tooltip */}
              <div
                ref={chartWrapperRef}
                id="d3-warehouse-density-svg-wrapper"
                className="relative w-full rounded-xl bg-neutral-950 border border-neutral-800/90 p-2 overflow-hidden"
              >
                <svg
                  ref={svgRef}
                  id="d3-warehouse-density-svg"
                  viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                  className="w-full h-auto block select-none"
                  role="img"
                  aria-label={`D3 warehouse inventory density heatmap for ${activeHubData.hubName}`}
                />

                {hoveredCell && (
                  <div
                    className="pointer-events-none absolute z-20 rounded-xl bg-neutral-950/95 border border-neutral-700 px-3 py-2 shadow-2xl text-xs space-y-1 max-w-[230px] backdrop-blur-md"
                    style={{
                      left: `${Math.min(
                        Math.max(12, hoveredCell.x + 14),
                        (chartWrapperRef.current?.clientWidth || 500) - 240
                      )}px`,
                      top: `${Math.max(12, hoveredCell.y - 84)}px`
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-white">
                        {hoveredCell.cell.aisleCode} · {hoveredCell.cell.bayLabel}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                          hoveredCell.cell.clusterTier === 'high'
                            ? 'bg-amber-500/25 text-amber-200'
                            : hoveredCell.cell.clusterTier === 'moderate'
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'bg-sky-500/25 text-sky-200'
                        }`}
                      >
                        {hoveredCell.cell.densityPct}%
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-neutral-300">
                      {hoveredCell.cell.units} / {hoveredCell.cell.capacity} units stored
                    </div>
                    {hoveredCell.cell.skus[0] ? (
                      <div className="text-[10px] text-neutral-400 truncate">
                        SKU: <span className="font-mono text-sky-300">{hoveredCell.cell.skus[0].sku}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-500">Available open slot</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Selected Bay Inspector & Per-Aisle Cluster Breakdown */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              {/* Bay Inspector Card */}
              {inspectedCell && (
                <div
                  id="density-bay-inspector-card"
                  className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
                        Selected Racking Bay
                      </span>
                      <h5 className="text-sm font-bold text-white font-mono mt-0.5">
                        {activeHubData.hubCode} · {inspectedCell.aisleCode} · {inspectedCell.bayLabel}
                      </h5>
                      <span className="text-[11px] text-neutral-400">{inspectedCell.aisleName}</span>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border uppercase ${
                        inspectedCell.clusterTier === 'high'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : inspectedCell.clusterTier === 'moderate'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : inspectedCell.clusterTier === 'low'
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                      }`}
                    >
                      {inspectedCell.clusterTier === 'high'
                        ? 'High Cluster'
                        : inspectedCell.clusterTier === 'moderate'
                        ? 'Balanced'
                        : inspectedCell.clusterTier === 'low'
                        ? 'Low Cluster'
                        : 'Empty Bay'}
                    </span>
                  </div>

                  {/* Density Gauge */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-neutral-400">Bay Density</span>
                      <span className="font-bold text-white">
                        {inspectedCell.units} / {inspectedCell.capacity} units ({inspectedCell.densityPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-950 border border-neutral-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          inspectedCell.clusterTier === 'high'
                            ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                            : inspectedCell.clusterTier === 'moderate'
                            ? 'bg-gradient-to-r from-teal-500 to-emerald-400'
                            : 'bg-gradient-to-r from-blue-600 to-sky-400'
                        }`}
                        style={{ width: `${inspectedCell.densityPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Bay SKUs */}
                  <div className="pt-2 border-t border-neutral-800/80 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
                      Assigned SKU Inventory
                    </span>

                    {inspectedCell.skus.length === 0 ? (
                      <div className="p-3 rounded-xl bg-neutral-950 border border-dashed border-neutral-800 text-xs text-neutral-500 text-center">
                        Open capacity slot ready for inbound pallet slotting.
                      </div>
                    ) : (
                      inspectedCell.skus.map(skuProd => (
                        <div
                          key={skuProd.id}
                          className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-mono font-bold text-sky-400 block">
                                {skuProd.sku}
                              </span>
                              <p className="text-xs font-semibold text-white truncate">
                                {skuProd.name}
                              </p>
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                              {skuProd.stock}u live
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {inspectedCell.hasQuarantineOrDamage && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                <ShieldAlert className="w-3 h-3" />
                                Audit Flagged
                              </span>
                            )}
                            {inspectedCell.hasLowStockAlert && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <AlertTriangle className="w-3 h-3" />
                                Below Threshold ({skuProd.lowStockThreshold}u)
                              </span>
                            )}
                            {!inspectedCell.hasQuarantineOrDamage && !inspectedCell.hasLowStockAlert && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35">
                                <CheckCircle2 className="w-3 h-3" />
                                Optimal Bin Health
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => openGlobalSkuAuditLog(skuProd.sku, skuProd)}
                              className="py-1.5 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] font-semibold text-neutral-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileSearch className="w-3 h-3 text-amber-400" />
                              <span>Audit Log</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsDensityHeatmapOpen(false);
                                openAdminForProduct(skuProd);
                              }}
                              className="py-1.5 px-2 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-[11px] font-semibold text-sky-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Sliders className="w-3 h-3 text-sky-400" />
                              <span>Adjust Stock</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Aisle-by-Aisle High vs. Low Cluster Rollup */}
              <div className="rounded-2xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <Boxes className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Clusters Per Aisle</span>
                  </h5>
                  <span className="text-[10px] font-mono text-neutral-500">Click to focus</span>
                </div>

                <div className="space-y-1.5">
                  {activeHubData.aisles.map(aisle => {
                    const isFocused = focusedAisleCode === aisle.aisleCode;
                    return (
                      <button
                        key={aisle.aisleCode}
                        type="button"
                        onClick={() =>
                          setFocusedAisleCode(prev =>
                            prev === aisle.aisleCode ? null : aisle.aisleCode
                          )
                        }
                        className={`w-full text-left p-2 rounded-xl border transition-all cursor-pointer space-y-1 ${
                          isFocused
                            ? 'bg-sky-950/50 border-sky-500/70 ring-1 ring-sky-500/40'
                            : 'bg-neutral-950/70 hover:bg-neutral-900 border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono font-bold text-neutral-200 truncate">
                            {aisle.aisleName}
                          </span>
                          <span className="font-mono font-bold text-white shrink-0">
                            {aisle.avgDensityPct}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                          <div
                            className={`h-full ${
                              aisle.avgDensityPct >= 65
                                ? 'bg-amber-400'
                                : aisle.avgDensityPct >= 30
                                ? 'bg-emerald-400'
                                : 'bg-sky-400'
                            }`}
                            style={{ width: `${aisle.avgDensityPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                          <span className="text-amber-300/90">
                            High: {aisle.highClusterBays} bay{aisle.highClusterBays === 1 ? '' : 's'}
                          </span>
                          <span className="text-sky-300/90">
                            Low: {aisle.lowClusterBays} bay{aisle.lowClusterBays === 1 ? '' : 's'}
                          </span>
                          <span>{aisle.totalUnits}u</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
