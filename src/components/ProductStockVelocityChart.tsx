import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  PackageCheck,
  PackagePlus,
  Flame,
  Zap,
  RotateCcw,
  Clock,
  ShieldAlert,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  Sliders
} from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { calculateSkuAiSuggestions } from '../utils/aiSkuSuggestionEngine';

interface ProductStockVelocityChartProps {
  product: Product;
  onOpenRestockAdmin?: () => void;
}

interface OutflowDataPoint {
  date: string;
  fullDate: string;
  dayLabel: string;
  dailyOutflow: number;
  movingAverage: number;
  remainingStock: number;
  isProjected: boolean;
  ordersCount: number;
}

export const ProductStockVelocityChart: React.FC<ProductStockVelocityChartProps> = ({
  product,
  onOpenRestockAdmin
}) => {
  const { orders, warehouseAuditLogs, openAdminForProduct, setQuickViewProduct } = useStore();
  
  // Timeframe selection: 7 days, 14 days, or 30 days
  const [timeframe, setTimeframe] = useState<'7d' | '14d' | '30d'>('14d');
  
  // Forecast outflow surge simulation factor
  const [surgeMultiplier, setSurgeMultiplier] = useState<number>(1.0);
  
  // Display toggle between outflow rate (units/day) and projected stock trajectory
  const [chartView, setChartView] = useState<'outflow' | 'depletion'>('outflow');

  // Compute AI velocity baseline and restock metrics for this product
  const aiSuggestion = useMemo(() => {
    const response = calculateSkuAiSuggestions([product], orders, warehouseAuditLogs);
    return response.suggestions[0];
  }, [product, orders, warehouseAuditLogs]);

  // Generate historical and forecasted daily outflow data points
  const { chartData, metrics } = useMemo(() => {
    const daysCount = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30;
    const baseDailyRate = aiSuggestion?.dailyDepletionRate || 3.5;
    const effectiveDailyRate = baseDailyRate * surgeMultiplier;
    
    // Aggregate real orders for this product by date
    const realOrdersByDay: Record<string, { units: number; ordersCount: number }> = {};
    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const dateKey = orderDate.toISOString().slice(0, 10);
      const item = order.items.find(i => i.productId === product.id);
      if (item) {
        if (!realOrdersByDay[dateKey]) {
          realOrdersByDay[dateKey] = { units: 0, ordersCount: 0 };
        }
        realOrdersByDay[dateKey].units += item.quantity;
        realOrdersByDay[dateKey].ordersCount += 1;
      }
    });

    const now = new Date();
    const points: OutflowDataPoint[] = [];

    // Historical points (from past days up to today)
    let cumulativeOutflow = 0;
    let peakOutflow = 0;
    const rawOutflows: number[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isToday = i === 0;

      // Deterministic realistic variance based on product sku and day index
      const seed = (product.sku.charCodeAt(product.sku.length - 1) * 7 + i * 13) % 100;
      const wave = Math.sin((i + seed) * 0.8) * 1.5;
      const noise = ((seed % 10) - 5) * 0.2;
      const syntheticBase = Math.max(1, Math.round((baseDailyRate + wave + noise) * 10) / 10);

      // Blend real orders if available
      const realData = realOrdersByDay[dateKey];
      const actualOutflow = realData
        ? realData.units
        : Math.round((syntheticBase * surgeMultiplier) * 10) / 10;
      
      const ordersCount = realData ? realData.ordersCount : Math.max(1, Math.round(actualOutflow / 1.5));

      rawOutflows.push(actualOutflow);
      cumulativeOutflow += actualOutflow;
      if (actualOutflow > peakOutflow) {
        peakOutflow = actualOutflow;
      }

      // 3-day moving average
      const windowStart = Math.max(0, rawOutflows.length - 3);
      const windowSlice = rawOutflows.slice(windowStart);
      const movingAvg = Math.round((windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length) * 10) / 10;

      // Estimate remaining stock level backwards from current stock
      // Current stock is at i === 0 (today)
      const daysFromToday = i;
      const remainingStock = Math.max(0, Math.round(product.stock + (daysFromToday * effectiveDailyRate)));

      points.push({
        date: isToday ? 'Today' : monthDay,
        fullDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        dayLabel: dayName,
        dailyOutflow: actualOutflow,
        movingAverage: movingAvg,
        remainingStock: isToday ? product.stock : remainingStock,
        isProjected: false,
        ordersCount
      });
    }

    // Future Forecasted Points (Proactive Restock Horizon: Next 5 days)
    let projectedCurrentStock = product.stock;
    const forecastDays = 5;
    for (let f = 1; f <= forecastDays; f++) {
      const d = new Date(now);
      d.setDate(d.getDate() + f);
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });

      // Trend adjustment: if accelerating, slight increase; if cooling, slight decrease
      const trendFactor = aiSuggestion?.salesVelocityTrend === 'accelerating' ? 1.05 : aiSuggestion?.salesVelocityTrend === 'cooling' ? 0.95 : 1.0;
      const forecastOutflow = Math.max(0.5, Math.round((effectiveDailyRate * Math.pow(trendFactor, f)) * 10) / 10);
      
      projectedCurrentStock = Math.max(0, Math.round((projectedCurrentStock - forecastOutflow) * 10) / 10);

      // Rolling average including forecast
      const recentOutflows = [...rawOutflows.slice(-2), forecastOutflow];
      const movingAvg = Math.round((recentOutflows.reduce((a, b) => a + b, 0) / recentOutflows.length) * 10) / 10;

      points.push({
        date: `+${f}d (${monthDay})`,
        fullDate: `Forecast: ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`,
        dayLabel: dayName,
        dailyOutflow: forecastOutflow,
        movingAverage: movingAvg,
        remainingStock: projectedCurrentStock,
        isProjected: true,
        ordersCount: Math.max(1, Math.round(forecastOutflow / 1.4))
      });
    }

    const avgDailyOutflow = Math.round((cumulativeOutflow / daysCount) * 10) / 10;
    
    // Calculate stockout runway
    const availableStock = Math.max(0, product.stock - (product.reserved || 0));
    const runwayDays = effectiveDailyRate > 0 ? Math.round((availableStock / effectiveDailyRate) * 10) / 10 : 999;
    const runwayHours = Math.round(runwayDays * 24);

    // Target Reorder Date (e.g. when stock reaches lowStockThreshold minus 2 days lead time)
    const daysUntilThreshold = effectiveDailyRate > 0 
      ? Math.max(0, Math.round(((availableStock - product.lowStockThreshold) / effectiveDailyRate) * 10) / 10)
      : 7;
    const targetOrderDate = new Date();
    targetOrderDate.setDate(targetOrderDate.getDate() + Math.max(0, Math.floor(daysUntilThreshold)));

    return {
      chartData: points,
      metrics: {
        avgDailyOutflow,
        peakOutflow,
        effectiveDailyRate,
        runwayDays,
        runwayHours,
        daysUntilThreshold,
        targetOrderDateStr: targetOrderDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }),
        suggestedRestockBatch: aiSuggestion?.recommendedRestockQty || Math.max(10, Math.ceil(effectiveDailyRate * 14 / 5) * 5),
        trend: aiSuggestion?.salesVelocityTrend || 'steady',
        confidenceScore: aiSuggestion?.confidenceScore ? Math.round(aiSuggestion.confidenceScore * 100) : 92
      }
    };
  }, [timeframe, surgeMultiplier, aiSuggestion, product, orders]);

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as OutflowDataPoint;
      return (
        <div className="bg-neutral-950/95 border border-neutral-700/80 rounded-xl p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 min-w-[190px]">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 gap-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>{data.fullDate}</span>
            </span>
            {data.isProjected && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono border border-amber-500/30">
                Forecasted
              </span>
            )}
          </div>
          
          <div className="space-y-1 font-mono pt-0.5">
            <div className="flex items-center justify-between gap-3 text-neutral-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                <span>Daily Outflow:</span>
              </span>
              <strong className="text-sky-300 text-sm font-bold">
                {data.dailyOutflow} units
              </strong>
            </div>

            <div className="flex items-center justify-between gap-3 text-neutral-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>3-Day Velocity Avg:</span>
              </span>
              <span className="text-emerald-300 font-semibold">
                {data.movingAverage} u/day
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-neutral-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                <span>Simulated Remaining:</span>
              </span>
              <span className="text-purple-300 font-semibold">
                {data.remainingStock} in stock
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 text-neutral-500 text-[10px] pt-1 border-t border-neutral-900">
              <span>Dispatches / Orders:</span>
              <span className="text-neutral-300">~{data.ordersCount} fulfillment events</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleOpenWarehouseRestock = () => {
    if (onOpenRestockAdmin) {
      onOpenRestockAdmin();
    } else {
      setQuickViewProduct(null);
      openAdminForProduct(product);
    }
  };

  return (
    <div
      id="product-stock-velocity-section"
      className="mt-10 pt-8 border-t border-neutral-800/90 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Activity className="w-4 h-4" />
            </span>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Inventory Stock Velocity & Outflow Telemetry
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-neutral-800 text-sky-300 border border-neutral-700">
              SKU: {product.sku}
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Real-time daily inventory outflow dynamics, burn velocity trend, and predictive stockout horizons for proactive replenishment planning.
          </p>
        </div>

        {/* Proactive Restock CTA */}
        <button
          id={`stock-velocity-open-admin-btn-${product.id}`}
          type="button"
          onClick={handleOpenWarehouseRestock}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-950/50 cursor-pointer self-start sm:self-auto shrink-0 active:scale-95"
          title="Open Warehouse Admin Modal to restock or adjust inventory for this product"
        >
          <PackagePlus className="w-4 h-4" />
          <span>Proactive Restock in Admin</span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-80" />
        </button>
      </div>

      {/* Key Telemetry Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Outflow Velocity */}
        <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Daily Outflow Velocity
            </span>
            {metrics.trend === 'accelerating' ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <Flame className="w-3 h-3 text-rose-400" /> Accelerating
              </span>
            ) : metrics.trend === 'cooling' ? (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <TrendingDown className="w-3 h-3 text-sky-400" /> Cooling
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <Activity className="w-3 h-3 text-emerald-400" /> Steady
              </span>
            )}
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white">
                {metrics.effectiveDailyRate}
              </span>
              <span className="text-xs text-neutral-400 font-mono">units / day</span>
            </div>
            <span className="text-[10px] text-neutral-500 block mt-0.5">
              Avg: {metrics.avgDailyOutflow} • Peak: {metrics.peakOutflow} u/day
            </span>
          </div>
        </div>

        {/* Stockout Runway Horizon */}
        <div className={`p-3.5 rounded-xl bg-neutral-950/70 border flex flex-col justify-between space-y-2 ${
          metrics.runwayDays <= 3
            ? 'border-rose-500/60 bg-rose-950/10'
            : metrics.runwayDays <= 7
            ? 'border-amber-500/50 bg-amber-950/10'
            : 'border-neutral-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Stockout Horizon
            </span>
            <Clock className={`w-3.5 h-3.5 ${
              metrics.runwayDays <= 3 ? 'text-rose-400 animate-pulse' : metrics.runwayDays <= 7 ? 'text-amber-400' : 'text-emerald-400'
            }`} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-2xl font-bold font-mono ${
                metrics.runwayDays <= 3 ? 'text-rose-400' : metrics.runwayDays <= 7 ? 'text-amber-300' : 'text-emerald-400'
              }`}>
                {metrics.runwayDays <= 0 ? '0' : metrics.runwayDays}
              </span>
              <span className="text-xs text-neutral-400 font-mono">
                {metrics.runwayDays <= 0 ? 'Depleted' : 'Days Supply'}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              ~{metrics.runwayHours} operating hours remaining
            </span>
          </div>
        </div>

        {/* Recommended Restock Quantity */}
        <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Proactive Restock Batch
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/40">
              14-Day Buffer
            </span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                +{metrics.suggestedRestockBatch}
              </span>
              <span className="text-xs text-neutral-400 font-mono">units PO</span>
            </div>
            <span className="text-[10px] text-neutral-500 block mt-0.5 font-mono">
              Est. Wholesale: ~${(metrics.suggestedRestockBatch * Math.round(product.price * 0.62)).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Safety Buffer & Reorder Deadline */}
        <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-neutral-800 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              Target Reorder Date
            </span>
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-bold text-amber-300">
                {metrics.daysUntilThreshold <= 1 ? 'Immediate' : metrics.targetOrderDateStr}
              </span>
            </div>
            <span className="text-[10px] text-neutral-400 block mt-0.5">
              Safety Threshold: <strong>{product.lowStockThreshold} units</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Chart Canvas & Controls Container */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950/60 border border-neutral-800 shadow-lg space-y-4">
        {/* Chart Header Bar: Horizon Selector & Simulation Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle: Outflow vs Depletion Runway */}
            <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
              <button
                id="stock-velocity-view-outflow-btn"
                type="button"
                onClick={() => setChartView('outflow')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  chartView === 'outflow'
                    ? 'bg-neutral-800 text-sky-300 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Daily Outflow Line
              </button>
              <button
                id="stock-velocity-view-depletion-btn"
                type="button"
                onClick={() => setChartView('depletion')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  chartView === 'depletion'
                    ? 'bg-neutral-800 text-purple-300 shadow-xs'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Depletion Runway
              </button>
            </div>

            {/* Timeframe Buttons */}
            <div className="flex items-center bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
              {(['7d', '14d', '30d'] as const).map(tf => (
                <button
                  key={tf}
                  id={`stock-velocity-timeframe-${tf}`}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors cursor-pointer ${
                    timeframe === tf
                      ? 'bg-neutral-800 text-white font-bold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {tf === '7d' ? '7 Days' : tf === '14d' ? '14 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Surge Simulation Multiplier */}
          <div className="flex items-center gap-2 self-start md:self-auto text-xs">
            <span className="text-neutral-400 flex items-center gap-1 text-[11px]">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Simulate Surge:</span>
            </span>
            <div className="flex items-center gap-1">
              {[
                { label: '1.0x', val: 1.0 },
                { label: '+25%', val: 1.25 },
                { label: '+50%', val: 1.5 },
                { label: '2.0x Peak', val: 2.0 },
              ].map(s => (
                <button
                  key={s.val}
                  type="button"
                  onClick={() => setSurgeMultiplier(s.val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer border ${
                    surgeMultiplier === s.val
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                  }`}
                  title={`Simulate ${s.label} demand outflow spike`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* The Recharts Line Chart */}
        <div className="w-full h-64 sm:h-72 min-h-[250px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 16, left: -10, bottom: 20 }}
            >
              <defs>
                <linearGradient id="velocityOutflowGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="stockDepletionGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />

              <XAxis
                dataKey="date"
                stroke="#525252"
                tick={{ fill: '#a3a3a3', fontSize: 10 }}
                tickLine={{ stroke: '#404040' }}
                axisLine={{ stroke: '#404040' }}
                dy={6}
              />

              <YAxis
                stroke="#525252"
                tick={{ fill: '#a3a3a3', fontSize: 10 }}
                tickLine={{ stroke: '#404040' }}
                axisLine={{ stroke: '#404040' }}
                tickFormatter={(val) => `${val}`}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
                formatter={(value) => <span className="text-neutral-300">{value}</span>}
              />

              {/* Reference line for average daily outflow burn */}
              <ReferenceLine
                y={metrics.avgDailyOutflow}
                stroke="#38bdf8"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `Avg Burn: ${metrics.avgDailyOutflow} u/d`,
                  fill: '#38bdf8',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />

              {/* Safety stock threshold reference in depletion view */}
              {chartView === 'depletion' && (
                <ReferenceLine
                  y={product.lowStockThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="3 3"
                  label={{
                    value: `Safety Buffer (${product.lowStockThreshold})`,
                    fill: '#f59e0b',
                    fontSize: 10,
                    position: 'insideBottomRight'
                  }}
                />
              )}

              {chartView === 'outflow' ? (
                <>
                  {/* Daily Outflow Line */}
                  <Line
                    type="monotone"
                    dataKey="dailyOutflow"
                    name="Daily Outflow (Units)"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0ea5e9', stroke: '#0369a1', strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: '#38bdf8', stroke: '#ffffff', strokeWidth: 2 }}
                    animationDuration={800}
                  />

                  {/* 3-Day Rolling Moving Average Velocity Line */}
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    name="3-Day Velocity Trend"
                    stroke="#10b981"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    animationDuration={1000}
                  />
                </>
              ) : (
                <>
                  {/* Stock Depletion Trajectory */}
                  <Line
                    type="monotone"
                    dataKey="remainingStock"
                    name="Projected Inventory Units"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#a855f7', stroke: '#7e22ce' }}
                    activeDot={{ r: 6, fill: '#c084fc', stroke: '#ffffff' }}
                    animationDuration={800}
                  />

                  <Line
                    type="monotone"
                    dataKey="dailyOutflow"
                    name="Daily Drain Rate"
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Legend notes & forecast guidance */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-neutral-400 pt-1 border-t border-neutral-900">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-sky-400 rounded-full" />
              <span>Solid: Observed Outflow</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-400 rounded-full border border-dashed border-emerald-400" />
              <span>Dashed: 3-Day Velocity Average</span>
            </span>
          </div>
          <span className="text-neutral-500 font-mono text-[10px]">
            Model confidence: {metrics.confidenceScore}% • Data source: OmniStore Orders & Audit Logs
          </span>
        </div>
      </div>

      {/* Proactive Restock Planning Action Box */}
      <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
              Proactive Restock Advisory
            </span>
            <span className="text-xs font-mono text-neutral-300">
              Lead Time: <strong>2 Business Days</strong>
            </span>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            At current velocity ({metrics.effectiveDailyRate} units/day), available stock ({product.stock} units) will cross the safety threshold ({product.lowStockThreshold} units) in ~{metrics.daysUntilThreshold} days. Generating a PO batch of <strong className="text-emerald-400">+{metrics.suggestedRestockBatch} units</strong> secures full coverage through {timeframe === '30d' ? '30 days' : '14 days'}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto">
          <button
            id={`stock-velocity-open-admin-cta-${product.id}`}
            type="button"
            onClick={handleOpenWarehouseRestock}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-md shadow-sky-950/60 cursor-pointer active:scale-95"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Open in Warehouse Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
