import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Server,
  Zap,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  Lock,
  Truck,
  RotateCcw,
  Sparkles,
  Layers
} from 'lucide-react';
import { StoreProvider, useStore } from './context/StoreContext';
import { LiveTickerBar } from './components/LiveTickerBar';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { WarehouseAdminModal } from './components/WarehouseAdminModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { NotificationToasts } from './components/NotificationToasts';

const StorefrontContent: React.FC = () => {
  const {
    products,
    searchQuery,
    selectedCategory,
    sortBy,
    setSortBy,
    onlyInStock,
    setOnlyInStock,
    metrics,
    setIsAdminOpen
  } = useStore();

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category filter
    if (selectedCategory !== 'all') {
      list = list.filter((p) => p.category === selectedCategory);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.tagline.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          Object.values(p.specs).some((val) => String(val).toLowerCase().includes(q))
      );
    }

    // In stock only
    if (onlyInStock) {
      list = list.filter((p) => p.stock > 0);
    }

    // Sorting
    if (sortBy === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'stock-asc') {
      list.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === 'stock-desc') {
      list.sort((a, b) => b.stock - a.stock);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }

    return list;
  }, [products, selectedCategory, searchQuery, onlyInStock, sortBy]);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Live Ticker */}
      <LiveTickerBar />

      {/* Main Navigation Bar */}
      <Navbar />

      {/* Hero Banner */}
      <section className="relative overflow-hidden border-b border-neutral-800 bg-radial-[at_top] from-neutral-900 via-neutral-950 to-neutral-950 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Real-Time Inventory Stream Active</span>
              <span className="text-neutral-500">•</span>
              <span className="text-neutral-300 font-mono">{metrics.unitsInStock} Units Available</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise Audio & Computing Hardware.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-neutral-400 leading-relaxed max-w-2xl">
              Equipped with tokenized payment authorization and millisecond-accurate stock telemetry. Every SKU reflects authoritative warehouse inventory in real time.
            </p>

            {/* Quick Live Telemetry Pills */}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>PCI-DSS Level 1 Vault Gateway</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-neutral-300">
                <Server className="w-4 h-4 text-sky-400" />
                <span>Atomic Server-Authoritative Holds</span>
              </div>
              <button
                onClick={() => setIsAdminOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white font-medium transition-colors"
              >
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Simulate Live Stock Drop</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Controls and Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Catalog Inventory</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
                {filteredProducts.length} items
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Available across East Coast, West Coast, and Midwest hubs
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* In-Stock Only Toggle */}
            <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none bg-neutral-900 px-3 py-2 rounded-xl border border-neutral-800">
              <input
                type="checkbox"
                checked={onlyInStock}
                onChange={(e) => setOnlyInStock(e.target.checked)}
                className="rounded border-neutral-700 text-emerald-500 focus:ring-0 focus:ring-offset-0 bg-neutral-950 cursor-pointer"
              />
              <span>In Stock Only</span>
            </label>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl text-xs text-neutral-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="featured" className="bg-neutral-900 text-white">Featured Selection</option>
                <option value="price-asc" className="bg-neutral-900 text-white">Price: Low to High</option>
                <option value="price-desc" className="bg-neutral-900 text-white">Price: High to Low</option>
                <option value="stock-desc" className="bg-neutral-900 text-white">Highest Stock Units</option>
                <option value="stock-asc" className="bg-neutral-900 text-white">Low Stock Warning</option>
                <option value="rating" className="bg-neutral-900 text-white">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-neutral-900/30 rounded-2xl border border-neutral-800">
            <Filter className="w-10 h-10 text-neutral-600 mx-auto stroke-1" />
            <h3 className="text-base font-semibold text-neutral-200">No matching products found</h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Try resetting your search query or selecting "All Catalog" to view all hardware.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {/* Security & Infrastructure Pillar Section */}
        <section className="mt-16 sm:mt-24 pt-12 border-t border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Bank-Grade Payment Vault</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Card numbers are tokenized client-side and verified via Luhn algorithm and 3D-Secure 2.0. No raw financial data is ever retained in memory.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Authoritative Inventory Locks</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Atomic database reservations prevent overselling during flash sales. As stock decrements, live WebSocket feeds update all connected shoppers instantly.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/80 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white">Automated Warehouse Routing</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Orders are mapped to the nearest logistics hub (Newark, Bay Area, Midwest) with live consignment barcode tracking from packing through delivery.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950 py-10 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white tracking-tight">OMNISTORE PRO</span>
            <span className="text-neutral-600">|</span>
            <span>PCI-DSS Level 1 Compliant Enterprise Commerce Engine</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
            <span>•</span>
            <button
              onClick={() => setIsAdminOpen(true)}
              className="hover:text-white transition-colors underline decoration-dotted"
            >
              Open Live Warehouse Console
            </button>
          </div>
        </div>
      </footer>

      {/* Overlays & Modals */}
      <ProductDetailModal />
      <CartDrawer />
      <CheckoutModal />
      <WarehouseAdminModal />
      <OrderTrackingModal />
      <NotificationToasts />
    </div>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <StorefrontContent />
    </StoreProvider>
  );
}
