import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Boxes,
  MapPin,
  Flame,
  Activity,
  Layers,
  Info,
  RefreshCw,
  Filter,
  Maximize2,
  Minimize2,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';

interface WarehouseD3HeatmapProps {
  products: Product[];
  onSelectSku?: (sku: string) => void;
}

interface ShelfCellData {
  id: string;
  aisle: string;
  rack: number;
  shelf: string;
  zoneLabel: string;
  warehouse: string;
  skuCount: number;
  totalStock: number;
  reservedStock: number;
  densityScore: number; // 0 to 100
  dominantCategory: string;
  sampleProduct?: Product;
  productsInCell: Product[];
}

const WAREHOUSE_HUBS = [
  'All Warehouses',
  'Bay Area Hub (WH-01)',
  'East Coast DC (WH-02)',
  'Midwest Logistics (WH-03)',
  'SoCal Studio Hub (WH-04)'
];

const AISLES = ['A', 'B', 'C', 'D', 'E', 'F'];
const RACKS = [1, 2, 3, 4, 5, 6];
const SHELVES = ['L1', 'L2', 'L3', 'L4'];

export const WarehouseD3Heatmap: React.FC<WarehouseD3HeatmapProps> = ({
  products,
  onSelectSku
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [selectedHub, setSelectedHub] = useState<string>('All Warehouses');
  const [metricMode, setMetricMode] = useState<'stock' | 'density' | 'reserved'>('density');
  const [selectedCell, setSelectedCell] = useState<ShelfCellData | null>(null);
  const [hoveredCell, setHoveredCell] = useState<ShelfCellData | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Generate grid data across Aisles, Racks, and Shelves mapped from current product inventory
  const heatmapGridData = useMemo(() => {
    const grid: ShelfCellData[] = [];
    let cellIndex = 0;

    AISLES.forEach(aisle => {
      RACKS.forEach(rack => {
        SHELVES.forEach(shelf => {
          const cellId = `${aisle}-R${rack}-${shelf}`;
          
          // Map products deterministically to cells based on product SKU and index
          const matchingProducts = products.filter((p, idx) => {
            const hash = (p.sku.charCodeAt(0) + idx * 7) % AISLES.length;
            const rackHash = (parseInt(p.id.replace(/\D/g, '') || '1') + rack) % RACKS.length;
            return AISLES[hash] === aisle && rackHash === (rack - 1);
          });

          const warehouseFiltered = selectedHub === 'All Warehouses'
            ? matchingProducts
            : matchingProducts.filter(p => p.warehouse === selectedHub);

          const totalStock = warehouseFiltered.reduce((sum, p) => sum + p.stock, 0);
          const reservedStock = warehouseFiltered.reduce((sum, p) => sum + (p.reserved || 0), 0);
          const skuCount = warehouseFiltered.length;

          // Compute density score (0 to 100 scale)
          const densityScore = Math.min(100, Math.round((totalStock * 1.5) + (skuCount * 10)));

          // Find dominant category
          const categoryCounts: Record<string, number> = {};
          warehouseFiltered.forEach(p => {
            categoryCounts[p.category] = (categoryCounts[p.category] || 0) + p.stock;
          });
          let dominantCategory = 'general';
          let maxCount = 0;
          Object.entries(categoryCounts).forEach(([cat, cnt]) => {
            if (cnt > maxCount) {
              maxCount = cnt;
              dominantCategory = cat;
            }
          });

          grid.push({
            id: cellId,
            aisle,
            rack,
            shelf,
            zoneLabel: `Zone ${aisle} • Rack ${rack} • Shelf ${shelf}`,
            warehouse: selectedHub === 'All Warehouses' ? 'Multi-Facility Distribution' : selectedHub,
            skuCount: warehouseFiltered.length,
            totalStock,
            reservedStock,
            densityScore,
            dominantCategory,
            sampleProduct: warehouseFiltered[0],
            productsInCell: warehouseFiltered
          });
          cellIndex++;
        });
      });
    });

    return grid;
  }, [products, selectedHub]);

  // Render D3 Heatmap Grid
  useEffect(() => {
    if (!svgRef.current || heatmapGridData.length === 0) return;

    const width = 720;
    const height = 360;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', '100%');

    const chartGroup = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // X scale for Racks (1 to 6) across Aisles (A to F)
    const xScale = d3.scaleBand()
      .domain(RACKS.map(r => `Rack ${r}`))
      .range([0, innerWidth])
      .padding(0.08);

    const yScale = d3.scaleBand()
      .domain(AISLES.map(a => `Aisle ${a}`))
      .range([0, innerHeight])
      .padding(0.08);

    // Color interpolation scale based on density score or stock
    const colorScale = d3.scaleSequential()
      .domain([0, 100])
      .interpolator(d3.interpolateTurbo); // Vibrant multi-hue heat map scale

    // Draw grid cells grouped by aisle
    AISLES.forEach(aisle => {
      const aisleCells = heatmapGridData.filter(d => d.aisle === aisle);

      const rowGroup = chartGroup.append('g')
        .attr('transform', `translate(0, ${yScale(`Aisle ${aisle}`) || 0})`);

      // Aisle label on the left
      rowGroup.append('text')
        .attr('x', -12)
        .attr('y', yScale.bandwidth() / 2 + 4)
        .attr('fill', '#a3a3a3')
        .attr('font-size', '11px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .text(aisle);

      rowGroup.selectAll<SVGRectElement, ShelfCellData>('rect')
        .data(aisleCells)
        .enter()
        .append('rect')
        .attr('x', (d: ShelfCellData) => xScale(`Rack ${d.rack}`) || 0)
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', yScale.bandwidth())
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('fill', (d: ShelfCellData) => {
          const val = metricMode === 'density' ? d.densityScore : metricMode === 'stock' ? Math.min(100, d.totalStock * 2) : Math.min(100, d.reservedStock * 10);
          return colorScale(val);
        })
        .attr('stroke', (d: ShelfCellData) => selectedCell?.id === d.id ? '#ffffff' : '#262626')
        .attr('stroke-width', (d: ShelfCellData) => selectedCell?.id === d.id ? 2 : 1)
        .attr('cursor', 'pointer')
        .style('transition', 'all 0.2s ease')
        .on('mouseenter', (event: MouseEvent, d: ShelfCellData) => {
          setHoveredCell(d);
          const [x, y] = d3.pointer(event, svgRef.current);
          setTooltipPos({ x: x + 15, y: y - 10 });
          d3.select<SVGRectElement, ShelfCellData>(event.currentTarget as SVGRectElement)
            .attr('stroke', '#38bdf8')
            .attr('stroke-width', 2);
        })
        .on('mouseleave', (event: MouseEvent, d: ShelfCellData) => {
          setHoveredCell(null);
          setTooltipPos(null);
          d3.select<SVGRectElement, ShelfCellData>(event.currentTarget as SVGRectElement)
            .attr('stroke', selectedCell?.id === d.id ? '#ffffff' : '#262626')
            .attr('stroke-width', selectedCell?.id === d.id ? 2 : 1);
        })
        .on('click', (event: MouseEvent, d: ShelfCellData) => {
          setSelectedCell(d);
        });

      // Cell text labels inside rectangles
      rowGroup.selectAll<SVGTextElement, ShelfCellData>('text.cell-label')
        .data(aisleCells)
        .enter()
        .append('text')
        .attr('x', (d: ShelfCellData) => (xScale(`Rack ${d.rack}`) || 0) + xScale.bandwidth() / 2)
        .attr('y', yScale.bandwidth() / 2 - 2)
        .attr('fill', '#ffffff')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text((d: ShelfCellData) => `${d.shelf}`);

      rowGroup.selectAll<SVGTextElement, ShelfCellData>('text.cell-sub')
        .data(aisleCells)
        .enter()
        .append('text')
        .attr('x', (d: ShelfCellData) => (xScale(`Rack ${d.rack}`) || 0) + xScale.bandwidth() / 2)
        .attr('y', yScale.bandwidth() / 2 + 12)
        .attr('fill', '#e5e5e5')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .attr('text-anchor', 'middle')
        .attr('pointer-events', 'none')
        .text((d: ShelfCellData) => `${d.totalStock}u`);
    });

    // X Axis labels for Racks at top
    const xAxisGroup = chartGroup.append('g')
      .attr('transform', `translate(0, -8)`);

    RACKS.forEach(rack => {
      xAxisGroup.append('text')
        .attr('x', (xScale(`Rack ${rack}`) || 0) + xScale.bandwidth() / 2)
        .attr('y', 0)
        .attr('fill', '#737373')
        .attr('font-size', '10px')
        .attr('font-family', 'monospace')
        .attr('text-anchor', 'middle')
        .text(`R${rack}`);
    });

  }, [heatmapGridData, metricMode, selectedCell]);

  // Totals summary across grid
  const gridTotals = useMemo(() => {
    const totalUnits = heatmapGridData.reduce((acc, c) => acc + c.totalStock, 0);
    const totalReserved = heatmapGridData.reduce((acc, c) => acc + c.reservedStock, 0);
    const totalSkus = heatmapGridData.reduce((acc, c) => acc + c.skuCount, 0);
    const maxDensityCell = [...heatmapGridData].sort((a, b) => b.densityScore - a.densityScore)[0];
    return { totalUnits, totalReserved, totalSkus, maxDensityCell };
  }, [heatmapGridData]);

  return (
    <div
      id="warehouse-d3-heatmap-container"
      className="p-4 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-xl space-y-5"
    >
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 shrink-0">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-white tracking-tight">
                D3.js Warehouse Density Heatmap
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                {gridTotals.totalUnits.toLocaleString()} units mapped
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Visualizes inventory density across aisle, rack, and shelf locations powered by D3.js interpolation scales.
            </p>
          </div>
        </div>

        {/* Heatmap Filters & Mode Switchers */}
        <div className="flex items-center gap-2 flex-wrap self-end lg:self-auto">
          {/* Warehouse Hub Selector */}
          <select
            id="heatmap-hub-select"
            value={selectedHub}
            onChange={(e) => setSelectedHub(e.target.value)}
            className="bg-neutral-950 border border-neutral-700 text-neutral-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono cursor-pointer"
          >
            {WAREHOUSE_HUBS.map(hub => (
              <option key={hub} value={hub}>{hub}</option>
            ))}
          </select>

          {/* Metric Mode Switcher */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              id="heatmap-mode-density-btn"
              type="button"
              onClick={() => setMetricMode('density')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                metricMode === 'density'
                  ? 'bg-neutral-800 text-sky-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Density Score
            </button>
            <button
              id="heatmap-mode-stock-btn"
              type="button"
              onClick={() => setMetricMode('stock')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                metricMode === 'stock'
                  ? 'bg-neutral-800 text-emerald-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Stock On Hand
            </button>
            <button
              id="heatmap-mode-reserved-btn"
              type="button"
              onClick={() => setMetricMode('reserved')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                metricMode === 'reserved'
                  ? 'bg-neutral-800 text-amber-300 font-bold shadow-xs'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Reserved Allocations
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Active Zones Mapped</span>
          <span className="text-lg font-bold font-mono text-white mt-0.5 block">{heatmapGridData.length} Bins</span>
        </div>
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Peak Density Bay</span>
          <span className="text-sm font-bold font-mono text-amber-300 mt-0.5 block truncate">
            {gridTotals.maxDensityCell ? `${gridTotals.maxDensityCell.zoneLabel} (${gridTotals.maxDensityCell.densityScore}/100)` : 'N/A'}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Total Units Stocked</span>
          <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">
            {gridTotals.totalUnits.toLocaleString()} units
          </span>
        </div>
        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 uppercase font-mono block">Reserved Allocations</span>
          <span className="text-lg font-bold font-mono text-amber-400 mt-0.5 block">
            {gridTotals.totalReserved.toLocaleString()} units
          </span>
        </div>
      </div>

      {/* Main D3 SVG Heatmap Canvas Container */}
      <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 relative overflow-hidden flex flex-col items-center justify-center">
        {/* Heatmap Legend Gradient Bar */}
        <div className="w-full flex items-center justify-between text-[10px] font-mono text-neutral-400 mb-2 px-2">
          <span>Low Density (0u)</span>
          <div className="flex-1 mx-4 h-2 rounded-full bg-gradient-to-r from-blue-600 via-emerald-500 via-yellow-400 to-rose-600 opacity-90" />
          <span>High Density (100+)</span>
        </div>

        {/* SVG Element */}
        <div className="w-full overflow-x-auto">
          <svg ref={svgRef} className="w-full h-auto min-w-[640px]" />
        </div>

        {/* Floating Tooltip on Hover */}
        {hoveredCell && tooltipPos && (
          <div
            className="absolute pointer-events-none z-30 p-2.5 rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl text-xs font-mono space-y-1 text-white backdrop-blur-md"
            style={{ left: Math.min(500, Math.max(20, tooltipPos.x)), top: Math.max(10, tooltipPos.y - 70) }}
          >
            <div className="font-bold text-sky-400 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              <span>{hoveredCell.zoneLabel}</span>
            </div>
            <div className="text-[11px] text-neutral-300">
              Facility: {hoveredCell.warehouse}
            </div>
            <div className="flex items-center gap-3 text-[11px] pt-1 border-t border-neutral-800">
              <span>Stock: <strong className="text-emerald-400">{hoveredCell.totalStock} units</strong></span>
              <span>Reserved: <strong className="text-amber-400">{hoveredCell.reservedStock}</strong></span>
              <span>Density: <strong className="text-rose-400">{hoveredCell.densityScore}/100</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* Selected Cell Inspection Drawer */}
      {selectedCell && (
        <div className="p-4 rounded-xl bg-neutral-950 border border-sky-500/40 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-sky-500/20 text-sky-300">
                <MapPin className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-sm font-bold text-white">
                  Bin Inspection: {selectedCell.zoneLabel}
                </h4>
                <span className="text-[11px] font-mono text-neutral-400">
                  {selectedCell.warehouse} • {selectedCell.productsInCell.length} SKU(s) stocked in this location
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedCell(null)}
              className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors"
            >
              Close Inspection
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedCell.productsInCell.length === 0 ? (
              <div className="col-span-full p-6 text-center text-xs text-neutral-500 italic">
                No active SKUs currently assigned to this specific shelf bin.
              </div>
            ) : (
              selectedCell.productsInCell.map(prod => (
                <div
                  key={prod.id}
                  className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={prod.images[0]}
                      alt={prod.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg object-cover bg-neutral-950 border border-neutral-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-sky-400 block truncate">
                        {prod.sku}
                      </span>
                      <h5 className="font-medium text-white truncate text-xs">{prod.name}</h5>
                    </div>
                  </div>

                  <div className="text-right shrink-0 font-mono">
                    <span className="text-emerald-400 font-bold block text-xs">{prod.stock}u</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectSku) onSelectSku(prod.sku);
                      }}
                      className="text-[10px] text-sky-400 hover:text-sky-300 underline mt-0.5 block cursor-pointer"
                    >
                      Filter SKU
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
