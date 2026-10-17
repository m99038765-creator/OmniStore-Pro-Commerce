import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BellRing,
  X,
  TrendingDown,
  Sparkles,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Mail,
  Zap,
  Tag,
  ArrowDownRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';

export const InventoryAlertModal: React.FC = () => {
  const {
    isInventoryAlertModalOpen,
    setIsInventoryAlertModalOpen,
    activeInventoryAlertProduct,
    setActiveInventoryAlertProduct,
    inventoryAlerts,
    setInventoryAlert,
    removeInventoryAlert,
    simulatePriceDrop,
    setQuickViewProduct,
    products,
    addAlert
  } = useStore();

  const [targetInput, setTargetInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [notifyOnRestock, setNotifyOnRestock] = useState<boolean>(false);
  const [notifyOnLowStock, setNotifyOnLowStock] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Warehouse Summary Shift Digest state
  const [shiftSelection, setShiftSelection] = useState<string>('Morning Shift (06:00)');
  const [digestEmailInput, setDigestEmailInput] = useState<string>('supervisor@omnistore.internal');
  const [scheduledDigests, setScheduledDigests] = useState<{ id: string; shift: string; email: string; timestamp: string }[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_scheduled_warehouse_digests');
      return saved ? JSON.parse(saved) : [
        { id: 'dg-1', shift: 'Morning Shift (06:00)', email: 'shift-lead-a@omnistore.internal', timestamp: new Date().toISOString() }
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_scheduled_warehouse_digests', JSON.stringify(scheduledDigests));
    } catch {}
  }, [scheduledDigests]);

  const lowStockItems = useMemo(() => {
    return products.filter(p => p.stock <= p.lowStockThreshold);
  }, [products]);

  const handleScheduleDigest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!digestEmailInput.trim()) return;
    const newEntry = {
      id: `dg-${Date.now()}`,
      shift: shiftSelection,
      email: digestEmailInput.trim(),
      timestamp: new Date().toISOString()
    };
    setScheduledDigests(prev => [newEntry, ...prev]);
    addAlert('success', 'Warehouse Summary Scheduled', `Low-stock shift digest scheduled for ${shiftSelection} to ${digestEmailInput}! (${lowStockItems.length} items currently below threshold).`);
  };

  const handleSendDigestNow = () => {
    addAlert('success', 'Warehouse Summary Dispatched', `Shift summary email successfully dispatched! Included ${lowStockItems.length} low-stock inventory items.`);
  };

  const handleRemoveDigest = (id: string) => {
    setScheduledDigests(prev => prev.filter(d => d.id !== id));
    addAlert('info', 'Digest Cancelled', 'Scheduled warehouse summary digest removed.');
  };

  const currentProduct: Product | null = activeInventoryAlertProduct;

  // Initialize form when an active product is passed
  useEffect(() => {
    if (currentProduct) {
      const existing = inventoryAlerts.find(a => a.productId === currentProduct.id);
      if (existing) {
        setTargetInput(existing.targetPrice.toFixed(2));
        setEmailInput(existing.notificationEmail || '');
      } else {
        // Default target: 10% below current price
        const def = (currentProduct.price * 0.9).toFixed(2);
        setTargetInput(def);
        setEmailInput('');
      }
    }
  }, [currentProduct, inventoryAlerts]);

  if (!isInventoryAlertModalOpen && !activeInventoryAlertProduct) {
    return null;
  }

  const handleClose = () => {
    setIsInventoryAlertModalOpen(false);
    setActiveInventoryAlertProduct(null);
  };

  const handleSetPreset = (discountPct: number) => {
    if (!currentProduct) return;
    const target = (currentProduct.price * (1 - discountPct / 100)).toFixed(2);
    setTargetInput(target);
  };

  const handleSaveAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) return;
    const val = parseFloat(targetInput);
    if (isNaN(val) || val <= 0) return;

    setInventoryAlert(currentProduct, val, emailInput);
    setActiveInventoryAlertProduct(null);
  };

  const handleSimulateDropForProduct = async (productId: string, discountPct: number = 15) => {
    setIsSimulating(true);
    await simulatePriceDrop(productId, discountPct);
    setIsSimulating(false);
  };

  return (
    <AnimatePresence>
      <div
        id="price-alerts-modal-backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md overflow-y-auto"
        onClick={handleClose}
      >
        <motion.div
          id="price-alerts-modal-dialog"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-800 bg-neutral-950/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Target Price Alerts
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Automated Radar
                  </span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Set target thresholds and receive instant audio & toast notifications when prices drop
                </p>
              </div>
            </div>

            <button
              id="close-price-alerts-modal-button"
              onClick={handleClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Active Product Setter Panel */}
            {currentProduct && (
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-amber-500/30 shadow-inner space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={currentProduct.images[0]}
                      alt={currentProduct.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-cover rounded-xl border border-neutral-800 bg-neutral-900 shrink-0"
                    />
                    <div>
                      <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider">
                        {currentProduct.sku}
                      </span>
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {currentProduct.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-neutral-400">Current Inventory Price:</span>
                        <span className="text-sm font-bold font-mono text-white">
                          ${currentProduct.price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveInventoryAlertProduct(null)}
                    className="text-xs text-neutral-400 hover:text-neutral-200"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveAlert} className="space-y-4 pt-2 border-t border-neutral-800">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        Target Trigger Price (USD)
                      </label>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {targetInput && !isNaN(parseFloat(targetInput)) && parseFloat(targetInput) < currentProduct.price
                          ? `(Save $${(currentProduct.price - parseFloat(targetInput)).toFixed(2)} / ${Math.round(
                              ((currentProduct.price - parseFloat(targetInput)) / currentProduct.price) * 100
                            )}% drop)`
                          : 'Must be below current price'}
                      </span>
                    </div>

                    {/* Quick discount presets */}
                    <div className="grid grid-cols-5 gap-2 mb-3">
                      {[5, 10, 15, 20, 25].map((pct) => {
                        const calculated = (currentProduct.price * (1 - pct / 100)).toFixed(2);
                        const isSelected = targetInput === calculated;
                        return (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => handleSetPreset(pct)}
                            className={`py-1.5 px-2 rounded-lg text-[11px] font-mono font-medium border transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                                : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                            }`}
                          >
                            -{pct}% (${calculated})
                          </button>
                        );
                      })}
                    </div>

                    {/* Manual Input */}
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400 font-mono font-bold text-sm">
                        $
                      </span>
                      <input
                        id="target-price-input"
                        type="number"
                        step="0.01"
                        min="1"
                        max={currentProduct.price}
                        value={targetInput}
                        onChange={(e) => setTargetInput(e.target.value)}
                        placeholder="Enter target dollar amount"
                        required
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>

                  {/* Optional Email input */}
                  <div>
                    <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5 mb-1.5">
                      <Mail className="w-3.5 h-3.5 text-neutral-400" />
                      Email Dispatch Notification (Optional)
                    </label>
                    <input
                      id="price-alert-email-input"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="e.g. procurement@omnistore.internal"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      disabled={isSimulating}
                      onClick={() => handleSimulateDropForProduct(currentProduct.id, 15)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl transition-all"
                      title="Trigger an automated 15% price drop to test alert firing immediately"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>{isSimulating ? 'Simulating...' : 'Test Drop Simulation'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95"
                      >
                        <BellRing className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Arm Target Alert</span>
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Automated Warehouse Summary & Low-Stock Shift Digest Section */}
            <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Warehouse Summary Shift Digest</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {lowStockItems.length} Low-Stock Items
                      </span>
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      Schedule automated shift email summaries for items below low-stock thresholds
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  id="send-digest-now-btn"
                  onClick={handleSendDigestNow}
                  className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-950/50 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Immediately dispatch low-stock summary email for current shift"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Send Digest Now</span>
                </button>
              </div>

              <form onSubmit={handleScheduleDigest} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-neutral-300 block mb-1">Target Shift</label>
                  <select
                    value={shiftSelection}
                    onChange={(e) => setShiftSelection(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Morning Shift (06:00)">Morning Shift (06:00)</option>
                    <option value="Afternoon Shift (14:00)">Afternoon Shift (14:00)</option>
                    <option value="Night Shift (22:00)">Night Shift (22:00)</option>
                    <option value="All Shifts (Continuous)">All Shifts (Continuous)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-neutral-300 block mb-1">Recipient Email / Channel</label>
                  <input
                    type="email"
                    value={digestEmailInput}
                    onChange={(e) => setDigestEmailInput(e.target.value)}
                    placeholder="supervisor@omnistore.internal"
                    required
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-bold text-xs border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Schedule Shift Digest</span>
                  </button>
                </div>
              </form>

              {scheduledDigests.length > 0 && (
                <div className="pt-2 border-t border-neutral-850 space-y-2">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Active Scheduled Shift Digests ({scheduledDigests.length})
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {scheduledDigests.map(dg => (
                      <div
                        key={dg.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-sky-400 font-bold shrink-0">{dg.shift}</span>
                          <span className="text-neutral-300 truncate">{dg.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDigest(dg.id)}
                          className="text-neutral-500 hover:text-rose-400 p-1"
                          title="Cancel scheduled digest"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* List of Active & Triggered Price Alerts */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
                  <span>Watched Catalog Items</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400">
                    {inventoryAlerts.length}
                  </span>
                </h3>

                {inventoryAlerts.length > 0 && (
                  <button
                    onClick={() => handleSimulateDropForProduct(inventoryAlerts[0]?.productId, 15)}
                    disabled={isSimulating}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Random Price Drop</span>
                  </button>
                )}
              </div>

              {inventoryAlerts.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-neutral-800/80 bg-neutral-950/40">
                  <div className="w-12 h-12 rounded-2xl bg-neutral-800/60 flex items-center justify-center text-neutral-500 mx-auto mb-3">
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-200">No Active Product Watches</h4>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1 leading-relaxed">
                    Track inventory stock levels or target price drops on any product card. OmniStore will monitor warehouse inventory adjustments and alert you in real time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {inventoryAlerts.map((alert, index) => {
                    const isTriggered = alert.status === 'triggered' || (alert.targetPrice ? alert.currentPrice <= alert.targetPrice : false);
                    const diff = alert.targetPrice ? alert.currentPrice - alert.targetPrice : 0;
                    const pctDiff = alert.targetPrice ? Math.round((diff / alert.currentPrice) * 100) : 0;

                    return (
                      <div
                        key={alert.id}
                        id={`price-alert-item-${alert.productId}`}
                        className={`p-4 rounded-xl border transition-all ${
                          isTriggered
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={alert.productImage}
                              alt={alert.productName}
                              referrerPolicy="no-referrer"
                              className="w-12 h-12 rounded-lg object-cover border border-neutral-800 shrink-0"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                                  {alert.sku}
                                </span>
                                {isTriggered ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Target Met!
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                    <Clock className="w-3 h-3" />
                                    Watching
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-semibold text-white line-clamp-1 mt-0.5">
                                {alert.productName}
                              </h4>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono">
                                  {alert.targetPrice ? (
                                    <>
                                      <span>Target: <strong className="text-amber-300">${alert.targetPrice.toFixed(2)}</strong></span>
                                      <span>•</span>
                                      <span>Current: <strong className="text-white">${alert.currentPrice.toFixed(2)}</strong></span>
                                    </>
                                  ) : (
                                    <span>Tracking Inventory Status Only</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 mt-0.5">
                                  {alert.notifyOnRestock && <span className="bg-sky-500/10 text-sky-400 px-1.5 rounded">Restock</span>}
                                  {alert.notifyOnLowStock && <span className="bg-amber-500/10 text-amber-400 px-1.5 rounded">Low Stock</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Simulate Drop Button for quick demo */}
                            <button
                              onClick={() => handleSimulateDropForProduct(alert.productId, 15)}
                              disabled={isSimulating}
                              title="Simulate 15% price drop on this specific product"
                              className="p-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1"
                            >
                              <ArrowDownRight className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline text-[11px]">Drop 15%</span>
                            </button>

                            {/* View Detail Button */}
                            <button
                              onClick={() => {
                                const prod = products.find(p => p.id === alert.productId);
                                if (prod) {
                                  setQuickViewProduct(prod);
                                  handleClose();
                                }
                              }}
                              title="View in product modal"
                              className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-all"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>

                            {/* Remove Alert Button */}
                            <button
                              id={`remove-alert-${alert.productId}`}
                              onClick={() => removeInventoryAlert(alert.productId)}
                              title="Cancel price watch"
                              className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg border border-neutral-800 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Status bar */}
                        <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px]">
                          {isTriggered ? (
                            <span className="text-emerald-400 font-medium flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              Triggered! Saved $
                              {Math.max(0, alert.originalPriceAtCreation - alert.currentPrice).toFixed(2)} compared to when alert was configured.
                            </span>
                          ) : (
                            <span className="text-neutral-400">
                              Currently <strong className="text-neutral-200">${diff.toFixed(2)}</strong> ({pctDiff}%) above your target threshold.
                            </span>
                          )}

                          <span className="text-[10px] text-neutral-500 font-mono">
                            Created {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to OmniStore Autonomous Inventory Engine
            </span>

            <button
              onClick={handleClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
