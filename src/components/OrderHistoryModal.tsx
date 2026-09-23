import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Package,
  Clock,
  Truck,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  Printer,
  ShoppingBag,
  Sparkles,
  Plus,
  Trash2,
  Filter,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Barcode
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';

export const OrderHistoryModal: React.FC = () => {
  const {
    isOrderHistoryOpen,
    setIsOrderHistoryOpen,
    orders,
    setActiveOrder,
    setIsTrackingOpen,
    updateOrderStatus,
    reorderItems,
    addSampleOrder,
    deleteOrder
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'in_transit' | 'picking' | 'processing' | 'delivered'>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

  // Copy tracking number
  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(tracking);
    setTimeout(() => setCopiedTracking(null), 2000);
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus =
        selectedStatus === 'all'
          ? true
          : selectedStatus === 'in_transit'
          ? order.status === 'in_transit'
          : selectedStatus === 'delivered'
          ? order.status === 'delivered'
          : order.status === selectedStatus;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesStatus;

      const matchesQuery =
        order.orderNumber.toLowerCase().includes(q) ||
        order.trackingNumber.toLowerCase().includes(q) ||
        order.items.some(item =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q)
        ) ||
        order.shipping.city.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [orders, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const activeShipments = orders.filter(o => o.status !== 'delivered').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;
    const totalSpend = orders.reduce((sum, o) => sum + o.total, 0);

    return { totalOrders, activeShipments, deliveredOrders, totalSpend };
  }, [orders]);

  // Helper for tracking status badge styling
  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <Truck className="w-3.5 h-3.5" />
            In Transit
          </span>
        );
      case 'picking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
            <Package className="w-3.5 h-3.5" />
            Warehouse Picking
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Payment Verified & Processing
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Delivered
          </span>
        );
      default:
        return null;
    }
  };

  // Stepper progress indicator calculation
  const getProgressPercentage = (status: Order['status']) => {
    switch (status) {
      case 'processing':
        return 25;
      case 'picking':
        return 50;
      case 'in_transit':
        return 75;
      case 'delivered':
        return 100;
      default:
        return 25;
    }
  };

  // Next status simulator helper
  const handleAdvanceStatus = (order: Order) => {
    if (order.status === 'processing') {
      updateOrderStatus(order.id, 'picking');
    } else if (order.status === 'picking') {
      updateOrderStatus(order.id, 'in_transit');
    } else if (order.status === 'in_transit') {
      updateOrderStatus(order.id, 'delivered');
    } else {
      updateOrderStatus(order.id, 'processing');
    }
  };

  if (!isOrderHistoryOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOrderHistoryOpen(false)}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          className="relative w-full max-w-4xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 text-neutral-100"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Order History & Consignments</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                    {orders.length} Records
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  View past hardware purchases, real-time tracking progression, and formal invoice records
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={addSampleOrder}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-xl transition-colors"
                title="Generate a sample order for demonstration"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Simulate Demo Order</span>
              </button>

              <button
                id="close-order-history-modal"
                onClick={() => setIsOrderHistoryOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                aria-label="Close Order History"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-neutral-900/30 border-b border-neutral-800/80 text-xs">
            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Total Purchases</span>
              <span className="text-lg font-bold text-white font-mono mt-0.5 block">{stats.totalOrders}</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-neutral-500 block">Active In-Transit</span>
                {stats.activeShipments > 0 && (
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                )}
              </div>
              <span className="text-lg font-bold text-sky-400 font-mono mt-0.5 block">
                {stats.activeShipments} {stats.activeShipments === 1 ? 'Shipment' : 'Shipments'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Delivered Completed</span>
              <span className="text-lg font-bold text-emerald-400 font-mono mt-0.5 block">{stats.deliveredOrders}</span>
            </div>

            <div className="p-3 rounded-xl bg-neutral-900/70 border border-neutral-800">
              <span className="text-[10px] uppercase font-mono text-neutral-500 block">Lifetime Invested</span>
              <span className="text-lg font-bold text-white font-mono mt-0.5 block">
                ${stats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-4 border-b border-neutral-800/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-neutral-950">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="search-order-history-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order #, tracking #, product name, or city..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: 'all', label: 'All Orders', count: orders.length },
                  { id: 'in_transit', label: 'In Transit', count: orders.filter(o => o.status === 'in_transit').length },
                  { id: 'picking', label: 'Picking', count: orders.filter(o => o.status === 'picking').length },
                  { id: 'processing', label: 'Processing', count: orders.filter(o => o.status === 'processing').length },
                  { id: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedStatus(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedStatus === tab.id
                      ? 'bg-sky-500 text-neutral-950 font-bold shadow-sm'
                      : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      selectedStatus === tab.id ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Orders Scrollable List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <Package className="w-7 h-7" />
                </div>
                <div className="max-w-md mx-auto">
                  <h3 className="text-sm font-bold text-white">No Matching Consignments</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    {searchQuery || selectedStatus !== 'all'
                      ? 'No past purchases matched your current search filters. Try clearing your query.'
                      : 'You have not placed any orders yet. Add items to your cart and checkout or generate a sample demo order!'}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {(searchQuery || selectedStatus !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedStatus('all');
                      }}
                      className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs text-white transition-colors"
                    >
                      Clear Search Filters
                    </button>
                  )}
                  <button
                    onClick={addSampleOrder}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Sample Demo Order</span>
                  </button>
                </div>
              </div>
            ) : (
              filteredOrders.map((order, index) => {
                const isExpanded = expandedOrderId === order.id;
                const progress = getProgressPercentage(order.status);
                const currentMilestone = order.timeline.find(t => t.current) || order.timeline[order.timeline.length - 1];

                return (
                  <div
                    key={order.id}
                    id={`order-card-${order.orderNumber}`}
                    className="rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700/80 transition-all overflow-hidden"
                  >
                    {/* Order Card Header */}
                    <div className="p-4 sm:p-5 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 bg-neutral-900/30">
                      <div className="flex flex-wrap items-center gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-mono text-neutral-500 block">Order Reference</span>
                          <span className="font-mono font-bold text-white text-sm">{order.orderNumber}</span>
                        </div>

                        <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

                        <div>
                          <span className="text-[10px] uppercase font-mono text-neutral-500 block">Date Placed</span>
                          <span className="text-xs text-neutral-300">
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </span>
                        </div>

                        <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

                        <div>
                          <span className="text-[10px] uppercase font-mono text-neutral-500 block">Total Billed</span>
                          <span className="font-mono font-bold text-emerald-400 text-sm">
                            ${order.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Status and Action Buttons */}
                      <div className="flex items-center gap-2.5">
                        {getStatusBadge(order.status)}

                        <button
                          onClick={() => setInvoiceOrder(order)}
                          className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 transition-colors"
                          title="View & Print Official Tax Invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => deleteOrder(order.id)}
                          className="p-2 rounded-xl text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 border border-neutral-800 hover:border-rose-500/30 transition-colors"
                          title="Delete Order Record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Tracking Status & Progress Section */}
                    <div className="p-4 sm:p-5 space-y-4">
                      {/* Stepper Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-sky-400" />
                            <span className="font-semibold text-white">Consignment Tracking Status</span>
                          </div>
                          <span className="text-neutral-400 font-mono text-[11px]">
                            {order.status === 'delivered'
                              ? 'Delivered'
                              : `Target Delivery: ${order.estimatedDeliveryDate}`}
                          </span>
                        </div>

                        {/* Progress Bar Track */}
                        <div className="relative h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className={`h-full rounded-full ${
                              order.status === 'delivered'
                                ? 'bg-emerald-500'
                                : order.status === 'in_transit'
                                ? 'bg-gradient-to-r from-sky-500 to-emerald-400'
                                : 'bg-amber-500'
                            }`}
                          />
                        </div>

                        {/* 4-Step Milestone Points */}
                        <div className="grid grid-cols-4 gap-1 text-[11px] mt-2.5">
                          <div className="text-left">
                            <span className="font-medium text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 inline shrink-0" />
                              <span className="truncate">Placed</span>
                            </span>
                          </div>
                          <div className="text-center">
                            <span
                              className={`font-medium truncate flex items-center justify-center gap-1 ${
                                progress >= 50 ? 'text-emerald-400' : 'text-neutral-500'
                              }`}
                            >
                              {progress >= 50 && <CheckCircle2 className="w-3 h-3 inline shrink-0" />}
                              <span className="truncate">Picking</span>
                            </span>
                          </div>
                          <div className="text-center">
                            <span
                              className={`font-medium truncate flex items-center justify-center gap-1 ${
                                progress >= 75 ? 'text-sky-400' : 'text-neutral-500'
                              }`}
                            >
                              {progress >= 75 && <Truck className="w-3 h-3 inline shrink-0" />}
                              <span className="truncate">In Transit</span>
                            </span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-medium truncate flex items-center justify-end gap-1 ${
                                progress === 100 ? 'text-emerald-400' : 'text-neutral-500'
                              }`}
                            >
                              {progress === 100 && <CheckCircle2 className="w-3 h-3 inline shrink-0" />}
                              <span className="truncate">Delivered</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Current Status Highlight Card */}
                      <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-mono text-neutral-500">Active Checkpoint</span>
                            {order.status !== 'delivered' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-ping" />
                            )}
                          </div>
                          <p className="font-semibold text-white text-xs">
                            {currentMilestone?.status || 'Shipment in Autonomous Pipeline'}
                          </p>
                          <p className="text-[11px] text-neutral-400">
                            {currentMilestone?.description || 'Package scanned and routing to delivery hub.'}
                          </p>
                        </div>

                        {/* Tracking details */}
                        <div className="flex flex-col sm:items-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                          <span className="text-[10px] font-mono text-neutral-500 uppercase">Tracking Number</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-sky-400 text-xs">{order.trackingNumber}</span>
                            <button
                              onClick={() => handleCopyTracking(order.trackingNumber)}
                              className="text-neutral-500 hover:text-white p-0.5"
                              title="Copy tracking code"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {copiedTracking === order.trackingNumber && (
                              <span className="text-[10px] text-emerald-400 font-mono">Copied!</span>
                            )}
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            Origin Hub: {order.warehouseAssigned}
                          </span>
                        </div>
                      </div>

                      {/* Items Purchased Preview */}
                      <div className="space-y-2">
                        <span className="text-[11px] uppercase font-mono text-neutral-500 block">
                          Purchased Equipment ({order.items.reduce((s, i) => s + i.quantity, 0)} Units)
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {order.items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 p-2 rounded-xl bg-neutral-950/50 border border-neutral-800/80 text-xs"
                            >
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-10 h-10 rounded-lg object-cover bg-neutral-900 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-white truncate block">{item.name}</span>
                                <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mt-0.5">
                                  <span>SKU: {item.sku}</span>
                                  <span>•</span>
                                  <span>Qty: {item.quantity}</span>
                                </div>
                              </div>
                              <span className="font-mono font-bold text-white shrink-0">
                                ${(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Expandable Journey Timeline */}
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pt-3 border-t border-neutral-800/80 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                              Full Consignment Journey Logs
                            </h4>
                            <span className="text-[10px] font-mono text-neutral-500">
                              Destination: {order.shipping.city}, {order.shipping.state}
                            </span>
                          </div>

                          <div className="space-y-3 pl-1">
                            {order.timeline.map((event, idx) => (
                              <div key={idx} className="flex items-start gap-3 text-xs">
                                <div className="mt-0.5 shrink-0">
                                  {event.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                  ) : event.current ? (
                                    <span className="flex h-4 w-4 items-center justify-center">
                                      <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-sky-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                                    </span>
                                  ) : (
                                    <Clock className="w-4 h-4 text-neutral-600" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between items-baseline gap-2">
                                    <span
                                      className={`font-semibold ${
                                        event.completed || event.current ? 'text-white' : 'text-neutral-500'
                                      }`}
                                    >
                                      {event.status}
                                    </span>
                                    <span className="text-[10px] text-neutral-500 font-mono shrink-0">
                                      {event.timestamp}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-neutral-400 mt-0.5">{event.description}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}

                      {/* Interactive Bottom Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-neutral-800/60 text-xs">
                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="text-neutral-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              <span>Hide Full Journey Logs</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>View Full Journey Logs ({order.timeline.length} Milestones)</span>
                            </>
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Simulate Advance Status */}
                          <button
                            onClick={() => handleAdvanceStatus(order)}
                            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white font-medium transition-colors flex items-center gap-1.5"
                            title="Simulate advancing to next logistics milestone"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Simulate Next Status</span>
                          </button>

                          {/* Track in Live Tracker Modal */}
                          <button
                            onClick={() => {
                              setActiveOrder(order);
                              setIsOrderHistoryOpen(false);
                              setIsTrackingOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 font-medium transition-colors flex items-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Live Track</span>
                          </button>

                          {/* Reorder All Items */}
                          <button
                            onClick={() => reorderItems(order)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Buy Again</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>All consignments secured by autonomous cold-chain and robotics tracking telemetry.</span>
            </div>
            <button
              onClick={() => {
                setIsOrderHistoryOpen(false);
                setIsTrackingOpen(true);
              }}
              className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
            >
              <span>Track with custom code</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </div>

      {/* Printable / Viewable Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl p-6 space-y-6 text-neutral-100"
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <span className="font-mono font-bold text-emerald-400 text-xs uppercase tracking-wider">
                  OMNISTORE PRO • OFFICIAL INVOICE
                </span>
                <h3 className="text-xl font-bold text-white mt-0.5">{invoiceOrder.orderNumber}</h3>
                <span className="text-xs text-neutral-400">
                  Issued: {new Date(invoiceOrder.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setInvoiceOrder(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Billing & Shipping Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">Delivered To</span>
                <p className="font-bold text-white">{invoiceOrder.shipping.fullName}</p>
                <p className="text-neutral-400">{invoiceOrder.shipping.addressLine1}</p>
                <p className="text-neutral-400">
                  {invoiceOrder.shipping.city}, {invoiceOrder.shipping.state} {invoiceOrder.shipping.postalCode}
                </p>
                <p className="text-neutral-500 font-mono mt-1">{invoiceOrder.shipping.email}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <span className="text-[10px] font-mono uppercase text-neutral-500 block mb-1">Payment Method</span>
                <p className="font-bold text-white flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-sky-400" />
                  <span>{invoiceOrder.payment.cardBrand} •••• {invoiceOrder.payment.last4}</span>
                </p>
                <p className="text-neutral-400 mt-1 font-mono text-[11px]">
                  Auth Code: {invoiceOrder.payment.authorizationCode}
                </p>
                <p className="text-neutral-400 font-mono text-[11px]">
                  Txn ID: {invoiceOrder.payment.transactionId}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono text-[10px] font-bold">
                  PAYMENT SETTLED
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-neutral-800 rounded-xl overflow-hidden text-xs">
              <div className="bg-neutral-900/80 p-3 font-mono text-neutral-400 grid grid-cols-12 uppercase text-[10px]">
                <div className="col-span-7">Hardware Item</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>
              <div className="divide-y divide-neutral-800/80">
                {invoiceOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3 grid grid-cols-12 items-center">
                    <div className="col-span-7">
                      <span className="font-medium text-white block">{item.name}</span>
                      <span className="font-mono text-[10px] text-neutral-500">SKU: {item.sku}</span>
                    </div>
                    <div className="col-span-2 text-center font-mono text-neutral-300">{item.quantity}</div>
                    <div className="col-span-3 text-right font-mono font-bold text-white">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financials Breakdown */}
            <div className="space-y-1.5 text-xs text-neutral-300 font-mono max-w-xs ml-auto">
              <div className="flex justify-between">
                <span className="text-neutral-400">Subtotal:</span>
                <span>${invoiceOrder.subtotal.toFixed(2)}</span>
              </div>
              {invoiceOrder.discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span>-${invoiceOrder.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-400">Shipping:</span>
                <span>{invoiceOrder.shippingCost === 0 ? 'FREE' : `$${invoiceOrder.shippingCost.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Sales Tax (EST):</span>
                <span>${invoiceOrder.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-neutral-800 text-sm font-bold text-white">
                <span>Total Settled:</span>
                <span className="text-emerald-400">${invoiceOrder.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Invoice Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-medium text-white flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>
              <button
                onClick={() => setInvoiceOrder(null)}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
