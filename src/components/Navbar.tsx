import React, { useState } from 'react';
import { ShoppingBag, Search, SlidersHorizontal, PackageCheck, Layers, Server, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const Navbar: React.FC = () => {
  const {
    cart,
    setIsCartOpen,
    setIsAdminOpen,
    setIsTrackingOpen,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    metrics
  } = useStore();

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartAmount = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  const categories = [
    { id: 'all', label: 'All Catalog' },
    { id: 'audio', label: 'Mastering Audio' },
    { id: 'workstation', label: 'Displays & Desks' },
    { id: 'computing', label: 'High-IO Storage' },
    { id: 'optics', label: 'Cinema Optics' },
    { id: 'peripherals', label: 'Artisan Hardware' },
  ];

  return (
    <header id="main-header" className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-xl border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400/30">
                <Layers className="w-5 h-5 text-neutral-950 stroke-[2.5]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold tracking-tight text-lg text-white">OMNISTORE</span>
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    PRO
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 tracking-wide">Autonomous Supply & Pay</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="catalog-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pro hardware, SKUs, or specs (e.g. 6K, OLED, CNC)..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-9 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-2.5">
            {/* Order Tracking Button */}
            <button
              id="nav-track-order-button"
              onClick={() => setIsTrackingOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors"
            >
              <PackageCheck className="w-4 h-4 text-sky-400" />
              <span>Track Order</span>
            </button>

            {/* Warehouse Control & Real-Time Sim Button */}
            <button
              id="nav-warehouse-admin-button"
              onClick={() => setIsAdminOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-colors relative group"
              title="Open Warehouse Hub & Live Inventory Simulator"
            >
              <Server className="w-4 h-4 text-emerald-400 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Warehouse Live</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                {metrics.unitsInStock} units
              </span>
            </button>

            {/* Cart Button */}
            <button
              id="nav-cart-button"
              onClick={() => setIsCartOpen(true)}
              className="relative inline-flex items-center gap-2.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Cart</span>
              {totalCartCount > 0 ? (
                <span className="flex items-center gap-1.5">
                  <span className="bg-neutral-950 text-emerald-300 text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-5 text-center font-mono">
                    {totalCartCount}
                  </span>
                  <span className="hidden md:inline font-mono font-bold">
                    ${totalCartAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </span>
              ) : (
                <span className="text-neutral-950 font-mono text-[11px]">0</span>
              )}
            </button>
          </div>

        </div>

        {/* Category Filter Bar */}
        <div className="flex items-center gap-2 py-2.5 overflow-x-auto no-scrollbar border-t border-neutral-800/80">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                id={`cat-filter-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-950 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
