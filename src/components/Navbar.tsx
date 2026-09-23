import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  SlidersHorizontal,
  PackageCheck,
  Layers,
  Server,
  X,
  Scale,
  Heart,
  BellRing,
  History,
  User,
  ChevronDown
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { VoiceDictationButton } from './VoiceDictationButton';

export const Navbar: React.FC = () => {
  const {
    cart,
    orders,
    setIsCartOpen,
    setIsAdminOpen,
    setIsTrackingOpen,
    setIsOrderHistoryOpen,
    comparedProductIds,
    setIsCompareModalOpen,
    wishlistProductIds,
    onlyWishlist,
    setOnlyWishlist,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    metrics,
    inventoryAlerts,
    setIsInventoryAlertModalOpen,
    userProfile,
    setIsUserProfileOpen
  } = useStore();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const totalCartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const totalCartAmount = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const activeOrdersCount = orders.filter(o => o.status !== 'delivered').length;

  const categories = [
    { id: 'all', label: 'All Catalog' },
    { id: 'audio', label: 'Mastering Audio' },
    { id: 'workstation', label: 'Displays & Desks' },
    { id: 'computing', label: 'High-IO Storage' },
    { id: 'optics', label: 'Cinema Optics' },
    { id: 'peripherals', label: 'Artisan Hardware' },
  ];

  const userInitials = (userProfile?.firstName && userProfile?.lastName)
    ? `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase()
    : 'AV';

  const userDisplayName = userProfile?.firstName || 'Alex';

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
            <div className="relative w-full flex items-center">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="catalog-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search pro hardware, SKUs, or specs (e.g. 6K, OLED, CNC)..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-16 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-sans"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="p-1 text-neutral-400 hover:text-neutral-200"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <VoiceDictationButton
                  id="navbar-voice-search-btn"
                  onTranscript={(text) => setSearchQuery(text)}
                  title="Search or dictate SKU code hands-free"
                />
              </div>
            </div>
          </div>

          {/* Action Hub */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Order History & Tracking Status Button */}
            <button
              id="nav-order-history-button"
              onClick={() => setIsOrderHistoryOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                orders.length > 0
                  ? 'text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border-sky-500/40 shadow-xs'
                  : 'text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border-neutral-800'
              }`}
              title="View past purchases and shipment tracking status"
            >
              <History className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Orders</span>
              {orders.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-sky-500 text-neutral-950">
                    {orders.length}
                  </span>
                  {activeOrdersCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" title={`${activeOrdersCount} in transit`} />
                  )}
                </span>
              )}
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

            {/* Compare Button (Visible when 1+ items selected) */}
            {comparedProductIds.length > 0 && (
              <button
                id="nav-compare-button"
                onClick={() => setIsCompareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-xl transition-all shadow-sm"
                title="Open Side-by-Side Comparison"
              >
                <Scale className="w-4 h-4" />
                <span className="hidden sm:inline">Compare</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500 text-neutral-950 font-bold">
                  {comparedProductIds.length}
                </span>
              </button>
            )}

            {/* Wishlist Button */}
            <button
              id="nav-wishlist-button"
              onClick={() => setOnlyWishlist(!onlyWishlist)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                onlyWishlist
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-sm'
                  : 'text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border-neutral-800'
              }`}
              title={onlyWishlist ? 'Show all products' : 'Show wishlisted products only'}
            >
              <Heart
                className={`w-4 h-4 ${
                  onlyWishlist || wishlistProductIds.length > 0
                    ? 'text-rose-400 fill-rose-500/40'
                    : 'text-neutral-400'
                }`}
              />
              <span className="hidden sm:inline">Wishlist</span>
              {wishlistProductIds.length > 0 && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    onlyWishlist
                      ? 'bg-rose-500 text-neutral-950'
                      : 'bg-neutral-800 text-rose-300 border border-neutral-700'
                  }`}
                >
                  {wishlistProductIds.length}
                </span>
              )}
            </button>

            {/* Inventory & Inventory Alerts Watchlist Button */}
            <button
              id="nav-price-alerts-button"
              onClick={() => setIsInventoryAlertModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-all ${
                inventoryAlerts.length > 0
                  ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 shadow-xs'
                  : 'text-neutral-300 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border-neutral-800'
              }`}
              title="Manage Target Inventory & Inventory Alerts"
            >
              <BellRing className={`w-4 h-4 ${inventoryAlerts.length > 0 ? 'text-amber-400' : 'text-neutral-400'}`} />
              <span className="hidden sm:inline">Alerts</span>
              {inventoryAlerts.length > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-amber-500 text-neutral-950">
                  {inventoryAlerts.length}
                </span>
              )}
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

            {/* User Navigation Menu Dropdown */}
            <div className="relative">
              <button
                id="nav-user-menu-button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="inline-flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="User Navigation Menu"
              >
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                  {userInitials}
                </div>
                <span className="hidden md:inline font-medium">{userDisplayName}</span>
                <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:inline" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 text-xs space-y-1">
                    {/* User Profile Card Header */}
                    <div
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsUserProfileOpen(true);
                      }}
                      className="p-3 border-b border-neutral-800/80 mb-1 rounded-xl hover:bg-neutral-900/70 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-white text-sm group-hover:text-emerald-400 transition-colors">
                          {userProfile.displayName || `${userProfile.firstName} ${userProfile.lastName}`}
                        </p>
                        <span className="text-[10px] text-emerald-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                          Edit Profile →
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 font-mono truncate">{userProfile.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {userProfile.membershipTier}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                          {userProfile.savedAddresses.length} addresses
                        </span>
                      </div>
                    </div>

                    {/* Manage Profile & Account Details */}
                    <button
                      id="user-menu-profile-details"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsUserProfileOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <User className="w-4 h-4 text-emerald-400" />
                        <div>
                          <span className="font-semibold block">Account Details</span>
                          <span className="text-[10px] text-neutral-400">Manage identity, company & 2FA</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium">
                        Settings
                      </span>
                    </button>

                    {/* Saved Addresses */}
                    <button
                      id="user-menu-saved-addresses"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsUserProfileOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-4 h-4 flex items-center justify-center text-emerald-400 font-semibold text-xs">
                          ⌖
                        </div>
                        <div>
                          <span className="font-semibold block">Saved Addresses</span>
                          <span className="text-[10px] text-neutral-400">Shipping docks & billing destinations</span>
                        </div>
                      </div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-bold">
                        {userProfile.savedAddresses.length}
                      </span>
                    </button>

                    <div className="border-t border-neutral-800/80 my-1" />

                    <button
                      id="user-menu-order-history"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsOrderHistoryOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <History className="w-4 h-4 text-sky-400" />
                        <div>
                          <span className="font-semibold block">Order History</span>
                          <span className="text-[10px] text-neutral-400">Past purchases & shipment tracking</span>
                        </div>
                      </div>
                      {orders.length > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                          {orders.length}
                        </span>
                      )}
                    </button>

                    <button
                      id="user-menu-track-order"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsTrackingOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left"
                    >
                      <PackageCheck className="w-4 h-4 text-sky-400" />
                      <div>
                        <span className="font-semibold block">Track Consignment</span>
                        <span className="text-[10px] text-neutral-400">Locate package by tracking ID</span>
                      </div>
                    </button>

                    <button
                      id="user-menu-price-alerts"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setIsInventoryAlertModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <BellRing className="w-4 h-4 text-amber-400" />
                        <div>
                          <span className="font-semibold block">Inventory & Inventory Alerts</span>
                          <span className="text-[10px] text-neutral-400">Automated price drop watch</span>
                        </div>
                      </div>
                      {inventoryAlerts.length > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                          {inventoryAlerts.length}
                        </span>
                      )}
                    </button>

                    <button
                      id="user-menu-wishlist"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setOnlyWishlist(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-neutral-900 text-neutral-200 hover:text-white transition-colors text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Heart className="w-4 h-4 text-rose-400" />
                        <div>
                          <span className="font-semibold block">Saved Wishlist</span>
                          <span className="text-[10px] text-neutral-400">{wishlistProductIds.length} saved hardware</span>
                        </div>
                      </div>
                      {wishlistProductIds.length > 0 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
                          {wishlistProductIds.length}
                        </span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
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
