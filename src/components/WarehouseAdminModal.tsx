import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Server,
  PackagePlus,
  Zap,
  Activity,
  AlertTriangle,
  Boxes,
  MapPin,
  RefreshCw,
  CheckCircle2,
  Users
} from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const WarehouseAdminModal: React.FC = () => {
  const {
    isAdminOpen,
    setIsAdminOpen,
    products,
    metrics,
    restockProduct,
    simulateExternalPurchase,
    connectionStatus
  } = useStore();

  const [simulating, setSimulating] = useState(false);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(5);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  if (!isAdminOpen) return null;

  const handleSimulate = async (productId?: string) => {
    setSimulating(true);
    setActionSuccess(null);
    const ok = await simulateExternalPurchase(productId);
    setSimulating(false);
    if (ok) {
      setActionSuccess('Simulated external order received! Watch stock drop live.');
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleRestock = async (productId: string) => {
    setRestockingId(productId);
    setActionSuccess(null);
    const ok = await restockProduct(productId, restockQty);
    setRestockingId(null);
    if (ok) {
      setActionSuccess(`Restocked +${restockQty} units! Broadcasted to all shoppers.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  return (
    <AnimatePresence>
      <div
        id="warehouse-admin-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setIsAdminOpen(false)}
      >
        <motion.div
          id="warehouse-admin-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-950 border border-neutral-800 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Server className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Live Inventory Control & Telemetry</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    REALTIME BROADCAST
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Authoritative multi-warehouse stock management with instant WebSocket synchronization.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsAdminOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Success Alert */}
          {actionSuccess && (
            <div className="bg-emerald-950/90 border-b border-emerald-800 px-5 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-neutral-800/80 bg-neutral-900/30">
            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Total Units In Stock</span>
              <span className="text-xl font-bold font-mono text-white mt-0.5 block">{metrics.unitsInStock}</span>
              <span className="text-[10px] text-neutral-400">across 3 automated hubs</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Low Stock Warnings</span>
              <span className={`text-xl font-bold font-mono mt-0.5 block ${metrics.lowStockItemsCount > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
                {metrics.lowStockItemsCount} SKUs
              </span>
              <span className="text-[10px] text-neutral-400">threshold ≤ 4 units</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Orders Settled Today</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">{metrics.ordersProcessedToday}</span>
              <span className="text-[10px] text-neutral-400">100% fraud cleared</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Active Feed Socket</span>
              <span className="text-sm font-bold font-mono text-emerald-400 mt-1 block flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {connectionStatus === 'connected' ? 'WebSocket Active' : 'SSE Stream Active'}
              </span>
              <span className="text-[10px] text-neutral-400">&lt; 15ms latency</span>
            </div>
          </div>

          {/* Simulation Playground Panel */}
          <div className="p-4 sm:p-5 bg-neutral-900/20 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Multi-User Concurrent Stress Test</span>
              </h4>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Simulate another shopper purchasing items simultaneously to verify live stock decrement on your screen.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="admin-simulate-order-button"
                onClick={() => handleSimulate()}
                disabled={simulating}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                {simulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Sim...</span>
                  </>
                ) : (
                  <>
                    <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Simulate External Order (Stock Drops Live)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Product Stock Table */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-neutral-300 uppercase tracking-wider">
                Live SKUs & Real-time Adjustment
              </span>
              <div className="flex items-center gap-2 text-neutral-400">
                <span>Restock Step:</span>
                {[5, 10, 25].map((qty) => (
                  <button
                    key={qty}
                    onClick={() => setRestockQty(qty)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                      restockQty === qty ? 'bg-emerald-500 text-neutral-950 font-bold' : 'bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    +{qty}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              {products.map((product) => {
                const isOutOfStock = product.stock <= 0;
                const isLowStock = product.stock > 0 && product.stock <= product.lowStockThreshold;

                return (
                  <div
                    key={product.id}
                    id={`admin-stock-row-${product.id}`}
                    className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-neutral-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={product.images[0]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover bg-neutral-950 shrink-0 border border-neutral-800"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-semibold text-white truncate max-w-sm">
                            {product.name}
                          </h5>
                          <span className="text-[10px] font-mono text-neutral-500 bg-neutral-950 px-1.5 py-0.5 rounded border border-neutral-800">
                            {product.sku}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-neutral-400 mt-0.5">
                          <span className="font-mono text-emerald-400 font-medium">
                            ${product.price.toFixed(2)}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            {product.warehouse.split('(')[0].trim()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      {/* Current Stock Badge */}
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className={`text-base font-bold font-mono ${
                            isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {product.stock} units
                          </span>
                        </div>
                        <span className="text-[10px] text-neutral-500 font-mono block">
                          {product.reserved > 0 ? `(${product.reserved} reserved)` : '0 active holds'}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSimulate(product.id)}
                          title="Simulate 1 purchase of this item"
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-mono transition-colors"
                        >
                          -1 Sim
                        </button>
                        <button
                          id={`admin-restock-${product.id}`}
                          onClick={() => handleRestock(product.id)}
                          disabled={restockingId === product.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors active:scale-95 disabled:opacity-50"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Restock +{restockQty}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
