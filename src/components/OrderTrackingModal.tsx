import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, PackageCheck, Truck, CheckCircle2, Clock, MapPin, AlertCircle, Copy } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';

export const OrderTrackingModal: React.FC = () => {
  const { isTrackingOpen, setIsTrackingOpen, trackOrder, orders } = useStore();
  const [query, setQuery] = useState(orders[0]?.orderNumber || '');
  const [loading, setLoading] = useState(false);
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(orders[0] || null);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isTrackingOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setNotFound(false);
    const result = await trackOrder(query);
    setLoading(false);

    if (result) {
      setSearchedOrder(result);
    } else {
      // Check local orders list fallback
      const found = orders.find(
        o => o.orderNumber.toLowerCase() === query.trim().toLowerCase() ||
             o.trackingNumber.toLowerCase() === query.trim().toLowerCase()
      );
      if (found) {
        setSearchedOrder(found);
      } else {
        setSearchedOrder(null);
        setNotFound(true);
      }
    }
  };

  const copyTracking = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <AnimatePresence>
      <div
        id="order-tracking-modal-backdrop"
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
        onClick={() => setIsTrackingOpen(false)}
      >
        <motion.div
          id="order-tracking-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative bg-neutral-950 border border-neutral-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <PackageCheck className="w-5 h-5 text-sky-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Consignment & Logistics Tracker</h3>
                <span className="text-[11px] text-neutral-400">Real-time status across carrier network</span>
              </div>
            </div>

            <button
              onClick={() => setIsTrackingOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
            {/* Search Input */}
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter Order # (e.g. ORD-123456) or Tracking Code..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {loading ? 'Locating...' : 'Track'}
              </button>
            </form>

            {/* Not Found state */}
            {notFound && (
              <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs font-semibold text-white">No Matching Shipment Found</p>
                <p className="text-[11px] text-neutral-400">
                  Please verify your Order Number or Tracking Code. You can place an order via the store to generate a live consignment.
                </p>
              </div>
            )}

            {/* Order Details Display */}
            {searchedOrder && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-500 font-mono uppercase block">Order Reference</span>
                    <span className="font-mono font-bold text-white text-sm">{searchedOrder.orderNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-mono uppercase block">Tracking Number</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-sky-400 font-bold">{searchedOrder.trackingNumber}</span>
                      <button
                        onClick={() => copyTracking(searchedOrder.trackingNumber)}
                        className="text-neutral-500 hover:text-white"
                        title="Copy tracking"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {copied && <span className="text-[10px] text-emerald-400">Copied!</span>}
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-500 font-mono uppercase block">Target Delivery</span>
                    <span className="font-semibold text-white">{searchedOrder.estimatedDeliveryDate}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-3">
                    Shipment Journey
                  </h4>
                  <div className="space-y-4">
                    {searchedOrder.timeline.map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-xs">
                        <div className="mt-0.5">
                          {event.completed ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : event.current ? (
                            <span className="flex h-4 w-4 items-center justify-center">
                              <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                            </span>
                          ) : (
                            <Clock className="w-4 h-4 text-neutral-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-baseline">
                            <span className={`font-semibold ${event.completed || event.current ? 'text-white' : 'text-neutral-500'}`}>
                              {event.status}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">{event.timestamp}</span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Location & Warehouse Origin */}
                <div className="p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800 text-xs text-neutral-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span>Destination:</span>
                    <span className="font-semibold text-white">
                      {searchedOrder.shipping.city}, {searchedOrder.shipping.state} {searchedOrder.shipping.postalCode}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Hub: {searchedOrder.warehouseAssigned}
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
