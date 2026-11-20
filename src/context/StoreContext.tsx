import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Product, CartItem, Order, RealtimeMessage, WarehouseStockMetrics, ShippingDetails, PaymentFormState, InventoryAlert, ProductReview, UserProfile, SavedAddress, CommunicationPreferences, SkuAuditLogEntry, SkuSafetyCheckResult, WarehouseConflictEvent, AutoReplenishmentRule, AutoReplenishmentDraftPO, AutoRestockRequest, CapacityPeakRecord, SkuWarehouseNote } from '../types';
import { INITIAL_SAMPLE_ORDERS, createSampleOrder } from '../data/sampleOrders';
import { INITIAL_USER_PROFILE } from '../data/initialUserProfile';
import { INITIAL_SKU_AUDIT_LOGS } from '../data/initialAuditLogs';
import {
  checkSkuAuditLogSafety,
  isAuditEntryQuarantineOrDamaged,
  isAuditEntryDamagedClearance,
  isAuditEntryQuarantineClearance
} from '../utils/skuAuditSafety';
import { detectSkuRegionalConflict, SkuRegionalConflict } from '../utils/inventoryConflicts';
import {
  computeSku30DayCapacityMap,
  Sku30DayCapacityMetrics,
  updateRecorded30DayPeaks
} from '../utils/autoRestockCapacity';

let _globalIdCounter = 0;
const _getUniqueId = (prefix = "id") => `${prefix}_${Date.now()}_${++_globalIdCounter}`;

export interface AlertToast {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
  timestamp: string;
}

export interface FlaggedAuditAlert {
  id: string;
  auditEntryId: string;
  sku: string;
  productId?: string;
  productName: string;
  warehouse: string;
  flagType: 'quarantine' | 'damaged' | 'both';
  statusLabel: string;
  reason: string;
  operatorId: string;
  timestamp: string;
}

export interface ActivityItem {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  city: string;
  country: string;
  total: number;
  timestamp: string;
}

interface StoreContextType {
  products: Product[];
  cart: CartItem[];
  orders: Order[];
  activeOrder: Order | null;
  metrics: WarehouseStockMetrics;
  connectionStatus: 'connected' | 'reconnecting' | 'fallback';
  alerts: AlertToast[];
  recentActivity: ActivityItem[];
  offlineInventoryQueue: any[];
  syncOfflineInventory: () => Promise<void>;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isAdminOpen: boolean;
  isDensityHeatmapOpen: boolean;
  adminActiveTab: 'inventory' | 'batch' | 'reconcile' | 'scanner';
  adminSelectedProductIds: string[];
  selectedCatalogProductIds: string[];
  setSelectedCatalogProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSelectCatalogProduct: (productId: string) => void;
  selectAllCatalogProducts: (productIds?: string[]) => void;
  clearSelectedCatalogProducts: () => void;
  bulkAddSelectedToCart: () => { addedCount: number; outOfStockCount: number };
  bulkAddSelectedToWarehouseQueue: () => void;
  isTrackingOpen: boolean;
  quickViewProduct: Product | null;
  qrCodeProduct: Product | null;
  comparedProductIds: string[];
  isCompareModalOpen: boolean;
  wishlistProductIds: string[];
  onlyWishlist: boolean;
  searchQuery: string;
  skuSearchQuery: string;
  trendingSkuSearches: { query: string; count: number }[];
  selectedCategory: string;
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating';
  onlyInStock: boolean;
  onlyLowStock: boolean;
  userReservations: Record<string, number>;
  reserveItem: (productId: string) => { success: boolean; message?: string };
  isReserved: (productId: string) => boolean;
  
  // Safe Mode (Audit Log Quarantine & Damage Protection)
  isSafeModeEnabled: boolean;
  setIsSafeModeEnabled: (enabled: boolean) => void;
  warehouseAuditLogs: SkuAuditLogEntry[];
  checkSkuSafety: (sku: string) => SkuSafetyCheckResult;
  toggleSkuDamagedFlag: (product: Product) => boolean;
  refreshWarehouseAuditLogs: () => Promise<SkuAuditLogEntry[]>;
  clearSkuAuditFlags: (sku: string, auditorName?: string, resolvedNote?: string) => Promise<boolean>;
  bulkQuarantineSkus: (params: {
    productIds: string[];
    reason: string;
    notes?: string;
  }) => Promise<{
    success: boolean;
    quarantinedCount: number;
    batchNumber: string;
    entries: SkuAuditLogEntry[];
  }>;
  flaggedAuditAlerts: FlaggedAuditAlert[];
  dismissFlaggedAuditAlert: (id: string) => void;
  globalAuditLogTarget: { sku: string; product?: Product | null } | null;
  openGlobalSkuAuditLog: (sku: string, product?: Product | null) => void;
  closeGlobalSkuAuditLog: () => void;

  // Customer Default Warehouse Selection & Transit
  customerDefaultWarehouse: string;
  setCustomerDefaultWarehouse: (warehouseName: string) => void;
  
  // Price Alerts
  inventoryAlerts: InventoryAlert[];
  isInventoryAlertModalOpen: boolean;
  activeInventoryAlertProduct: Product | null;
  setIsInventoryAlertModalOpen: (open: boolean) => void;
  setActiveInventoryAlertProduct: (product: Product | null) => void;
  setInventoryAlert: (product: Product, options: { targetPrice?: number | null, notifyOnRestock?: boolean, notifyOnLowStock?: boolean, notificationEmail?: string }) => void;
  removeInventoryAlert: (productId: string) => void;
  getInventoryAlertForProduct: (productId: string) => InventoryAlert | undefined;
  simulatePriceDrop: (productId?: string, discountPercent?: number) => Promise<boolean>;
  updateProductPrice: (productId: string, newPrice: number) => Promise<boolean>;
  resetAllPrices: () => Promise<boolean>;

  // SKU Maintenance & Storage Instructions Notes
  skuNotes: Record<string, SkuWarehouseNote>;
  getSkuNote: (product: Product) => SkuWarehouseNote | null;
  updateSkuNote: (productId: string, noteText: string) => Promise<boolean>;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSkuSearchQuery: (sku: string) => void;
  trackSkuSearch: (query: string) => void;
  setSelectedCategory: (cat: string) => void;
  setSortBy: (sort: 'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating') => void;
  setOnlyInStock: (val: boolean) => void;
  setOnlyLowStock: (val: boolean) => void;
  setOnlyWishlist: (val: boolean) => void;
  setIsCartOpen: (open: boolean) => void;
  setIsCheckoutOpen: (open: boolean) => void;
  setIsAdminOpen: (open: boolean) => void;
  setIsDensityHeatmapOpen: (open: boolean) => void;
  setAdminActiveTab: (tab: 'inventory' | 'batch' | 'reconcile' | 'scanner') => void;
  setAdminSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>;
  setIsTrackingOpen: (open: boolean) => void;
  setIsOrderHistoryOpen: (open: boolean) => void;
  isOrderHistoryOpen: boolean;
  isUserProfileOpen: boolean;
  setIsUserProfileOpen: (open: boolean) => void;
  userProfile: UserProfile;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  addSavedAddress: (address: Omit<SavedAddress, 'id'>) => void;
  updateSavedAddress: (id: string, address: Partial<SavedAddress>) => void;
  deleteSavedAddress: (id: string) => void;
  setDefaultShippingAddress: (id: string) => void;
  setDefaultBillingAddress: (id: string) => void;
  updateCommunicationPreferences: (preferences: Partial<CommunicationPreferences>) => void;
  updateOrderStatus: (orderId: string, newStatus: Order['status']) => void;
  reorderItems: (order: Order) => void;
  addSampleOrder: () => void;
  deleteOrder: (orderId: string) => void;
  setIsCompareModalOpen: (open: boolean) => void;
  toggleCompareProduct: (productId: string) => void;
  clearComparison: () => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
  setQuickViewProduct: (product: Product | null) => void;
  skuAdjustProduct: Product | null;
  setSkuAdjustProduct: (product: Product | null) => void;
  setQrCodeProduct: (product: Product | null) => void;
  setActiveOrder: (order: Order | null) => void;
  dismissAlert: (id: string) => void;
  addAlert: (type: AlertToast['type'], title: string, message: string) => void;

  addToCart: (product: Product, quantity?: number, options?: { silentToast?: boolean }) => { success: boolean; message?: string };
  quickBuy: (product: Product) => { success: boolean; message?: string };
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  
  // API operations
  processCheckout: (payload: {
    shippingDetails: ShippingDetails;
    paymentDetails: PaymentFormState;
    discountCode?: string;
  }) => Promise<{ success: boolean; order?: Order; error?: string }>;
  restockProduct: (productId: string, quantity: number) => Promise<boolean>;
  batchAdjustStock: (params: {
    productIds: string[];
    adjustmentType: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
  }) => Promise<{ success: boolean; updatedCount?: number; message?: string; error?: string }>;
  simulateExternalPurchase: (productId?: string) => Promise<boolean>;
  trackOrder: (orderNumber: string) => Promise<Order | null>;
  addReview: (productId: string, review: {
    authorName: string;
    rating: number;
    title?: string;
    comment: string;
    location?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  voteReviewHelpful: (productId: string, reviewId: string) => Promise<void>;
  updateWarehouseTags: (productId: string, tags: string[]) => void;
  batchUpdateWarehouseTags: (productIds: string[], tag: string, action: 'add' | 'remove') => void;
  showWarehouseTags: boolean;
  setShowWarehouseTags: (show: boolean) => void;
  tagColorMap: Record<string, string>;
  setTagColor: (tagName: string, color: string) => void;
  getFrequentlySearchedTogether: (sku: string) => Product[];
  recentSearchedSkus: string[];
  maxDeliveryDays: number | null;
  setMaxDeliveryDays: (days: number | null) => void;
  adminTargetProductId: string | null;
  setAdminTargetProductId: (id: string | null) => void;
  openAdminForProduct: (product: Product) => void;
  warehouseConflicts: WarehouseConflictEvent[];
  highlightedConflictId: string | null;
  dismissWarehouseConflict: (id: string) => void;
  focusOrOpenWarehouseConflictToast: (
    product: Product,
    context?: {
      hasStockConflict?: boolean;
      hasTransitDelay?: boolean;
      transitDelayLabel?: string;
      regionalConflictSummary?: string;
    }
  ) => void;
  resolveWarehouseConflict: (conflictId: string, resolution: 'override' | 'yield' | 'refresh') => Promise<void>;
  reportInventoryEditingSession: (sku: string, productId: string, status: 'start' | 'stop', action?: string) => Promise<void>;
  simulateWarehouseConflict: (sku?: string) => Promise<WarehouseConflictEvent | null>;
  chartDrilldownSku: string | null;
  setChartDrilldownSku: (sku: string | null) => void;
  drillDownToInventoryChart: (sku: string) => void;
  resolvedRegionalConflictSkus: string[];
  resolveRegionalConflict: (sku: string, productName?: string) => void;
  getSkuRegionalConflict: (product: Product) => SkuRegionalConflict | null;
  selectedDiscrepancySkus: string[];
  setSelectedDiscrepancySkus: React.Dispatch<React.SetStateAction<string[]>>;
  toggleDiscrepancySkuSelection: (sku: string) => void;
  reconciledDiscrepancySkus: string[];
  openBatchReconcileForSkus: (skus?: string[]) => void;
  batchClearAndReconcileDiscrepancies: (
    skus: string[],
    auditNote: string
  ) => Promise<{
    success: boolean;
    reconciledCount: number;
    skus: string[];
    auditNote: string;
    timestamp: string;
  }>;
  executeStockRebalanceTransfers: (
    transfers: {
      productId: string;
      sku: string;
      productName: string;
      sourceWarehouse: string;
      destWarehouse: string;
      quantity: number;
      affectsPrimaryProductStock: 'inbound_restock' | 'reconcile_only';
    }[]
  ) => Promise<{
    success: boolean;
    executedCount: number;
    totalUnitsTransferred: number;
    timestamp: string;
  }>;
  autoReplenishmentRules: Record<string, AutoReplenishmentRule>;
  autoReplenishmentDraftPOs: AutoReplenishmentDraftPO[];
  setAutoReplenishmentRule: (
    product: Product,
    config: { enabled: boolean; targetStock: number; warehouse?: string }
  ) => AutoReplenishmentDraftPO | null;
  approveAutoReplenishmentDraftPO: (poId: string) => Promise<boolean>;
  updateAutoReplenishmentDraftPOQty: (poId: string, newQuantity: number) => void;
  dismissAutoReplenishmentDraftPO: (poId: string) => void;
  batchDecommissionProducts: (
    productIds: string[],
    reason?: string
  ) => Promise<{
    success: boolean;
    decommissionedCount: number;
    decommissionedSkus: string[];
    blockedProducts: { id: string; sku: string; name: string; stock: number }[];
    error?: string;
    timestamp: string;
  }>;
  // Batch Auto-Restock (<20% of 30-day max recorded capacity)
  isBatchAutoRestockEnabled: boolean;
  setBatchAutoRestockEnabled: (enabled: boolean) => void;
  autoRestockRequests: AutoRestockRequest[];
  sku30DayCapacityMap: Record<string, Sku30DayCapacityMetrics>;
  fulfillAutoRestockRequest: (requestId: string) => Promise<boolean>;
  fulfillAllPendingAutoRestockRequests: () => Promise<{ fulfilledCount: number; totalUnits: number }>;
  updateAutoRestockRequestQty: (requestId: string, newQuantity: number) => void;
  dismissAutoRestockRequest: (requestId: string) => void;
  // Background WebSocket Auto-Sync (60s telemetry refresh for selected SKUs)
  isAutoSyncEnabled: boolean;
  setIsAutoSyncEnabled: (enabled: boolean) => void;
  autoSyncStatus: 'idle' | 'connecting' | 'active' | 'reconnecting';
  autoSyncLastRefreshedAt: string | null;
  autoSyncNextRefreshAt: number | null;
  autoSyncSyncedCount: number;
  autoSyncScopedToSelection: boolean;
  triggerAutoSyncNow: () => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_SAMPLE_ORDERS;
  });
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [metrics, setMetrics] = useState<WarehouseStockMetrics>({
    totalSkus: 8,
    unitsInStock: 64,
    lowStockItemsCount: 2,
    ordersProcessedToday: 24,
    activeReservations: 0,
  });
  
  const [offlineInventoryQueue, setOfflineInventoryQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('omnistore_offline_queue', JSON.stringify(offlineInventoryQueue));
  }, [offlineInventoryQueue]);

  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'reconnecting' | 'fallback'>('connecting' as any);
  const [alerts, setAlerts] = useState<AlertToast[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([
    {
      id: 'act_1',
      orderNumber: 'ORD-912044',
      productName: 'AcousticLab Model 8 Active Reference Monitors',
      quantity: 1,
      city: 'San Francisco, CA',
      country: 'US',
      total: 849.00,
      timestamp: '2 mins ago'
    },
    {
      id: 'act_2',
      orderNumber: 'ORD-881290',
      productName: 'Lumix Alpha Full-Frame 6K Digital Cinema Core',
      quantity: 1,
      city: 'Austin, TX',
      country: 'US',
      total: 2399.00,
      timestamp: '6 mins ago'
    }
  ]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isDensityHeatmapOpen, setIsDensityHeatmapOpen] = useState(false);
  const [adminActiveTab, setAdminActiveTab] = useState<'inventory' | 'batch' | 'reconcile' | 'scanner'>('inventory');
  const [adminSelectedProductIds, setAdminSelectedProductIds] = useState<string[]>([]);
  const [adminTargetProductId, setAdminTargetProductId] = useState<string | null>(null);
  const [selectedCatalogProductIds, setSelectedCatalogProductIds] = useState<string[]>([]);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [skuAdjustProduct, setSkuAdjustProduct] = useState<Product | null>(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [comparedProductIds, setComparedProductIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [warehouseConflicts, setWarehouseConflicts] = useState<WarehouseConflictEvent[]>([]);
  const [highlightedConflictId, setHighlightedConflictId] = useState<string | null>(null);
  const [chartDrilldownSku, setChartDrilldownSku] = useState<string | null>(null);
  const [resolvedRegionalConflictSkus, setResolvedRegionalConflictSkus] = useState<string[]>([]);
  const [selectedDiscrepancySkus, setSelectedDiscrepancySkus] = useState<string[]>([]);
  const [reconciledDiscrepancySkus, setReconciledDiscrepancySkus] = useState<string[]>([]);
  const [wishlistProductIds, setWishlistProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [onlyWishlist, setOnlyWishlist] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [skuSearchQuery, setSkuSearchQuery] = useState('');
  const [trendingSkuSearches, setTrendingSkuSearches] = useState<{ query: string; count: number }[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating'>('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [maxDeliveryDays, setMaxDeliveryDays] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('omnistore_max_delivery_days');
      return saved !== null ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_max_delivery_days', JSON.stringify(maxDeliveryDays));
    } catch {
      // ignore
    }
  }, [maxDeliveryDays]);

  // SKU Search Safe Mode (Audit Log Quarantine & Damage Cross-Reference)
  const [isSafeModeEnabled, setIsSafeModeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omnistore_sku_safe_mode');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_sku_safe_mode', JSON.stringify(isSafeModeEnabled));
    } catch {
      // ignore
    }
  }, [isSafeModeEnabled]);

  const [warehouseAuditLogs, setWarehouseAuditLogs] = useState<SkuAuditLogEntry[]>(INITIAL_SKU_AUDIT_LOGS);
  const warehouseAuditLogsRef = useRef<SkuAuditLogEntry[]>(warehouseAuditLogs);
  const seenAuditLogIdsRef = useRef<Set<string>>(
    new Set(INITIAL_SKU_AUDIT_LOGS.map(l => l.id))
  );
  const [flaggedAuditAlerts, setFlaggedAuditAlerts] = useState<FlaggedAuditAlert[]>([]);
  const [globalAuditLogTarget, setGlobalAuditLogTarget] = useState<{
    sku: string;
    product?: Product | null;
  } | null>(null);

  const openGlobalSkuAuditLog = useCallback((sku: string, product?: Product | null) => {
    const cleanSku = sku.trim();
    if (!cleanSku) return;
    setGlobalAuditLogTarget({ sku: cleanSku, product: product || null });
  }, []);

  const closeGlobalSkuAuditLog = useCallback(() => {
    setGlobalAuditLogTarget(null);
  }, []);

  const dismissFlaggedAuditAlert = useCallback((id: string) => {
    setFlaggedAuditAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    warehouseAuditLogsRef.current = warehouseAuditLogs;

    // Detect newly added audit entries entering 'quarantine' or 'damage' status, or clearing them
    const unseenEntries = warehouseAuditLogs.filter(
      entry => !seenAuditLogIdsRef.current.has(entry.id)
    );
    if (unseenEntries.length === 0) return;

    for (const entry of unseenEntries) {
      seenAuditLogIdsRef.current.add(entry.id);
    }

    const newlyFlaggedAlerts: FlaggedAuditAlert[] = [];
    const clearedSkus = new Set<string>();

    // Evaluate chronologically so later clearance beats earlier flag in the same batch
    const chronologicalUnseen = [...unseenEntries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const entry of chronologicalUnseen) {
      const normalizedSku = (entry.sku || '').trim().toUpperCase();
      if (!normalizedSku) continue;

      if (isAuditEntryDamagedClearance(entry) || isAuditEntryQuarantineClearance(entry)) {
        const safetyNow = checkSkuAuditLogSafety(entry.sku, warehouseAuditLogs);
        if (safetyNow.isSafe) {
          clearedSkus.add(normalizedSku);
        }
        continue;
      }

      const flagCheck = isAuditEntryQuarantineOrDamaged(entry);
      if (flagCheck.isFlagged && flagCheck.flagType) {
        clearedSkus.delete(normalizedSku);
        newlyFlaggedAlerts.push({
          id: _getUniqueId('FLG-AUD'),
          auditEntryId: entry.id,
          sku: entry.sku,
          productId: entry.productId,
          productName: entry.productName || entry.sku,
          warehouse: entry.warehouse || 'Bay Area Hub (WH-01)',
          flagType: flagCheck.flagType,
          statusLabel: flagCheck.statusLabel,
          reason: entry.reason || flagCheck.statusLabel,
          operatorId: entry.operatorId || 'Warehouse Audit System',
          timestamp: new Date(entry.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
        });
      }
    }

    if (clearedSkus.size > 0 || newlyFlaggedAlerts.length > 0) {
      setFlaggedAuditAlerts(prev => {
        let next = prev.filter(
          a => !clearedSkus.has(a.sku.trim().toUpperCase())
        );

        for (const fresh of newlyFlaggedAlerts) {
          const freshNorm = fresh.sku.trim().toUpperCase();
          next = [
            fresh,
            ...next.filter(a => a.sku.trim().toUpperCase() !== freshNorm)
          ];
        }
        return next.slice(0, 6);
      });
    }
  }, [warehouseAuditLogs]);

  const syncAuditLogsFromServer = useCallback(
    async (options?: { silentBaseline?: boolean }): Promise<SkuAuditLogEntry[]> => {
      try {
        const res = await fetch('/api/inventory/audit-logs');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.logs) && data.logs.length > 0) {
            const current = warehouseAuditLogsRef.current;
            const byId = new Map<string, SkuAuditLogEntry>();
            for (const entry of current) {
              byId.set(entry.id, entry);
            }
            for (const entry of data.logs as SkuAuditLogEntry[]) {
              if (options?.silentBaseline) {
                seenAuditLogIdsRef.current.add(entry.id);
              }
              byId.set(entry.id, entry);
            }
            const merged = Array.from(byId.values()).sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            warehouseAuditLogsRef.current = merged;
            setWarehouseAuditLogs(merged);
            return merged;
          }
        }
      } catch {
        // fallback to latest in-memory audit logs
      }
      return warehouseAuditLogsRef.current;
    },
    []
  );

  const refreshWarehouseAuditLogs = useCallback(
    () => syncAuditLogsFromServer({ silentBaseline: false }),
    [syncAuditLogsFromServer]
  );

  // Sync full live audit logs from backend on initial mount without firing alerts for historical seed entries
  useEffect(() => {
    syncAuditLogsFromServer({ silentBaseline: true });
  }, [syncAuditLogsFromServer]);

  const checkSkuSafety = useCallback((sku: string): SkuSafetyCheckResult => {
    return checkSkuAuditLogSafety(sku, warehouseAuditLogs);
  }, [warehouseAuditLogs]);

  // Target Price Alerts State
  const [inventoryAlerts, setInventoryAlerts] = useState<InventoryAlert[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_price_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isInventoryAlertModalOpen, setIsInventoryAlertModalOpen] = useState(false);
  const [activeInventoryAlertProduct, setActiveInventoryAlertProduct] = useState<Product | null>(null);

  // User Profile & Preferences State
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('omnistore_user_profile');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return INITIAL_USER_PROFILE;
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_user_profile', JSON.stringify(userProfile));
    } catch (err) {
      console.error('Failed to sync user profile with localStorage', err);
    }
  }, [userProfile]);

  // Customer Default Warehouse Selection for Real-Time Transit Estimation
  const [customerDefaultWarehouse, setCustomerDefaultWarehouseState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('omnistore_customer_default_warehouse');
      if (saved) return saved;
      if (userProfile?.defaultWarehouse) return userProfile.defaultWarehouse;
    } catch {
      // ignore
    }
    return userProfile?.defaultWarehouse || 'Bay Area Hub (WH-01)';
  });

  const setCustomerDefaultWarehouse = useCallback((warehouseName: string) => {
    setCustomerDefaultWarehouseState(warehouseName);
    try {
      localStorage.setItem('omnistore_customer_default_warehouse', warehouseName);
    } catch {
      // ignore
    }
    setUserProfile(prev => ({
      ...prev,
      defaultWarehouse: warehouseName,
    }));
  }, []);

  const inventoryAlertsRef = useRef<InventoryAlert[]>([]);
  useEffect(() => {
    inventoryAlertsRef.current = inventoryAlerts;
    try {
      localStorage.setItem('omnistore_price_alerts', JSON.stringify(inventoryAlerts));
    } catch {
      // ignore
    }
  }, [inventoryAlerts]);

  // Sync cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('omnistore_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  // Sync wishlist to local storage
  useEffect(() => {
    try {
      localStorage.setItem('omnistore_wishlist', JSON.stringify(wishlistProductIds));
    } catch {
      // ignore
    }
  }, [wishlistProductIds]);

  // Sync orders to local storage
  useEffect(() => {
    try {
      localStorage.setItem('omnistore_orders', JSON.stringify(orders));
    } catch {
      // ignore
    }
  }, [orders]);

  const addAlert = useCallback((type: AlertToast['type'], title: string, message: string) => {
    const newAlert: AlertToast = {
      id: _getUniqueId("alt"),
      type,
      title,
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
    setAlerts(prev => [newAlert, ...prev.slice(0, 4)]);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
    }, 6000);
  }, []);

  const toggleSkuDamagedFlag = useCallback((product: Product): boolean => {
    const currentSafety = checkSkuAuditLogSafety(product.sku, warehouseAuditLogs);
    const currentlyDamaged =
      currentSafety.flagType === 'damaged' || currentSafety.flagType === 'both';

    const latestTs = warehouseAuditLogs.reduce((max, log) => {
      const ts = new Date(log.timestamp).getTime();
      return Number.isFinite(ts) && ts > max ? ts : max;
    }, 0);
    const nextTimestamp = new Date(Math.max(Date.now(), latestTs + 1000)).toISOString();

    const operatorName = userProfile?.displayName || 'Warehouse Manager';
    const nextIsDamaged = !currentlyDamaged;

    const newEntry: SkuAuditLogEntry = {
      id: _getUniqueId('AUD-QF'),
      sku: product.sku,
      productId: product.id,
      productName: product.name,
      timestamp: nextTimestamp,
      adjustmentValue: 0,
      adjustmentType: 'reconciliation',
      previousStock: product.stock,
      newStock: product.stock,
      operatorId: `OP-MGR (${operatorName})`,
      operatorName,
      reason: nextIsDamaged
        ? 'Damaged Stock — Quick Flag'
        : 'Damaged Flag Cleared — Quick Flag',
      warehouse: product.warehouse,
      notes: nextIsDamaged
        ? 'Manually flagged as Damaged via catalog ProductCard Quick Flag shortcut. Immediate manager review required.'
        : 'Damaged status cleared via catalog ProductCard Quick Flag shortcut. SKU verified and restored.'
    };

    setWarehouseAuditLogs(prev => [newEntry, ...prev]);

    if (nextIsDamaged) {
      const title = 'Critical Audit Flag: Damaged Stock';
      const message = `${product.sku} (${product.name}) marked as Damaged via Quick Flag. Immediate manual review and validation required.`;
      addAlert('critical', title, message);
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body: message, icon: product.images?.[0] || '/favicon.ico' });
        } catch {
          // ignore notification errors in restricted contexts
        }
      }
    } else {
      addAlert(
        'success',
        'Damaged Flag Cleared',
        `${product.sku} (${product.name}) has been cleared from Damaged status.`
      );
    }

    return nextIsDamaged;
  }, [warehouseAuditLogs, userProfile, addAlert]);

  const clearSkuAuditFlags = useCallback(async (sku: string, auditorName?: string, resolvedNote?: string): Promise<boolean> => {
    const normalizedSku = sku.trim().toUpperCase();
    if (!normalizedSku) return false;

    const matchedProduct = products.find(p => p.sku.trim().toUpperCase() === normalizedSku);
    const currentLogs = warehouseAuditLogsRef.current;
    const latestTs = currentLogs.reduce((max, log) => {
      const ts = new Date(log.timestamp).getTime();
      return Number.isFinite(ts) && ts > max ? ts : max;
    }, 0);
    const nextTimestamp = new Date(Math.max(Date.now(), latestTs + 1000)).toISOString();
    const resolvedAuditor = auditorName?.trim() || userProfile?.displayName || 'Sora Tanaka (QA Auditor)';

    const trimmedNote = resolvedNote?.trim();
    const formattedNote = trimmedNote
      ? trimmedNote.toLowerCase().startsWith('resolved')
        ? trimmedNote
        : `Resolved: ${trimmedNote}`
      : 'Resolved: Cleared by manager — Quarantine and Damaged flags verified resolved; audit status updated to Cleared.';

    const clearanceEntry: SkuAuditLogEntry = {
      id: _getUniqueId('AUD-CLR'),
      sku: matchedProduct?.sku || normalizedSku,
      productId: matchedProduct?.id,
      productName: matchedProduct?.name || normalizedSku,
      timestamp: nextTimestamp,
      adjustmentValue: 0,
      adjustmentType: 'reconciliation',
      previousStock: matchedProduct?.stock ?? 0,
      newStock: matchedProduct?.stock ?? 0,
      operatorId: `OP-MGR (${resolvedAuditor})`,
      operatorName: resolvedAuditor,
      reason: 'Audit Status: Cleared — Quarantine & Damaged Flags Cleared (Resolved)',
      warehouse: matchedProduct?.warehouse || 'Bay Area Hub (WH-01)',
      notes: formattedNote
    };

    try {
      await fetch('/api/inventory/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: clearanceEntry.sku,
          productName: clearanceEntry.productName,
          adjustmentValue: 0,
          adjustmentType: 'reconciliation',
          previousStock: clearanceEntry.previousStock,
          newStock: clearanceEntry.newStock,
          operatorId: clearanceEntry.operatorId,
          operatorName: clearanceEntry.operatorName,
          reason: clearanceEntry.reason,
          warehouse: clearanceEntry.warehouse,
          notes: clearanceEntry.notes
        })
      });
    } catch {
      // proceed with local state update even if API request fails
    }

    setWarehouseAuditLogs(prev => {
      const next = [clearanceEntry, ...prev];
      warehouseAuditLogsRef.current = next;
      return next;
    });

    addAlert(
      'success',
      'Audit Flag Cleared by Auditor',
      `${clearanceEntry.sku} (${clearanceEntry.productName}) cleared from Quarantine / Damaged hold and restored to active catalog.`
    );

    return true;
  }, [products, userProfile, addAlert]);

  const bulkQuarantineSkus = useCallback(async (params: {
    productIds: string[];
    reason: string;
    notes?: string;
  }): Promise<{
    success: boolean;
    quarantinedCount: number;
    batchNumber: string;
    entries: SkuAuditLogEntry[];
  }> => {
    const uniqueIds = Array.from(new Set(params.productIds));
    const targetProducts = products.filter(p => uniqueIds.includes(p.id));
    if (targetProducts.length === 0) {
      return { success: false, quarantinedCount: 0, batchNumber: '', entries: [] };
    }

    const now = new Date();
    const batchNumber = `QRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const currentLogs = warehouseAuditLogsRef.current;
    const latestTs = currentLogs.reduce((max, log) => {
      const ts = new Date(log.timestamp).getTime();
      return Number.isFinite(ts) && ts > max ? ts : max;
    }, 0);
    const baseTs = Math.max(Date.now(), latestTs + 1000);

    const managerName = userProfile?.displayName || 'Warehouse Manager';
    const operatorId = `OP-MGR (${managerName})`;
    const rawReason = params.reason.trim() || 'QA Inspection Hold';
    const formattedReason = rawReason.toLowerCase().includes('quarantin')
      ? rawReason
      : `Under Quarantine: ${rawReason}`;
    const trimmedNotes = params.notes?.trim();
    const formattedNotes = trimmedNotes
      ? `Bulk Quarantine (${batchNumber}) — ${trimmedNotes}`
      : `Bulk Quarantine (${batchNumber}) — Marked as Under Quarantine via Warehouse Admin Batch Operations (${targetProducts.length} SKUs).`;

    const preparedEntries: SkuAuditLogEntry[] = targetProducts.map((product, idx) => ({
      id: _getUniqueId('AUD-QRN'),
      sku: product.sku,
      productId: product.id,
      productName: product.name,
      timestamp: new Date(baseTs + idx * 50).toISOString(),
      adjustmentValue: 0,
      adjustmentType: 'reconciliation',
      previousStock: product.stock,
      newStock: product.stock,
      operatorId,
      operatorName: managerName,
      reason: formattedReason,
      warehouse: product.warehouse,
      batchNumber,
      notes: formattedNotes
    }));

    // Persist each quarantine entry to the backend audit log endpoint in parallel
    const persistedEntries = await Promise.all(
      preparedEntries.map(async entry => {
        try {
          const res = await fetch('/api/inventory/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: entry.sku,
              productName: entry.productName,
              adjustmentValue: entry.adjustmentValue,
              adjustmentType: entry.adjustmentType,
              previousStock: entry.previousStock,
              newStock: entry.newStock,
              operatorId: entry.operatorId,
              operatorName: entry.operatorName,
              reason: entry.reason,
              warehouse: entry.warehouse,
              batchNumber: entry.batchNumber,
              notes: entry.notes
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.log?.id) {
              return {
                ...entry,
                id: data.log.id,
                timestamp: data.log.timestamp || entry.timestamp,
                batchNumber: data.log.batchNumber || entry.batchNumber
              } as SkuAuditLogEntry;
            }
          }
        } catch {
          // Fall back to local entry if offline/unreachable
        }
        return entry;
      })
    );

    // Prepend all newly created quarantine audit entries to live state
    // (automatically triggers Flagged Audit Alert toasts and safety badge updates)
    setWarehouseAuditLogs(prev => {
      const existingIds = new Set(prev.map(l => l.id));
      const fresh = persistedEntries.filter(e => !existingIds.has(e.id));
      const next = [...fresh, ...prev].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      warehouseAuditLogsRef.current = next;
      return next;
    });

    addAlert(
      'critical',
      `Bulk Quarantine Applied (${persistedEntries.length} SKU${persistedEntries.length === 1 ? '' : 's'})`,
      `Marked ${persistedEntries.map(e => e.sku).join(', ')} as Under Quarantine (${batchNumber}). Audit log entries recorded for every SKU.`
    );

    return {
      success: true,
      quarantinedCount: persistedEntries.length,
      batchNumber,
      entries: persistedEntries
    };
  }, [products, userProfile, addAlert]);

  const [userReservations, setUserReservations] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('omnistore_user_reservations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [showWarehouseTags, setShowWarehouseTags] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omnistore_show_warehouse_tags');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [tagColorMap, setTagColorMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('omnistore_tag_color_map');
      return saved ? JSON.parse(saved) : {
        'Fragile': 'amber',
        'Heavy': 'purple',
        'Flammable': 'rose',
        'Priority': 'emerald',
        'Hazard': 'rose',
        'Oversized': 'indigo',
        'Cold Chain': 'sky',
        'Secure Vault': 'amber'
      };
    } catch {
      return {};
    }
  });

  const [skuCooccurrences, setSkuCooccurrences] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem('omnistore_sku_cooccurrences');
      return saved ? JSON.parse(saved) : {
        'AUD-REF-8040': { 'KB-TITAN-75': 14, 'CAM-PRO-9K': 9, 'MIC-STU-X': 6 },
        'KB-TITAN-75': { 'AUD-REF-8040': 14, 'MOU-ERG-PRO': 11, 'PAD-DESK-XL': 8 },
        'CAM-PRO-9K': { 'MIC-STU-X': 18, 'LIG-PAN-LED': 10, 'AUD-REF-8040': 9 },
        'MIC-STU-X': { 'CAM-PRO-9K': 18, 'ARM-MIC-PRO': 12, 'AUD-REF-8040': 6 }
      };
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_sku_cooccurrences', JSON.stringify(skuCooccurrences));
    } catch {}
  }, [skuCooccurrences]);

  const [recentSearchedSkus, setRecentSearchedSkus] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_recent_searched_skus');
      return saved ? JSON.parse(saved) : ['AUD-REF-8040', 'KB-TITAN-75', 'CAM-PRO-9K', 'MIC-STU-X', 'MOU-ERG-PRO'];
    } catch {
      return ['AUD-REF-8040', 'KB-TITAN-75', 'CAM-PRO-9K', 'MIC-STU-X', 'MOU-ERG-PRO'];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_recent_searched_skus', JSON.stringify(recentSearchedSkus));
    } catch {}
  }, [recentSearchedSkus]);

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_show_warehouse_tags', JSON.stringify(showWarehouseTags));
    } catch {}
  }, [showWarehouseTags]);

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_tag_color_map', JSON.stringify(tagColorMap));
    } catch {}
  }, [tagColorMap]);

  const setTagColor = (tagName: string, color: string) => {
    setTagColorMap(prev => ({ ...prev, [tagName]: color }));
  };

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_user_reservations', JSON.stringify(userReservations));
    } catch {}
  }, [userReservations]);

  // Periodic timer to check and release expired 15-min reservations
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setUserReservations(prev => {
        let changed = false;
        const next = { ...prev };
        for (const [prodId, expiry] of Object.entries(next)) {
          if (now >= (expiry as number)) {
            delete next[prodId];
            changed = true;
            setProducts(pList => pList.map(p => p.id === prodId ? { ...p, reserved: Math.max(0, p.reserved - 1) } : p));
            addAlert('info', 'Reservation Expired', '15-minute temporary stock lock expired for item.');
          }
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [addAlert]);

  const reserveItem = (productId: string): { success: boolean; message?: string } => {
    const product = products.find(p => p.id === productId);
    if (!product) return { success: false, message: 'Product not found' };

    if (userReservations[productId] && Date.now() < userReservations[productId]) {
      addAlert('info', 'Already Reserved', `You already have an active 15-minute stock lock on "${product.name}".`);
      return { success: true, message: 'Already reserved' };
    }

    if (product.stock <= product.reserved) {
      addAlert('warning', 'No Units Available for Lock', `All available units of "${product.name}" are currently stocked or reserved.`);
      return { success: false, message: 'No units available for reservation' };
    }

    const expiryTime = Date.now() + 15 * 60 * 1000; // 15 minutes
    setUserReservations(prev => ({ ...prev, [productId]: expiryTime }));

    // Increment reserved count in inventory data
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, reserved: p.reserved + 1 } : p));

    addAlert(
      'success',
      '🔒 15-Min Stock Lock Secured',
      `Temporary reservation created for "${product.name}". Reserved count updated in inventory data. Expires in 15 mins.`
    );
    return { success: true };
  };

  const isReserved = (productId: string) => {
    const expiry = userReservations[productId];
    return Boolean(expiry && Date.now() < expiry);
  };

  const dismissAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // Synthesize pleasant celebratory chime when target price is met
  const playPriceDropChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6 triumphant chord arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.36);
      });
    } catch {
      // ignore
    }
  }, []);

  // Audio warning chime when simultaneous modification conflict is detected
  const playConflictChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const freqs = [480, 360, 480, 360];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.11);
      });
    } catch {
      // ignore
    }
  }, []);

  const dismissWarehouseConflict = useCallback((id: string) => {
    setWarehouseConflicts(prev => prev.filter(c => c.id !== id));
    setHighlightedConflictId(prev => (prev === id ? null : prev));
  }, []);

  const focusOrOpenWarehouseConflictToast = useCallback(
    (
      product: Product,
      context?: {
        hasStockConflict?: boolean;
        hasTransitDelay?: boolean;
        transitDelayLabel?: string;
        regionalConflictSummary?: string;
      }
    ) => {
      const normalizedSku = product.sku.trim().toUpperCase();
      let targetId: string | null = null;

      setWarehouseConflicts(prev => {
        const existingIndex = prev.findIndex(
          c => c.sku.trim().toUpperCase() === normalizedSku || c.productId === product.id
        );

        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          targetId = existing.id;
          return [existing, ...prev.filter((_, idx) => idx !== existingIndex)];
        }

        const nowLabel = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        const hasStockConflict = Boolean(context?.hasStockConflict);
        const hasTransitDelay = Boolean(context?.hasTransitDelay);
        const operatorName = userProfile?.displayName || 'Warehouse Manager';

        let message = '';
        if (hasStockConflict && hasTransitDelay) {
          message = `${product.sku} (${product.name}) has an active warehouse stock conflict (${
            context?.regionalConflictSummary || 'multi-hub ledger discrepancy'
          }) combined with a transit delay (${
            context?.transitDelayLabel || 'extended inter-hub routing'
          }). Sync or inspect stock before dispatching.`;
        } else if (hasStockConflict) {
          message = `${product.sku} (${product.name}) is flagged for a warehouse stock conflict: ${
            context?.regionalConflictSummary || 'conflicting stock counts reported across regional hubs'
          }. Review and reconcile before committing adjustments.`;
        } else {
          message = `${product.sku} (${product.name}) is flagged for a transit delay (${
            context?.transitDelayLabel || 'extended cross-hub transit window'
          }) from ${product.warehouse}. Verify hub allocation or sync inventory levels.`;
        }

        const newConflict: WarehouseConflictEvent = {
          id: _getUniqueId('CONF-CHIP'),
          sku: product.sku,
          productId: product.id,
          productName: product.name,
          productImage: product.images?.[0],
          warehouse: product.warehouse,
          userA: {
            operatorId: 'OP-CONSOLE',
            operatorName,
            role: 'Active Console Manager'
          },
          userB: {
            operatorId: hasStockConflict ? 'HUB-SYNC-BOT' : 'CARRIER-SLA',
            operatorName: hasStockConflict
              ? 'Regional Hub Ledger Sync'
              : 'Transit Dispatch Monitor',
            role: hasStockConflict ? 'Cross-Hub Conflict' : 'Transit Delay Alert'
          },
          timestamp: nowLabel,
          message,
          currentStock: product.stock,
          attemptedAction: hasStockConflict ? 'stock_adjustment' : 'cycle_count'
        };

        targetId = newConflict.id;
        return [newConflict, ...prev];
      });

      // Defer highlight assignment so React commits the new/promoted conflict ID cleanly
      setTimeout(() => {
        if (targetId) {
          setHighlightedConflictId(targetId);
          setTimeout(() => {
            setHighlightedConflictId(prev => (prev === targetId ? null : prev));
          }, 3500);
        }
      }, 0);
    },
    [userProfile]
  );

  const resolveWarehouseConflict = useCallback(async (conflictId: string, resolution: 'override' | 'yield' | 'refresh') => {
    try {
      await fetch('/api/inventory/resolve-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflictId, resolution })
      });
    } catch {}
    dismissWarehouseConflict(conflictId);
    if (resolution === 'refresh') {
      fetchInitialData();
      addAlert('info', 'Inventory Synced', 'Refreshed latest server inventory state.');
    } else if (resolution === 'override') {
      addAlert('warning', 'Lock Overridden', 'Granted exclusive editing precedence to your console session.');
    } else if (resolution === 'yield') {
      addAlert('info', 'Edit Yielded', 'Yielded inventory lock to other warehouse staff member.');
    }
  }, [dismissWarehouseConflict, addAlert]);

  const reportInventoryEditingSession = useCallback(async (sku: string, productId: string, status: 'start' | 'stop', action?: string) => {
    try {
      await fetch('/api/inventory/editing-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          productId,
          operatorId: 'OP-8821',
          operatorName: 'Julian Vance (Console)',
          role: 'Console Specialist',
          action: action || 'stock_adjustment',
          status,
          warehouse: 'Bay Area Hub (WH-01)'
        })
      });
    } catch {}
  }, []);

  const simulateWarehouseConflict = useCallback(async (sku?: string): Promise<WarehouseConflictEvent | null> => {
    try {
      const res = await fetch('/api/inventory/simulate-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku })
      });
      if (res.ok) {
        const data = await res.json();
        return data.conflict;
      }
    } catch (e) {
      console.error('Error simulating conflict:', e);
    }
    return null;
  }, []);

  const drillDownToInventoryChart = useCallback((sku: string) => {
    setChartDrilldownSku(sku);
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const chartEl = document.getElementById('warehouse-inventory-distribution-dashboard');
        if (chartEl) {
          chartEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  }, []);

  const getSkuRegionalConflict = useCallback(
    (product: Product): SkuRegionalConflict | null => {
      return detectSkuRegionalConflict(
        product,
        warehouseAuditLogs,
        warehouseConflicts,
        resolvedRegionalConflictSkus
      );
    },
    [warehouseAuditLogs, warehouseConflicts, resolvedRegionalConflictSkus]
  );

  const resolveRegionalConflict = useCallback(
    (sku: string, productName?: string) => {
      const normalized = sku.trim().toUpperCase();
      setResolvedRegionalConflictSkus((prev) =>
        prev.includes(normalized) ? prev : [...prev, normalized]
      );
      setWarehouseConflicts((prev) =>
        prev.filter((c) => c.sku.trim().toUpperCase() !== normalized)
      );

      const matched = products.find((p) => p.sku.trim().toUpperCase() === normalized);
      const operatorName = userProfile?.displayName || 'Warehouse Manager';
      const reconcileEntry: SkuAuditLogEntry = {
        id: _getUniqueId('AUD-REC'),
        sku: matched?.sku || sku,
        productId: matched?.id,
        productName: productName || matched?.name || sku,
        timestamp: new Date().toISOString(),
        adjustmentValue: 0,
        adjustmentType: 'reconciliation',
        previousStock: matched?.stock ?? 0,
        newStock: matched?.stock ?? 0,
        operatorId: `OP-MGR (${operatorName})`,
        operatorName,
        reason: 'Regional Conflict Reconciled — Multi-Hub Sync',
        warehouse: matched?.warehouse || 'Bay Area Hub (WH-01)',
        notes: `Reconciled conflicting regional warehouse inventory ledgers for ${sku} via Warehouse Inventory Chart.`
      };
      setWarehouseAuditLogs((prev) => [reconcileEntry, ...prev]);

      setChartDrilldownSku((prev) =>
        prev && prev.trim().toUpperCase() === normalized ? null : prev
      );

      addAlert(
        'success',
        'Regional Inventory Reconciled',
        `Synchronized cross-warehouse ledgers for ${sku}${productName ? ` (${productName})` : ''}.`
      );
    },
    [products, userProfile, addAlert]
  );

  const toggleDiscrepancySkuSelection = useCallback((sku: string) => {
    const normalized = sku.trim().toUpperCase();
    if (!normalized) return;
    setSelectedDiscrepancySkus((prev) =>
      prev.includes(normalized)
        ? prev.filter((item) => item !== normalized)
        : [...prev, normalized]
    );
  }, []);

  const openBatchReconcileForSkus = useCallback((skus?: string[]) => {
    if (skus && skus.length > 0) {
      const normalized = Array.from(
        new Set(skus.map((s) => s.trim().toUpperCase()).filter(Boolean))
      );
      setSelectedDiscrepancySkus(normalized);
    }
    setAdminActiveTab('reconcile');
    setIsAdminOpen(true);
  }, []);

  const batchClearAndReconcileDiscrepancies = useCallback(
    async (
      skus: string[],
      auditNote: string
    ): Promise<{
      success: boolean;
      reconciledCount: number;
      skus: string[];
      auditNote: string;
      timestamp: string;
    }> => {
      const normalizedSkus = Array.from(
        new Set(skus.map((s) => s.trim().toUpperCase()).filter(Boolean))
      );
      const cleanNote =
        auditNote.trim() ||
        'Bulk Clear & Reconcile verified across warehouse ledgers.';
      const nowIso = new Date().toISOString();

      if (normalizedSkus.length === 0) {
        return {
          success: false,
          reconciledCount: 0,
          skus: [],
          auditNote: cleanNote,
          timestamp: nowIso
        };
      }

      const currentLogs = warehouseAuditLogsRef.current;
      const latestTs = currentLogs.reduce((max, log) => {
        const ts = new Date(log.timestamp).getTime();
        return Number.isFinite(ts) && ts > max ? ts : max;
      }, 0);
      const baseMs = Math.max(Date.now(), latestTs + 1000);
      const operatorName = userProfile?.displayName || 'Warehouse Manager';

      const newEntries: SkuAuditLogEntry[] = normalizedSkus.map((normSku, idx) => {
        const matched = products.find(
          (p) => p.sku.trim().toUpperCase() === normSku
        );
        return {
          id: _getUniqueId('AUD-BREC'),
          sku: matched?.sku || normSku,
          productId: matched?.id,
          productName: matched?.name || normSku,
          timestamp: new Date(baseMs + idx * 500).toISOString(),
          adjustmentValue: 0,
          adjustmentType: 'reconciliation',
          previousStock: matched?.stock ?? 0,
          newStock: matched?.stock ?? 0,
          operatorId: `OP-MGR (${operatorName})`,
          operatorName,
          reason:
            'Batch Clear & Reconcile — Auditor Clearance: Quarantine & Damaged Flags Cleared · Regional Conflict Reconciled',
          warehouse: matched?.warehouse || 'Bay Area Hub (WH-01)',
          notes: cleanNote
        };
      });

      // Best-effort persistence to backend audit log endpoint
      await Promise.allSettled(
        newEntries.map((entry) =>
          fetch('/api/inventory/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: entry.sku,
              productName: entry.productName,
              adjustmentValue: 0,
              adjustmentType: 'reconciliation',
              previousStock: entry.previousStock,
              newStock: entry.newStock,
              operatorId: entry.operatorId,
              operatorName: entry.operatorName,
              reason: entry.reason,
              warehouse: entry.warehouse,
              notes: entry.notes
            })
          })
        )
      );

      setWarehouseAuditLogs((prev) => {
        const next = [...newEntries, ...prev];
        warehouseAuditLogsRef.current = next;
        return next;
      });

      setResolvedRegionalConflictSkus((prev) =>
        Array.from(new Set([...prev, ...normalizedSkus]))
      );
      setReconciledDiscrepancySkus((prev) =>
        Array.from(new Set([...prev, ...normalizedSkus]))
      );
      setWarehouseConflicts((prev) =>
        prev.filter((c) => !normalizedSkus.includes(c.sku.trim().toUpperCase()))
      );
      setSelectedDiscrepancySkus((prev) =>
        prev.filter((s) => !normalizedSkus.includes(s.trim().toUpperCase()))
      );
      setChartDrilldownSku((prev) =>
        prev && normalizedSkus.includes(prev.trim().toUpperCase()) ? null : prev
      );

      addAlert(
        'success',
        'Batch Clear & Reconcile Complete',
        `Cleared & reconciled ${normalizedSkus.length} SKU discrepanc${
          normalizedSkus.length === 1 ? 'y' : 'ies'
        } (${normalizedSkus.slice(0, 3).join(', ')}${
          normalizedSkus.length > 3 ? ` +${normalizedSkus.length - 3}` : ''
        }) with audit note.`
      );

      return {
        success: true,
        reconciledCount: normalizedSkus.length,
        skus: newEntries.map((e) => e.sku),
        auditNote: cleanNote,
        timestamp: nowIso
      };
    },
    [products, userProfile, addAlert]
  );

  const executeStockRebalanceTransfers = useCallback(
    async (
      transfers: {
        productId: string;
        sku: string;
        productName: string;
        sourceWarehouse: string;
        destWarehouse: string;
        quantity: number;
        affectsPrimaryProductStock: 'inbound_restock' | 'reconcile_only';
      }[]
    ): Promise<{
      success: boolean;
      executedCount: number;
      totalUnitsTransferred: number;
      timestamp: string;
    }> => {
      const valid = transfers.filter((t) => t.quantity > 0);
      const nowIso = new Date().toISOString();
      if (valid.length === 0) {
        return {
          success: false,
          executedCount: 0,
          totalUnitsTransferred: 0,
          timestamp: nowIso
        };
      }

      const operatorName = userProfile?.displayName || 'Warehouse Manager';
      const currentLogs = warehouseAuditLogsRef.current;
      const latestTs = currentLogs.reduce((max, log) => {
        const ts = new Date(log.timestamp).getTime();
        return Number.isFinite(ts) && ts > max ? ts : max;
      }, 0);
      const baseMs = Math.max(Date.now(), latestTs + 1000);

      const totalUnitsTransferred = valid.reduce((acc, t) => acc + t.quantity, 0);
      const normalizedSkus = Array.from(
        new Set(valid.map((t) => t.sku.trim().toUpperCase()))
      );

      // Update local product stock for transfers bringing units into a deficit primary warehouse
      const inboundByProductId: Record<string, number> = {};
      valid.forEach((t) => {
        if (t.affectsPrimaryProductStock === 'inbound_restock') {
          inboundByProductId[t.productId] =
            (inboundByProductId[t.productId] || 0) + t.quantity;
        }
      });

      const auditEntries: SkuAuditLogEntry[] = valid.map((t, idx) => {
        const matched = products.find((p) => p.id === t.productId);
        const prevStock = matched?.stock ?? 0;
        const delta =
          t.affectsPrimaryProductStock === 'inbound_restock' ? t.quantity : 0;
        const nextStock = prevStock + delta;

        return {
          id: _getUniqueId('AUD-REB'),
          sku: t.sku,
          productId: t.productId,
          productName: t.productName,
          timestamp: new Date(baseMs + idx * 400).toISOString(),
          adjustmentValue: delta,
          adjustmentType: delta > 0 ? 'restock' : 'reconciliation',
          previousStock: prevStock,
          newStock: nextStock,
          operatorId: `OP-MGR (${operatorName})`,
          operatorName,
          reason: `Automated Stock Rebalance — Inter-Warehouse Transfer (${t.quantity}u)`,
          warehouse: t.destWarehouse,
          notes: `Transferred ${t.quantity} unit(s) from ${t.sourceWarehouse} to ${t.destWarehouse} to normalize regional inventory levels.`
        };
      });

      // Apply inbound restocks to backend (best-effort) and local state
      await Promise.allSettled([
        ...Object.entries(inboundByProductId).map(([productId, qty]) =>
          fetch('/api/inventory/restock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity: qty })
          })
        ),
        ...auditEntries.map((entry) =>
          fetch('/api/inventory/audit-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sku: entry.sku,
              productName: entry.productName,
              adjustmentValue: entry.adjustmentValue,
              adjustmentType: entry.adjustmentType,
              previousStock: entry.previousStock,
              newStock: entry.newStock,
              operatorId: entry.operatorId,
              operatorName: entry.operatorName,
              reason: entry.reason,
              warehouse: entry.warehouse,
              notes: entry.notes
            })
          })
        )
      ]);

      if (Object.keys(inboundByProductId).length > 0) {
        setProducts((prev) =>
          prev.map((p) =>
            inboundByProductId[p.id]
              ? { ...p, stock: p.stock + inboundByProductId[p.id] }
              : p
          )
        );
      }

      setWarehouseAuditLogs((prev) => {
        const next = [...auditEntries, ...prev];
        warehouseAuditLogsRef.current = next;
        return next;
      });

      setResolvedRegionalConflictSkus((prev) =>
        Array.from(new Set([...prev, ...normalizedSkus]))
      );
      setWarehouseConflicts((prev) =>
        prev.filter((c) => !normalizedSkus.includes(c.sku.trim().toUpperCase()))
      );

      addAlert(
        'success',
        'Automated Stock Rebalance Dispatched',
        `Executed ${valid.length} inter-warehouse transfer${
          valid.length === 1 ? '' : 's'
        } (${totalUnitsTransferred} total units) to normalize regional stock levels.`
      );

      return {
        success: true,
        executedCount: valid.length,
        totalUnitsTransferred,
        timestamp: nowIso
      };
    },
    [products, userProfile, addAlert]
  );

  // Check and dispatch automated notifications for triggered price alerts
  const checkAndTriggerInventoryAlerts = useCallback((productId: string, updates: { price?: number, stock?: number }, prodName?: string, lowStockThreshold?: number) => {
    setInventoryAlerts(prevAlerts => {
      let hasChanges = false;
      const updated = prevAlerts.map(alert => {
        if (alert.productId === productId) {
          let updatedAlert = { ...alert };
          if (updates.price !== undefined) updatedAlert.currentPrice = updates.price;
          
          let justTriggered = false;

          // Price Check
          if (updates.price !== undefined && alert.targetPrice && updates.price <= alert.targetPrice && alert.status !== 'triggered') {
            hasChanges = true;
            justTriggered = true;
            const savings = Math.max(0, alert.originalPriceAtCreation - updates.price);
            const savingsText = savings > 0 ? ` (Save $${savings.toFixed(2)}!)` : '';

            addAlert(
              'success',
              '🎯 Target Price Met!',
              `"${alert.productName}" dropped to $${updates.price.toFixed(2)} (Target: ≤$${alert.targetPrice.toFixed(2)})${savingsText}. Ready for immediate checkout!`
            );
            playPriceDropChime();

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`🎯 Price Drop Alert: ${alert.productName}`, {
                  body: `Price reached $${updates.price.toFixed(2)} (Target: ≤$${alert.targetPrice.toFixed(2)})!`,
                  icon: alert.productImage || '/favicon.ico'
                });
              } catch {}
            }

            updatedAlert.status = 'triggered';
            updatedAlert.triggeredAt = new Date().toISOString();
            updatedAlert.triggeredPrice = updates.price;
          }

          // Restock Check
          if (updates.stock !== undefined && alert.notifyOnRestock && updates.stock > 0) {
            hasChanges = true;
            justTriggered = true;
            addAlert('success', '📦 Back in Stock!', `"${alert.productName}" is now back in stock!`);
            playPriceDropChime();
            updatedAlert.notifyOnRestock = false;
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try { new Notification(`📦 Restock Alert: ${alert.productName}`, { body: `The product is back in stock.`, icon: alert.productImage || '/favicon.ico' }); } catch {}
            }
          }

          // Low Stock Check
          if (updates.stock !== undefined && alert.notifyOnLowStock && updates.stock > 0 && updates.stock <= (lowStockThreshold || 5)) {
            hasChanges = true;
            justTriggered = true;
            addAlert('warning', '⚠️ Low Stock Alert!', `"${alert.productName}" is running low (${updates.stock} left).`);
            playPriceDropChime();
            updatedAlert.notifyOnLowStock = false;
            
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try { new Notification(`⚠️ Low Stock: ${alert.productName}`, { body: `Only ${updates.stock} left.`, icon: alert.productImage || '/favicon.ico' }); } catch {}
            }
          }

          if (updates.price !== undefined && !hasChanges) {
             hasChanges = true;
          }

          return updatedAlert;
        }
        return alert;
      });
      return hasChanges ? updated : prevAlerts;
    });
  }, [addAlert, playPriceDropChime]);

  // Fetch initial catalog & metrics
  const fetchInitialData = useCallback(async () => {
    try {
      const [prodRes, metricsRes, ordersRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/metrics'),
        fetch('/api/orders')
      ]);
      if (prodRes.ok) {
        const pData = await prodRes.json();
        const rawList: Product[] = pData.products || [];
        const mappedList = rawList.map(p => ({
          ...p,
          isWishlisted: wishlistProductIds.includes(p.id),
          wishlist: wishlistProductIds.includes(p.id)
        }));
        setProducts(mappedList);

        // Auto-detect mobile QR code scan link (?product=<id> or ?sku=<sku> or hash)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const target = params.get('product') || params.get('productId') || params.get('sku');
          if (target) {
            const found = mappedList.find(
              p => p.id === target || p.sku.toLowerCase() === target.toLowerCase()
            );
            if (found) {
              setQuickViewProduct(found);
            }
          }
        }

        // Check alerts against loaded catalog
        for (const item of mappedList) {
          checkAndTriggerInventoryAlerts(item.id, { price: item.price }, item.name);
        }
      }
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }
      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
    } catch (err) {
      console.error('Initial data fetch error:', err);
    }
  }, []);

  // Setup WebSocket connection and SSE fallback
  useEffect(() => {
    fetchInitialData();

    let ws: WebSocket | null = null;
    let sse: EventSource | null = null;
    let reconnectTimeout: any = null;

    function handleRealtimeMessage(data: RealtimeMessage) {
      if (data.type === 'inventory:sync') {
        if (data.payload.products) {
          const synced: Product[] = data.payload.products;
          setProducts(synced.map(p => ({
            ...p,
            isWishlisted: wishlistProductIds.includes(p.id),
            wishlist: wishlistProductIds.includes(p.id)
          })));

          for (const item of synced) {
            checkAndTriggerInventoryAlerts(item.id, { price: item.price }, item.name);
          }
        }
        if (data.payload.activeConflicts) {
          setWarehouseConflicts(data.payload.activeConflicts);
        }
      } else if (data.type === 'warehouse:conflict') {
        const conflict: WarehouseConflictEvent = data.payload;
        setWarehouseConflicts(prev => {
          if (prev.some(c => c.id === conflict.id)) return prev;
          return [conflict, ...prev];
        });
        playConflictChime();
        addAlert('critical', '⚠️ Real-Time Warehouse Conflict', conflict.message);
      } else if (data.type === 'inventory:update') {
        const { productId, stock, reserved } = data.payload;
        setProducts(prev => prev.map(p => {
          if (p.id === productId) {
            checkAndTriggerInventoryAlerts(productId, { stock }, p.name, p.lowStockThreshold);
            return { ...p, stock, reserved };
          }
          return p;
        }));

        // Update cart if stock dropped below cart quantity
        setCart(prevCart => prevCart.map(item => {
          if (item.product.id === productId && item.quantity > stock) {
            return {
              ...item,
              quantity: Math.max(0, stock)
            };
          }
          return item;
        }).filter(item => item.quantity > 0));

      } else if (data.type === 'inventory:alert') {
        const { level, message, productName } = data.payload;
        if (level === 'out_of_stock') {
          addAlert('critical', 'Out of Stock Alert', message);
        } else if (level === 'low_stock') {
          addAlert('warning', 'Low Inventory Alert', message);
        } else if (level === 'restocked') {
          addAlert('success', 'Restock Confirmed', message);
        }
      } else if (data.type === 'activity:purchase') {
        const { orderNumber, productName, quantity, city, country, total } = data.payload;
        const newAct: ActivityItem = {
          id: _getUniqueId("act"),
          orderNumber,
          productName,
          quantity,
          city,
          country,
          total,
          timestamp: 'Just now'
        };
        setRecentActivity(prev => [newAct, ...prev.slice(0, 9)]);
        
        // Update metrics counter
        setMetrics(prev => ({
          ...prev,
          ordersProcessedToday: prev.ordersProcessedToday + 1
        }));
      } else if (data.type === 'price:update') {
        const { productId, newPrice, oldPrice, productName } = data.payload;
        setProducts(prev => prev.map(p => {
          if (p.id === productId) {
            return {
              ...p,
              price: newPrice,
              originalPrice: p.originalPrice || oldPrice
            };
          }
          return p;
        }));

        setQuickViewProduct(prev => {
          if (prev && prev.id === productId) {
            return {
              ...prev,
              price: newPrice,
              originalPrice: prev.originalPrice || oldPrice
            };
          }
          return prev;
        });

        checkAndTriggerInventoryAlerts(productId, { price: newPrice }, productName);
      } else if (data.type === 'review:add') {
        const { productId, review, rating, reviewCount } = data.payload;
        setProducts(prev => prev.map(p => {
          if (p.id === productId) {
            const currentReviews = p.reviews || [];
            if (currentReviews.some(r => r.id === review.id)) return p;
            const updated = [review, ...currentReviews];
            return {
              ...p,
              reviews: updated,
              rating: rating ?? p.rating,
              reviewCount: reviewCount ?? updated.length
            };
          }
          return p;
        }));

        setQuickViewProduct(prev => {
          if (prev && prev.id === productId) {
            const currentReviews = prev.reviews || [];
            if (currentReviews.some(r => r.id === review.id)) return prev;
            const updated = [review, ...currentReviews];
            return {
              ...prev,
              reviews: updated,
              rating: rating ?? prev.rating,
              reviewCount: reviewCount ?? updated.length
            };
          }
          return prev;
        });
      } else if (data.type === 'review:vote') {
        const { productId, reviewId, helpfulCount } = data.payload;
        setProducts(prev => prev.map(p => {
          if (p.id === productId && p.reviews) {
            return {
              ...p,
              reviews: p.reviews.map(r => r.id === reviewId ? { ...r, helpfulCount } : r)
            };
          }
          return p;
        }));

        setQuickViewProduct(prev => {
          if (prev && prev.id === productId && prev.reviews) {
            return {
              ...prev,
              reviews: prev.reviews.map(r => r.id === reviewId ? { ...r, helpfulCount } : r)
            };
          }
          return prev;
        });
      }
    }

    function connectWebSocket() {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setConnectionStatus('connected');
        };

        ws.onmessage = (event) => {
          try {
            const data: RealtimeMessage = JSON.parse(event.data);
            handleRealtimeMessage(data);
          } catch (e) {
            console.error('Error parsing WS message', e);
          }
        };

        ws.onerror = () => {
          // If WS encounters error, setup SSE fallback
          setupSSE();
        };

        ws.onclose = () => {
          setConnectionStatus('reconnecting');
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        };
      } catch {
        setupSSE();
      }
    }

    function setupSSE() {
      if (sse) return;
      try {
        sse = new EventSource('/api/events');
        sse.onopen = () => {
          setConnectionStatus('fallback');
        };
        sse.onmessage = (event) => {
          try {
            const data: RealtimeMessage = JSON.parse(event.data);
            handleRealtimeMessage(data);
          } catch (e) {
            console.error('Error parsing SSE message', e);
          }
        };
        sse.onerror = () => {
          setConnectionStatus('reconnecting');
        };
      } catch (err) {
        console.error('SSE initialization error:', err);
      }
    }

    connectWebSocket();

    // Re-poll metrics periodically
    const metricsInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch {
        // silent
      }
    }, 15000);

    return () => {
      if (ws) ws.close();
      if (sse) sse.close();
      clearTimeout(reconnectTimeout);
      clearInterval(metricsInterval);
    };
  }, [fetchInitialData, addAlert]);

  // Cart operations
  const addToCart = (
    product: Product,
    quantity = 1,
    options?: { silentToast?: boolean }
  ): { success: boolean; message?: string } => {
    // Check real-time stock
    const currentProd = products.find(p => p.id === product.id) || product;
    const existing = cart.find(c => c.product.id === product.id);
    const existingQty = existing ? existing.quantity : 0;
    const totalDesired = existingQty + quantity;

    if (currentProd.stock <= 0) {
      addAlert('critical', 'Out of Stock', `"${currentProd.name}" is currently sold out in all fulfillment centers.`);
      return { success: false, message: 'Item is sold out' };
    }

    if (totalDesired > currentProd.stock) {
      addAlert('warning', 'Inventory Limit Reached', `Cannot add ${quantity} more. Only ${currentProd.stock} unit(s) available in stock.`);
      return { success: false, message: `Only ${currentProd.stock} available` };
    }

    setCart(prev => {
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product: currentProd, quantity }];
    });

    if (!options?.silentToast) {
      addAlert('info', 'Added to Cart', `${quantity}x "${currentProd.name}" reserved in cart.`);
    }
    return { success: true };
  };

  const quickBuy = (product: Product): { success: boolean; message?: string } => {
    const res = addToCart(product, 1, { silentToast: true });
    if (res.success) {
      addAlert(
        'success',
        '⚡ Quick Buy Confirmed',
        `"${product.name}" added to cart for $${product.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}. 1 unit reserved for instant checkout!`
      );
    }
    return res;
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (quantity > prod.stock) {
      addAlert('warning', 'Stock Limit', `Only ${prod.stock} unit(s) available.`);
      setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: prod.stock } : item));
      return;
    }

    setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Catalog Multi-Select Bulk Actions
  const toggleSelectCatalogProduct = useCallback((productId: string) => {
    setSelectedCatalogProductIds(prev =>
      prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
    );
  }, []);

  const selectAllCatalogProducts = useCallback((productIds?: string[]) => {
    if (productIds && productIds.length > 0) {
      setSelectedCatalogProductIds(Array.from(new Set(productIds)));
    } else {
      setSelectedCatalogProductIds(products.map(p => p.id));
    }
  }, [products]);

  const clearSelectedCatalogProducts = useCallback(() => {
    setSelectedCatalogProductIds([]);
  }, []);

  const bulkAddSelectedToCart = useCallback((): { addedCount: number; outOfStockCount: number } => {
    const selectedProds = products.filter(p => selectedCatalogProductIds.includes(p.id));
    if (selectedProds.length === 0) return { addedCount: 0, outOfStockCount: 0 };

    let addedCount = 0;
    let outOfStockCount = 0;

    selectedProds.forEach(product => {
      if (product.stock > 0) {
        const res = addToCart(product, 1, { silentToast: true });
        if (res.success) {
          addedCount++;
        }
      } else {
        outOfStockCount++;
      }
    });

    if (addedCount > 0) {
      addAlert(
        'success',
        'Bulk Items Added to Cart',
        `Successfully added ${addedCount} item${addedCount > 1 ? 's' : ''} to your cart.${
          outOfStockCount > 0
            ? ` (${outOfStockCount} out-of-stock item${outOfStockCount > 1 ? 's were' : ' was'} omitted)`
            : ''
        }`
      );
      setIsCartOpen(true);
    } else if (outOfStockCount > 0) {
      addAlert(
        'warning',
        'Selected Items Out of Stock',
        `All ${outOfStockCount} selected item${outOfStockCount > 1 ? 's are' : ' is'} currently sold out in all fulfillment centers.`
      );
    }

    return { addedCount, outOfStockCount };
  }, [products, selectedCatalogProductIds, addToCart, addAlert, setIsCartOpen]);

  const bulkAddSelectedToWarehouseQueue = useCallback(() => {
    if (selectedCatalogProductIds.length === 0) return;
    setAdminSelectedProductIds(prev => Array.from(new Set([...prev, ...selectedCatalogProductIds])));
    setAdminActiveTab('batch');
    setIsAdminOpen(true);
    addAlert(
      'info',
      'Queued for Warehouse Batch Update',
      `Loaded ${selectedCatalogProductIds.length} SKU${selectedCatalogProductIds.length > 1 ? 's' : ''} into the warehouse Bulk Inventory Update queue.`
    );
  }, [selectedCatalogProductIds, addAlert, setAdminSelectedProductIds, setAdminActiveTab, setIsAdminOpen]);

  const openAdminForProduct = useCallback((product: Product) => {
    setAdminTargetProductId(product.id);
    setAdminActiveTab('inventory');
    setIsAdminOpen(true);
  }, []);

  // Payment & Checkout
  const processCheckout = async (payload: {
    shippingDetails: ShippingDetails;
    paymentDetails: PaymentFormState;
    discountCode?: string;
  }): Promise<{ success: boolean; order?: Order; error?: string }> => {
    if (cart.length === 0) {
      return { success: false, error: 'Your cart is empty' };
    }

    try {
      const checkoutPayload = {
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          price: item.product.price,
          quantity: item.quantity,
          image: item.product.images[0]
        })),
        shippingDetails: payload.shippingDetails,
        paymentDetails: payload.paymentDetails,
        discountCode: payload.discountCode
      };

      const res = await fetch('/api/checkout/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Payment gateway declined transaction.'
        };
      }

      // Order succeeded
      clearCart();
      setActiveOrder(data.order);
      setOrders(prev => [data.order, ...prev]);
      addAlert('success', 'Order Confirmed', `Order ${data.order.orderNumber} successfully placed! Tracking ID: ${data.order.trackingNumber}`);
      return { success: true, order: data.order };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network timeout connecting to payment processor.'
      };
    }
  };

  // Admin Restock
  const restockProduct = async (productId: string, quantity: number) => {
    if (connectionStatus === 'fallback' || connectionStatus === 'reconnecting') {
      const offlineItem = { type: 'restock', payload: { productId, quantity }, timestamp: Date.now() };
      setOfflineInventoryQueue(prev => [...prev, offlineItem]);
      addAlert('warning', 'Offline Mode', `Restock of +${quantity} queued. It will sync when connection is restored.`);
      
      // Optimistically update local state
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, stock: p.stock + quantity } : p
      ));
      
      return true;
    }
  
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });
      return res.ok;
    } catch {
      const offlineItem = { type: 'restock', payload: { productId, quantity }, timestamp: Date.now() };
      setOfflineInventoryQueue(prev => [...prev, offlineItem]);
      addAlert('warning', 'Offline Mode', `Restock of +${quantity} queued. It will sync when connection is restored.`);
      
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, stock: p.stock + quantity } : p
      ));
      
      return true;
    }
  };

  // Admin Batch Restock / Inventory Adjustment
  const batchAdjustStock = async (params: {
    productIds: string[];
    adjustmentType: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
  }): Promise<{ success: boolean; updatedCount?: number; message?: string; error?: string }> => {
    if (connectionStatus === 'fallback' || connectionStatus === 'reconnecting') {
      const offlineItem = { type: 'batch-adjust', payload: params, timestamp: Date.now() };
      setOfflineInventoryQueue(prev => [...prev, offlineItem]);
      addAlert('warning', 'Offline Mode', `Batch adjustment queued. It will sync when connection is restored.`);

      // Optimistically update products state immediately for instant feedback
      setProducts(prev =>
        prev.map(p => {
          if (!params.productIds.includes(p.id) && !params.productIds.includes(p.sku)) {
            return p;
          }
          let newStock = p.stock;
          if (params.adjustmentType === 'add') {
            newStock += params.quantity;
          } else if (params.adjustmentType === 'subtract') {
            newStock = Math.max(0, p.stock - params.quantity);
          } else if (params.adjustmentType === 'set') {
            newStock = Math.max(0, params.quantity);
          }
          return { ...p, stock: newStock };
        })
      );

      return { success: true, updatedCount: params.productIds.length, message: `Successfully queued update for ${params.productIds.length} items.` };
    }

    try {
      const res = await fetch('/api/inventory/batch-adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to apply batch update' };
      }

      // Optimistically update products state immediately for instant feedback
      setProducts(prev =>
        prev.map(p => {
          if (!params.productIds.includes(p.id) && !params.productIds.includes(p.sku)) {
            return p;
          }
          let newStock = p.stock;
          if (params.adjustmentType === 'add') {
            newStock += params.quantity;
          } else if (params.adjustmentType === 'subtract') {
            newStock = Math.max(0, p.stock - params.quantity);
          } else if (params.adjustmentType === 'set') {
            newStock = Math.max(0, params.quantity);
          }
          return { ...p, stock: newStock };
        })
      );

      const actionText =
        params.adjustmentType === 'add'
          ? `+${params.quantity} units each`
          : params.adjustmentType === 'subtract'
          ? `-${params.quantity} units each`
          : `set to ${params.quantity} units`;

      addAlert(
        'success',
        'Batch Inventory Update Completed',
        `Successfully updated stock for ${data.updatedCount || params.productIds.length} SKUs (${actionText}). Real-time warehouse telemetry broadcasted!`
      );

      // Refresh live audit logs so any Quarantine or Damage adjustment immediately triggers the persistent Flagged Audit Alert toast
      void refreshWarehouseAuditLogs();

      return {
        success: true,
        updatedCount: data.updatedCount || params.productIds.length,
        message: data.message
      };
    } catch (err: any) {
      const offlineItem = { type: 'batch-adjust', payload: params, timestamp: Date.now() };
      setOfflineInventoryQueue(prev => [...prev, offlineItem]);
      addAlert('warning', 'Offline Mode', `Batch adjustment queued. It will sync when connection is restored.`);

      setProducts(prev =>
        prev.map(p => {
          if (!params.productIds.includes(p.id) && !params.productIds.includes(p.sku)) {
            return p;
          }
          let newStock = p.stock;
          if (params.adjustmentType === 'add') {
            newStock += params.quantity;
          } else if (params.adjustmentType === 'subtract') {
            newStock = Math.max(0, p.stock - params.quantity);
          } else if (params.adjustmentType === 'set') {
            newStock = Math.max(0, params.quantity);
          }
          return { ...p, stock: newStock };
        })
      );

      return { success: true, updatedCount: params.productIds.length, message: `Successfully queued update for ${params.productIds.length} items.` };
    }
  };

  // Sync Offline Queued Inventory Updates
  const syncOfflineInventory = useCallback(async () => {
    if (offlineInventoryQueue.length === 0) return;

    let syncedCount = 0;
    const remainingQueue: any[] = [];

    for (const item of offlineInventoryQueue) {
      try {
        if (item.type === 'restock') {
          const res = await fetch('/api/inventory/restock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          if (res.ok) syncedCount++;
          else remainingQueue.push(item);
        } else if (item.type === 'batch-adjust') {
          const res = await fetch('/api/inventory/batch-adjust', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          if (res.ok) syncedCount++;
          else remainingQueue.push(item);
        }
      } catch {
        remainingQueue.push(item);
      }
    }

    setOfflineInventoryQueue(remainingQueue);

    if (syncedCount > 0) {
      addAlert('success', 'Offline Queue Synced', `Successfully processed ${syncedCount} queued warehouse inventory updates.`);
      fetchInitialData();
    }
  }, [offlineInventoryQueue, fetchInitialData]);

  // Auto-sync offline actions when connection restored
  useEffect(() => {
    if (connectionStatus === 'connected' && offlineInventoryQueue.length > 0) {
      syncOfflineInventory();
    }
  }, [connectionStatus, offlineInventoryQueue.length, syncOfflineInventory]);

  // Simulation of external concurrent shopper
  const simulateExternalPurchase = async (productId?: string) => {
    try {
      const res = await fetch('/api/inventory/simulate-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
      });
      if (res.ok) {
        try {
          const data = await res.json();
          if (data?.product?.id && typeof data.product.stock === 'number') {
            setProducts(prev =>
              prev.map(p =>
                p.id === data.product.id
                  ? { ...p, stock: data.product.stock, reserved: data.product.reserved ?? p.reserved }
                  : p
              )
            );
          }
        } catch {
          // WebSocket broadcast will still update stock
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  // Auto-Replenishment Rules & Automatic Draft Purchase Orders
  const [autoReplenishmentRules, setAutoReplenishmentRules] = useState<
    Record<string, AutoReplenishmentRule>
  >(() => {
    try {
      const saved = localStorage.getItem('omnistore_auto_replenishment_rules');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [autoReplenishmentDraftPOs, setAutoReplenishmentDraftPOs] = useState<
    AutoReplenishmentDraftPO[]
  >(() => {
    try {
      const saved = localStorage.getItem('omnistore_auto_replenishment_draft_pos');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const autoReplenishmentDraftPOsRef = useRef<AutoReplenishmentDraftPO[]>(autoReplenishmentDraftPOs);
  useEffect(() => {
    autoReplenishmentDraftPOsRef.current = autoReplenishmentDraftPOs;
    try {
      localStorage.setItem(
        'omnistore_auto_replenishment_draft_pos',
        JSON.stringify(autoReplenishmentDraftPOs)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [autoReplenishmentDraftPOs]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'omnistore_auto_replenishment_rules',
        JSON.stringify(autoReplenishmentRules)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [autoReplenishmentRules]);

  // Tracks dismissed threshold signatures so a dismissed draft won't re-spawn until stock drops further or target increases
  const dismissedAutoPoSigRef = useRef<Record<string, string>>({});

  const createDraftPOObject = useCallback(
    (
      product: Product,
      targetStock: number,
      warehouse: string,
      triggerSource: AutoReplenishmentDraftPO['triggerSource']
    ): AutoReplenishmentDraftPO => {
      const orderQuantity = Math.max(1, targetStock - product.stock);
      const unitWholesaleCost = Math.max(1, Math.round(product.price * 0.62));
      const poSuffix = Math.floor(1000 + Math.random() * 9000);
      return {
        id: _getUniqueId('AUTO-PO'),
        poNumber: `PO-AUTO-${poSuffix}`,
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        productImage: product.images?.[0] || '',
        warehouse,
        currentStockAtTrigger: product.stock,
        targetStock,
        orderQuantity,
        unitWholesaleCost,
        estimatedTotalCost: orderQuantity * unitWholesaleCost,
        status: 'draft',
        triggerSource,
        createdAt: new Date().toISOString()
      };
    },
    []
  );

  const appendAutoReplenishAuditEntry = useCallback(
    (
      product: Product,
      reason: string,
      notes: string,
      adjustmentValue = 0,
      previousStock = product.stock,
      newStock = product.stock,
      adjustmentType: SkuAuditLogEntry['adjustmentType'] = 'reconciliation',
      warehouseOverride?: string
    ) => {
      const operatorName = userProfile?.displayName || 'Auto-Replenishment Engine';
      const entry: SkuAuditLogEntry = {
        id: _getUniqueId('AUD-AUTO'),
        sku: product.sku,
        productId: product.id,
        productName: product.name,
        timestamp: new Date().toISOString(),
        adjustmentValue,
        adjustmentType,
        previousStock,
        newStock,
        operatorId: `AUTO-PO (${operatorName})`,
        operatorName,
        reason,
        warehouse: warehouseOverride || product.warehouse,
        notes
      };

      setWarehouseAuditLogs(prev => {
        const next = [entry, ...prev];
        warehouseAuditLogsRef.current = next;
        return next;
      });

      fetch('/api/inventory/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: entry.sku,
          productName: entry.productName,
          adjustmentValue: entry.adjustmentValue,
          adjustmentType: entry.adjustmentType,
          previousStock: entry.previousStock,
          newStock: entry.newStock,
          operatorId: entry.operatorId,
          operatorName: entry.operatorName,
          reason: entry.reason,
          warehouse: entry.warehouse,
          notes: entry.notes
        })
      }).catch(() => {
        // best-effort backend audit persistence
      });
    },
    [userProfile]
  );

  // Reactive watcher: triggers automatic draft POs whenever live stock drops below an active rule's target stock
  useEffect(() => {
    if (products.length === 0) return;
    const activeRules = (Object.values(autoReplenishmentRules) as AutoReplenishmentRule[]).filter(r => r.enabled);
    if (activeRules.length === 0) return;

    const currentDrafts = autoReplenishmentDraftPOsRef.current;
    const newlyCreated: AutoReplenishmentDraftPO[] = [];
    const updatedDraftMap = new Map<string, AutoReplenishmentDraftPO>();

    for (const rule of activeRules) {
      const prod = products.find(p => p.id === rule.productId);
      if (!prod) continue;

      if (prod.stock < rule.targetStock) {
        const sig = `${prod.stock}:${rule.targetStock}`;
        const existingDraft = currentDrafts.find(
          po => po.productId === prod.id && po.status === 'draft'
        );

        if (!existingDraft) {
          if (dismissedAutoPoSigRef.current[prod.id] === sig) {
            continue;
          }
          const draft = createDraftPOObject(
            prod,
            rule.targetStock,
            rule.warehouse || prod.warehouse,
            'stock_drop'
          );
          newlyCreated.push(draft);

          appendAutoReplenishAuditEntry(
            prod,
            `Auto-Replenishment Draft PO Triggered (${draft.poNumber})`,
            `Stock (${prod.stock}) fell below target threshold (${rule.targetStock}). Draft PO for +${draft.orderQuantity} units generated automatically for ${draft.warehouse}.`,
            0,
            prod.stock,
            prod.stock,
            'reconciliation',
            draft.warehouse
          );

          addAlert(
            'warning',
            `Draft PO Triggered: ${draft.poNumber}`,
            `${prod.sku} stock (${prod.stock}) dropped below target (${rule.targetStock}). Auto-drafted PO for +${draft.orderQuantity} units.`
          );
        } else {
          // Keep open draft PO synced if stock drops further below target
          const neededQty = Math.max(1, rule.targetStock - prod.stock);
          if (
            prod.stock < existingDraft.currentStockAtTrigger ||
            existingDraft.targetStock !== rule.targetStock
          ) {
            updatedDraftMap.set(existingDraft.id, {
              ...existingDraft,
              currentStockAtTrigger: prod.stock,
              targetStock: rule.targetStock,
              orderQuantity: neededQty,
              estimatedTotalCost: neededQty * existingDraft.unitWholesaleCost
            });
          }
        }
      } else {
        // Stock recovered above threshold: clear any prior dismissal signature so future drops re-trigger cleanly
        if (dismissedAutoPoSigRef.current[prod.id]) {
          delete dismissedAutoPoSigRef.current[prod.id];
        }
      }
    }

    if (newlyCreated.length > 0 || updatedDraftMap.size > 0) {
      setAutoReplenishmentDraftPOs(prev => {
        const mapped = prev.map(po => updatedDraftMap.get(po.id) || po);
        return [...newlyCreated, ...mapped];
      });
    }
  }, [
    products,
    autoReplenishmentRules,
    createDraftPOObject,
    appendAutoReplenishAuditEntry,
    addAlert
  ]);

  const setAutoReplenishmentRule = useCallback(
    (
      product: Product,
      config: { enabled: boolean; targetStock: number; warehouse?: string }
    ): AutoReplenishmentDraftPO | null => {
      const liveProduct = products.find(p => p.id === product.id) || product;
      const sanitizedTarget = Math.max(1, Math.min(9999, Math.round(config.targetStock)));
      const warehouse = config.warehouse || liveProduct.warehouse;

      const updatedRule: AutoReplenishmentRule = {
        productId: liveProduct.id,
        sku: liveProduct.sku,
        productName: liveProduct.name,
        warehouse,
        enabled: config.enabled,
        targetStock: sanitizedTarget,
        updatedAt: new Date().toISOString()
      };

      // Clear any previous dismissal signature when user explicitly updates/enables the rule
      if (config.enabled) {
        delete dismissedAutoPoSigRef.current[liveProduct.id];
      }

      setAutoReplenishmentRules(prev => ({
        ...prev,
        [liveProduct.id]: updatedRule
      }));

      if (!config.enabled) {
        addAlert(
          'info',
          'Auto-Replenishment Paused',
          `Automatic draft PO generation disabled for ${liveProduct.sku}.`
        );
        return null;
      }

      // Immediately trigger or sync draft PO if current stock is already below target
      if (liveProduct.stock < sanitizedTarget) {
        const existingDraft = autoReplenishmentDraftPOsRef.current.find(
          po => po.productId === liveProduct.id && po.status === 'draft'
        );

        if (existingDraft) {
          const neededQty = Math.max(1, sanitizedTarget - liveProduct.stock);
          const updatedPo: AutoReplenishmentDraftPO = {
            ...existingDraft,
            warehouse,
            currentStockAtTrigger: liveProduct.stock,
            targetStock: sanitizedTarget,
            orderQuantity: neededQty,
            estimatedTotalCost: neededQty * existingDraft.unitWholesaleCost
          };
          setAutoReplenishmentDraftPOs(prev => {
            const next = prev.map(po => (po.id === existingDraft.id ? updatedPo : po));
            autoReplenishmentDraftPOsRef.current = next;
            return next;
          });
          addAlert(
            'warning',
            `Draft PO Updated: ${updatedPo.poNumber}`,
            `${liveProduct.sku} target set to ${sanitizedTarget} units (current: ${liveProduct.stock}). Draft PO adjusted to +${neededQty} units.`
          );
          return updatedPo;
        }

        const draft = createDraftPOObject(
          liveProduct,
          sanitizedTarget,
          warehouse,
          'threshold_configured'
        );
        setAutoReplenishmentDraftPOs(prev => {
          const next = [draft, ...prev];
          autoReplenishmentDraftPOsRef.current = next;
          return next;
        });

        appendAutoReplenishAuditEntry(
          liveProduct,
          `Auto-Replenishment Draft PO Triggered (${draft.poNumber})`,
          `Auto-Replenishment enabled with target stock ${sanitizedTarget} (current: ${liveProduct.stock}). Draft PO for +${draft.orderQuantity} units generated for ${warehouse}.`,
          0,
          liveProduct.stock,
          liveProduct.stock,
          'reconciliation',
          warehouse
        );

        addAlert(
          'warning',
          `Auto-Replenishment Triggered: ${draft.poNumber}`,
          `Stock (${liveProduct.stock}) is below target (${sanitizedTarget}). Created draft PO for +${draft.orderQuantity} units of ${liveProduct.sku}.`
        );
        return draft;
      }

      addAlert(
        'success',
        'Auto-Replenishment Enabled',
        `Monitoring ${liveProduct.sku}: automatic draft PO will trigger if stock drops below ${sanitizedTarget} units.`
      );
      return null;
    },
    [products, createDraftPOObject, appendAutoReplenishAuditEntry, addAlert]
  );

  const updateAutoReplenishmentDraftPOQty = useCallback(
    (poId: string, newQuantity: number) => {
      const clampedQty = Math.max(1, Math.min(9999, Math.round(newQuantity)));
      setAutoReplenishmentDraftPOs(prev =>
        prev.map(po =>
          po.id === poId && po.status === 'draft'
            ? {
                ...po,
                orderQuantity: clampedQty,
                estimatedTotalCost: clampedQty * po.unitWholesaleCost
              }
            : po
        )
      );
    },
    []
  );

  const dismissAutoReplenishmentDraftPO = useCallback(
    (poId: string) => {
      const targetPo = autoReplenishmentDraftPOsRef.current.find(po => po.id === poId);
      if (targetPo) {
        const liveProd = products.find(p => p.id === targetPo.productId);
        const currentStock = liveProd ? liveProd.stock : targetPo.currentStockAtTrigger;
        dismissedAutoPoSigRef.current[targetPo.productId] = `${currentStock}:${targetPo.targetStock}`;
      }

      setAutoReplenishmentDraftPOs(prev =>
        prev.map(po => (po.id === poId ? { ...po, status: 'dismissed' } : po))
      );

      if (targetPo) {
        addAlert(
          'info',
          'Draft PO Dismissed',
          `${targetPo.poNumber} for ${targetPo.sku} was dismissed. Future drops below target will create a fresh draft.`
        );
      }
    },
    [products, addAlert]
  );

  const approveAutoReplenishmentDraftPO = useCallback(
    async (poId: string): Promise<boolean> => {
      const targetPo = autoReplenishmentDraftPOsRef.current.find(
        po => po.id === poId && po.status === 'draft'
      );
      if (!targetPo) return false;

      const liveProd = products.find(p => p.id === targetPo.productId);
      const prevStock = liveProd?.stock ?? targetPo.currentStockAtTrigger;
      let resolvedNewStock = prevStock + targetPo.orderQuantity;

      try {
        const res = await fetch('/api/inventory/restock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: targetPo.productId,
            quantity: targetPo.orderQuantity
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.product && typeof data.product.stock === 'number') {
            resolvedNewStock = data.product.stock;
          }
          setProducts(prev =>
            prev.map(p =>
              p.id === targetPo.productId ? { ...p, stock: resolvedNewStock } : p
            )
          );
        } else {
          await restockProduct(targetPo.productId, targetPo.orderQuantity);
        }
      } catch {
        await restockProduct(targetPo.productId, targetPo.orderQuantity);
      }

      const nowIso = new Date().toISOString();
      setAutoReplenishmentDraftPOs(prev =>
        prev.map(po =>
          po.id === poId
            ? { ...po, status: 'approved', approvedAt: nowIso }
            : po
        )
      );

      if (liveProd) {
        appendAutoReplenishAuditEntry(
          liveProd,
          `Auto-Replenishment PO Approved (${targetPo.poNumber})`,
          `Approved draft purchase order ${targetPo.poNumber}: replenished +${targetPo.orderQuantity} units to ${targetPo.warehouse} (Stock: ${prevStock} -> ${resolvedNewStock}, Target: ${targetPo.targetStock}).`,
          targetPo.orderQuantity,
          prevStock,
          resolvedNewStock,
          'restock',
          targetPo.warehouse
        );
      }

      addAlert(
        'success',
        `Purchase Order Approved: ${targetPo.poNumber}`,
        `Restocked +${targetPo.orderQuantity} units of ${targetPo.sku} (${prevStock} → ${resolvedNewStock} units).`
      );
      return true;
    },
    [products, restockProduct, appendAutoReplenishAuditEntry, addAlert]
  );

  // Batch Auto-Restock Engine (<20% of maximum recorded capacity over the last 30 days)
  const [isBatchAutoRestockEnabled, setIsBatchAutoRestockEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omnistore_batch_auto_restock_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [recorded30dPeakCapacity, setRecorded30dPeakCapacity] = useState<
    Record<string, CapacityPeakRecord[]>
  >(() => {
    try {
      const saved = localStorage.getItem('omnistore_30d_capacity_peaks');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [autoRestockRequests, setAutoRestockRequests] = useState<AutoRestockRequest[]>(() => {
    try {
      const saved = localStorage.getItem('omnistore_auto_restock_requests');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const autoRestockRequestsRef = useRef<AutoRestockRequest[]>(autoRestockRequests);
  const dismissedAutoRestockSigRef = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      localStorage.setItem(
        'omnistore_batch_auto_restock_enabled',
        JSON.stringify(isBatchAutoRestockEnabled)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [isBatchAutoRestockEnabled]);

  useEffect(() => {
    autoRestockRequestsRef.current = autoRestockRequests;
    try {
      localStorage.setItem(
        'omnistore_auto_restock_requests',
        JSON.stringify(autoRestockRequests)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [autoRestockRequests]);

  useEffect(() => {
    try {
      localStorage.setItem(
        'omnistore_30d_capacity_peaks',
        JSON.stringify(recorded30dPeakCapacity)
      );
    } catch {
      // ignore storage quota errors
    }
  }, [recorded30dPeakCapacity]);

  // Continuously record live stock high-water marks within the rolling 30-day window
  useEffect(() => {
    if (products.length === 0) return;
    setRecorded30dPeakCapacity(prev => {
      const { next, changed } = updateRecorded30DayPeaks(prev, products);
      return changed ? next : prev;
    });
  }, [products]);

  const sku30DayCapacityMap = useMemo(
    () =>
      computeSku30DayCapacityMap(
        products,
        orders,
        warehouseAuditLogs,
        recorded30dPeakCapacity
      ),
    [products, orders, warehouseAuditLogs, recorded30dPeakCapacity]
  );

  // Reactive watcher: when Auto-Restock is ON, automatically generates restock requests
  // whenever any SKU falls below 20% of its maximum recorded capacity for the last 30 days
  useEffect(() => {
    if (!isBatchAutoRestockEnabled || products.length === 0) return;

    const currentRequests = autoRestockRequestsRef.current;
    const newlyGenerated: AutoRestockRequest[] = [];
    const updatedMap = new Map<string, AutoRestockRequest>();

    for (const product of products) {
      const cap = sku30DayCapacityMap[product.id];
      if (!cap) continue;

      if (cap.isBelow20Pct) {
        const sig = `${product.stock}:${cap.maxCapacity30d}`;
        const existingPending = currentRequests.find(
          req => req.productId === product.id && req.status === 'pending'
        );

        if (!existingPending) {
          if (dismissedAutoRestockSigRef.current[product.id] === sig) {
            continue;
          }

          const unitWholesaleCost = Math.max(1, Math.round(product.price * 0.62));
          const reqSuffix = Math.floor(1000 + Math.random() * 9000);
          const triggerReason = `Stock (${product.stock}u) fell below 20% of 30-day max capacity (${cap.maxCapacity30d}u · ${cap.capacityRatioPercent.toFixed(1)}%)`;

          const newReq: AutoRestockRequest = {
            id: _getUniqueId('AUTO-RST'),
            requestNumber: `RST-AUTO-${reqSuffix}`,
            productId: product.id,
            sku: product.sku,
            productName: product.name,
            productImage: product.images?.[0] || '',
            warehouse: product.warehouse,
            currentStock: product.stock,
            maxCapacity30d: cap.maxCapacity30d,
            capacityRatioPercent: cap.capacityRatioPercent,
            thresholdUnits20Pct: cap.thresholdUnits20Pct,
            requestedQuantity: cap.recommendedRestockQty,
            unitWholesaleCost,
            estimatedCost: cap.recommendedRestockQty * unitWholesaleCost,
            status: 'pending',
            triggerReason,
            createdAt: new Date().toISOString()
          };

          newlyGenerated.push(newReq);

          appendAutoReplenishAuditEntry(
            product,
            `Auto-Restock Request Generated (${newReq.requestNumber})`,
            `${triggerReason}. Auto-generated restock request for +${newReq.requestedQuantity} units to restore capacity.`,
            0,
            product.stock,
            product.stock,
            'reconciliation',
            product.warehouse
          );
        } else if (
          existingPending.currentStock !== product.stock ||
          existingPending.maxCapacity30d !== cap.maxCapacity30d
        ) {
          const nextQty = Math.max(existingPending.requestedQuantity, cap.recommendedRestockQty);
          updatedMap.set(existingPending.id, {
            ...existingPending,
            currentStock: product.stock,
            maxCapacity30d: cap.maxCapacity30d,
            capacityRatioPercent: cap.capacityRatioPercent,
            thresholdUnits20Pct: cap.thresholdUnits20Pct,
            requestedQuantity: nextQty,
            estimatedCost: nextQty * existingPending.unitWholesaleCost,
            triggerReason: `Stock (${product.stock}u) fell below 20% of 30-day max capacity (${cap.maxCapacity30d}u · ${cap.capacityRatioPercent.toFixed(1)}%)`
          });
        }
      } else {
        if (dismissedAutoRestockSigRef.current[product.id]) {
          delete dismissedAutoRestockSigRef.current[product.id];
        }
      }
    }

    if (newlyGenerated.length > 0 || updatedMap.size > 0) {
      setAutoRestockRequests(prev => {
        const mapped = prev.map(req => updatedMap.get(req.id) || req);
        const next = [...newlyGenerated, ...mapped];
        autoRestockRequestsRef.current = next;
        return next;
      });
    }

    if (newlyGenerated.length === 1) {
      const r = newlyGenerated[0];
      addAlert(
        'warning',
        `Auto-Restock Request: ${r.requestNumber}`,
        `${r.sku} dropped to ${r.currentStock}/${r.maxCapacity30d}u (${r.capacityRatioPercent.toFixed(1)}% < 20% 30d max). Queued +${r.requestedQuantity}u restock request.`
      );
    } else if (newlyGenerated.length > 1) {
      const skuPreview = newlyGenerated
        .slice(0, 3)
        .map(r => r.sku)
        .join(', ');
      const extra = newlyGenerated.length > 3 ? ` +${newlyGenerated.length - 3} more` : '';
      addAlert(
        'warning',
        `${newlyGenerated.length} Auto-Restock Requests Generated`,
        `SKUs below 20% of 30-day max capacity (${skuPreview}${extra}) now have pending restock requests in the Batch tab.`
      );
    }
  }, [
    isBatchAutoRestockEnabled,
    products,
    sku30DayCapacityMap,
    appendAutoReplenishAuditEntry,
    addAlert
  ]);

  const setBatchAutoRestockEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        // Clear previous dismissal locks so toggling ON runs a fresh evaluation
        dismissedAutoRestockSigRef.current = {};
      }
      setIsBatchAutoRestockEnabledState(enabled);

      if (enabled) {
        const belowCount = products.filter(p => sku30DayCapacityMap[p.id]?.isBelow20Pct).length;
        if (belowCount === 0) {
          addAlert(
            'success',
            'Auto-Restock Enabled (<20% 30d Cap)',
            'Live monitoring active. All SKUs are currently at or above 20% of their 30-day maximum recorded capacity.'
          );
        } else {
          addAlert(
            'info',
            'Auto-Restock Enabled (<20% 30d Cap)',
            `Scanning ${products.length} SKUs — detected ${belowCount} SKU${belowCount === 1 ? '' : 's'} below 20% of 30-day max capacity.`
          );
        }
      } else {
        addAlert(
          'info',
          'Auto-Restock Paused',
          'Automatic 20% 30-day capacity restock generation is paused. Existing pending requests remain available.'
        );
      }
    },
    [products, sku30DayCapacityMap, addAlert]
  );

  const updateAutoRestockRequestQty = useCallback((requestId: string, newQuantity: number) => {
    const qty = Math.max(1, Math.min(500, Math.round(newQuantity || 1)));
    setAutoRestockRequests(prev => {
      const next = prev.map(req =>
        req.id === requestId && req.status === 'pending'
          ? { ...req, requestedQuantity: qty, estimatedCost: qty * req.unitWholesaleCost }
          : req
      );
      autoRestockRequestsRef.current = next;
      return next;
    });
  }, []);

  const dismissAutoRestockRequest = useCallback(
    (requestId: string) => {
      const target = autoRestockRequestsRef.current.find(r => r.id === requestId);
      if (!target) return;
      dismissedAutoRestockSigRef.current[target.productId] = `${target.currentStock}:${target.maxCapacity30d}`;
      setAutoRestockRequests(prev => {
        const next = prev.map(req =>
          req.id === requestId ? { ...req, status: 'dismissed' as const } : req
        );
        autoRestockRequestsRef.current = next;
        return next;
      });
      addAlert(
        'info',
        `Restock Request Dismissed (${target.requestNumber})`,
        `Dismissed auto-restock request for ${target.sku}. Will re-trigger if stock drops further.`
      );
    },
    [addAlert]
  );

  const fulfillAutoRestockRequest = useCallback(
    async (requestId: string): Promise<boolean> => {
      const target = autoRestockRequestsRef.current.find(r => r.id === requestId);
      if (!target || target.status !== 'pending') return false;

      const prod = products.find(p => p.id === target.productId);
      const prevStock = prod ? prod.stock : target.currentStock;
      const ok = await restockProduct(target.productId, target.requestedQuantity);
      if (!ok) return false;

      const nowIso = new Date().toISOString();
      setAutoRestockRequests(prev => {
        const next = prev.map(req =>
          req.id === requestId
            ? { ...req, status: 'fulfilled' as const, fulfilledAt: nowIso }
            : req
        );
        autoRestockRequestsRef.current = next;
        return next;
      });

      if (prod) {
        appendAutoReplenishAuditEntry(
          prod,
          `Auto-Restock Fulfilled (${target.requestNumber})`,
          `Fulfilled 30-day capacity Auto-Restock request: added +${target.requestedQuantity} units (${prevStock} → ${prevStock + target.requestedQuantity}u vs ${target.maxCapacity30d}u 30d max).`,
          target.requestedQuantity,
          prevStock,
          prevStock + target.requestedQuantity,
          'restock',
          target.warehouse
        );
      }

      addAlert(
        'success',
        `Restock Fulfilled: ${target.requestNumber}`,
        `Added +${target.requestedQuantity} units to ${target.sku} (${prevStock} → ${prevStock + target.requestedQuantity} units).`
      );
      return true;
    },
    [products, restockProduct, appendAutoReplenishAuditEntry, addAlert]
  );

  const fulfillAllPendingAutoRestockRequests = useCallback(async (): Promise<{
    fulfilledCount: number;
    totalUnits: number;
  }> => {
    const pending = autoRestockRequestsRef.current.filter(r => r.status === 'pending');
    let fulfilledCount = 0;
    let totalUnits = 0;
    for (const req of pending) {
      const ok = await fulfillAutoRestockRequest(req.id);
      if (ok) {
        fulfilledCount += 1;
        totalUnits += req.requestedQuantity;
      }
    }
    return { fulfilledCount, totalUnits };
  }, [fulfillAutoRestockRequest]);

  // Background WebSocket Auto-Sync (60-second stock telemetry refresh for selected SKUs)
  const [isAutoSyncEnabled, setIsAutoSyncEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omnistore_warehouse_auto_sync_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [autoSyncStatus, setAutoSyncStatus] = useState<'idle' | 'connecting' | 'active' | 'reconnecting'>('idle');
  const [autoSyncLastRefreshedAt, setAutoSyncLastRefreshedAt] = useState<string | null>(null);
  const [autoSyncNextRefreshAt, setAutoSyncNextRefreshAt] = useState<number | null>(null);
  const [autoSyncSyncedCount, setAutoSyncSyncedCount] = useState<number>(0);
  const [autoSyncScopedToSelection, setAutoSyncScopedToSelection] = useState<boolean>(false);

  const autoSyncWsRef = useRef<WebSocket | null>(null);
  const adminSelectedIdsRef = useRef<string[]>(adminSelectedProductIds);

  useEffect(() => {
    adminSelectedIdsRef.current = adminSelectedProductIds;
  }, [adminSelectedProductIds]);

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_warehouse_auto_sync_enabled', JSON.stringify(isAutoSyncEnabled));
    } catch {
      // ignore storage quota errors
    }
  }, [isAutoSyncEnabled]);

  const applyTelemetryRefreshPayload = useCallback(
    (payload: {
      scopedToSelection?: boolean;
      syncedSkuCount?: number;
      intervalMs?: number;
      items?: {
        id: string;
        sku: string;
        stock: number;
        reserved: number;
        lowStockThreshold: number;
        price: number;
        warehouse: string;
      }[];
      metrics?: WarehouseStockMetrics;
      serverTimestamp?: string;
    }) => {
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        const byId = new Map(payload.items.map(item => [item.id, item]));
        setProducts(prev =>
          prev.map(p => {
            const fresh = byId.get(p.id);
            if (!fresh) return p;
            return {
              ...p,
              stock: fresh.stock,
              reserved: fresh.reserved,
              lowStockThreshold: fresh.lowStockThreshold,
              price: fresh.price,
              warehouse: fresh.warehouse
            };
          })
        );
      }

      if (payload.metrics) {
        setMetrics(payload.metrics);
      }

      const intervalMs = Number(payload.intervalMs) || 60000;
      setAutoSyncSyncedCount(payload.syncedSkuCount ?? payload.items?.length ?? 0);
      setAutoSyncScopedToSelection(Boolean(payload.scopedToSelection));
      setAutoSyncLastRefreshedAt(
        new Date(payload.serverTimestamp || Date.now()).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
      setAutoSyncNextRefreshAt(Date.now() + intervalMs);
    },
    []
  );

  // Dedicated background WebSocket lifecycle for 60s SKU stock telemetry refresh
  useEffect(() => {
    if (!isAutoSyncEnabled) {
      const existing = autoSyncWsRef.current;
      if (existing) {
        try {
          if (existing.readyState === WebSocket.OPEN) {
            existing.send(JSON.stringify({ type: 'telemetry:unsubscribe' }));
          }
          existing.close();
        } catch {
          // ignore close errors
        }
        autoSyncWsRef.current = null;
      }
      setAutoSyncStatus('idle');
      setAutoSyncNextRefreshAt(null);
      return;
    }

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let ws: WebSocket | null = null;

    const openAutoSyncSocket = () => {
      if (cancelled) return;
      setAutoSyncStatus(prev => (prev === 'idle' ? 'connecting' : 'reconnecting'));

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?channel=warehouse-auto-sync`;
        ws = new WebSocket(wsUrl);
        autoSyncWsRef.current = ws;

        ws.onopen = () => {
          if (cancelled || !ws) return;
          setAutoSyncStatus('active');
          ws.send(
            JSON.stringify({
              type: 'telemetry:subscribe',
              payload: {
                productIds: adminSelectedIdsRef.current,
                intervalMs: 60000
              }
            })
          );
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg: RealtimeMessage = JSON.parse(event.data);
            if (msg.type === 'telemetry:refresh' && msg.payload) {
              applyTelemetryRefreshPayload(msg.payload);
            }
          } catch (err) {
            console.error('Auto-Sync WS parse error:', err);
          }
        };

        ws.onerror = () => {
          if (cancelled) return;
          try {
            ws?.close();
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          if (autoSyncWsRef.current === ws) {
            autoSyncWsRef.current = null;
          }
          if (!cancelled) {
            setAutoSyncStatus('reconnecting');
            reconnectTimer = setTimeout(openAutoSyncSocket, 4000);
          }
        };
      } catch {
        if (!cancelled) {
          setAutoSyncStatus('reconnecting');
          reconnectTimer = setTimeout(openAutoSyncSocket, 4000);
        }
      }
    };

    openAutoSyncSocket();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'telemetry:unsubscribe' }));
          }
          ws.close();
        } catch {
          // ignore
        }
      }
      if (autoSyncWsRef.current === ws) {
        autoSyncWsRef.current = null;
      }
    };
  }, [isAutoSyncEnabled, applyTelemetryRefreshPayload]);

  // Dynamically re-scope the live 60s WebSocket subscription whenever selected SKUs change
  useEffect(() => {
    if (!isAutoSyncEnabled) return;
    const ws = autoSyncWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'telemetry:subscribe',
          payload: {
            productIds: adminSelectedProductIds,
            intervalMs: 60000
          }
        })
      );
    }
  }, [adminSelectedProductIds, isAutoSyncEnabled]);

  const setIsAutoSyncEnabled = useCallback(
    (enabled: boolean) => {
      setIsAutoSyncEnabledState(enabled);
      if (enabled) {
        const scopeLabel =
          adminSelectedIdsRef.current.length > 0
            ? `${adminSelectedIdsRef.current.length} selected SKU${adminSelectedIdsRef.current.length === 1 ? '' : 's'}`
            : 'all active warehouse SKUs';
        addAlert(
          'success',
          'Background Auto-Sync Enabled (60s)',
          `Opened real-time WebSocket stream refreshing stock telemetry for ${scopeLabel} every 60 seconds.`
        );
      } else {
        addAlert(
          'info',
          'Background Auto-Sync Paused',
          'Closed background 60-second WebSocket telemetry refresh stream.'
        );
      }
    },
    [addAlert]
  );

  const triggerAutoSyncNow = useCallback(() => {
    const ws = autoSyncWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: 'telemetry:pull',
          payload: { productIds: adminSelectedIdsRef.current }
        })
      );
    }
  }, []);

  // Batch Decommission obsolete SKUs (strictly enforces stock === 0)
  const batchDecommissionProducts = useCallback(
    async (
      productIds: string[],
      reason?: string
    ): Promise<{
      success: boolean;
      decommissionedCount: number;
      decommissionedSkus: string[];
      blockedProducts: { id: string; sku: string; name: string; stock: number }[];
      error?: string;
      timestamp: string;
    }> => {
      const nowIso = new Date().toISOString();
      const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));

      if (uniqueIds.length === 0) {
        return {
          success: false,
          decommissionedCount: 0,
          decommissionedSkus: [],
          blockedProducts: [],
          error: 'Select at least one zero-stock SKU to decommission.',
          timestamp: nowIso
        };
      }

      const targets = uniqueIds
        .map(id => products.find(p => p.id === id || p.sku === id))
        .filter((p): p is Product => Boolean(p));

      if (targets.length === 0) {
        return {
          success: false,
          decommissionedCount: 0,
          decommissionedSkus: [],
          blockedProducts: [],
          error: 'No matching SKUs found in active inventory.',
          timestamp: nowIso
        };
      }

      // Strict client-side zero-stock enforcement
      const blockedProducts = targets
        .filter(p => p.stock > 0)
        .map(p => ({ id: p.id, sku: p.sku, name: p.name, stock: p.stock }));

      if (blockedProducts.length > 0) {
        const msg = `Decommission blocked: ${blockedProducts.length} SKU(s) still hold stock (${blockedProducts
          .slice(0, 3)
          .map(b => `${b.sku}: ${b.stock}u`)
          .join(', ')}). Only zero-stock (0u) products can be decommissioned.`;
        addAlert('critical', 'Zero-Stock Enforcement Blocked Removal', msg);
        return {
          success: false,
          decommissionedCount: 0,
          decommissionedSkus: [],
          blockedProducts,
          error: msg,
          timestamp: nowIso
        };
      }

      const cleanReason =
        reason?.trim() ||
        'Obsolete zero-stock SKU decommissioned from active warehouse catalog.';
      const operatorName = userProfile?.displayName || 'Warehouse Manager';
      const decommissionIds = targets.map(p => p.id);
      const decommissionIdSet = new Set(decommissionIds);
      const decommissionSkuSet = new Set(targets.map(p => p.sku.trim().toUpperCase()));

      let serverAuditEntries: SkuAuditLogEntry[] = [];
      try {
        const res = await fetch('/api/inventory/batch-decommission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productIds: decommissionIds,
            reason: cleanReason,
            operatorName
          })
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg =
            data?.error || 'Server rejected decommission request due to stock validation.';
          addAlert('critical', 'Decommission Rejected', errMsg);
          return {
            success: false,
            decommissionedCount: 0,
            decommissionedSkus: [],
            blockedProducts: data?.blockedProducts || [],
            error: errMsg,
            timestamp: nowIso
          };
        }
        if (Array.isArray(data.auditEntries)) {
          serverAuditEntries = data.auditEntries;
        }
      } catch {
        // Proceed with local state decommission if offline
      }

      const localAuditEntries: SkuAuditLogEntry[] =
        serverAuditEntries.length > 0
          ? serverAuditEntries
          : targets.map(prod => ({
              id: _getUniqueId('AUD-DEC'),
              sku: prod.sku,
              productId: prod.id,
              productName: prod.name,
              timestamp: nowIso,
              adjustmentValue: 0,
              adjustmentType: 'reconciliation',
              previousStock: 0,
              newStock: 0,
              operatorId: `OP-MGR (${operatorName})`,
              operatorName,
              reason: 'Batch Decommission — Obsolete SKU Removed',
              warehouse: prod.warehouse,
              notes: cleanReason
            }));

      // Remove decommissioned products from live catalog & dependent states
      setProducts(prev => {
        const remaining = prev.filter(p => !decommissionIdSet.has(p.id));
        setMetrics(m => ({
          ...m,
          totalSkus: remaining.length,
          unitsInStock: remaining.reduce((sum, item) => sum + item.stock, 0),
          lowStockItemsCount: remaining.filter(
            item => item.stock > 0 && item.stock <= item.lowStockThreshold
          ).length
        }));
        return remaining;
      });

      setCart(prev => prev.filter(item => !decommissionIdSet.has(item.product.id)));
      setWishlistProductIds(prev => prev.filter(id => !decommissionIdSet.has(id)));
      setComparedProductIds(prev => prev.filter(id => !decommissionIdSet.has(id)));
      setAdminSelectedProductIds(prev => prev.filter(id => !decommissionIdSet.has(id)));
      setSelectedCatalogProductIds(prev => prev.filter(id => !decommissionIdSet.has(id)));
      setInventoryAlerts(prev => prev.filter(a => !decommissionIdSet.has(a.productId)));
      setWarehouseConflicts(prev =>
        prev.filter(
          c =>
            !decommissionIdSet.has(c.productId) &&
            !decommissionSkuSet.has(c.sku.trim().toUpperCase())
        )
      );
      setSelectedDiscrepancySkus(prev =>
        prev.filter(s => !decommissionSkuSet.has(s.trim().toUpperCase()))
      );
      setAutoReplenishmentRules(prev => {
        const next = { ...prev };
        for (const id of decommissionIds) {
          delete next[id];
        }
        return next;
      });
      setAutoReplenishmentDraftPOs(prev =>
        prev.filter(po => !decommissionIdSet.has(po.productId))
      );

      setQuickViewProduct(prev => (prev && decommissionIdSet.has(prev.id) ? null : prev));
      setSkuAdjustProduct(prev => (prev && decommissionIdSet.has(prev.id) ? null : prev));
      setQrCodeProduct(prev => (prev && decommissionIdSet.has(prev.id) ? null : prev));
      setAdminTargetProductId(prev => (prev && decommissionIdSet.has(prev) ? null : prev));

      setWarehouseAuditLogs(prev => {
        const existingIds = new Set(prev.map(l => l.id));
        const fresh = localAuditEntries.filter(l => !existingIds.has(l.id));
        const next = [...fresh, ...prev];
        warehouseAuditLogsRef.current = next;
        return next;
      });

      const decommissionedSkus = targets.map(p => p.sku);
      addAlert(
        'success',
        'Batch Decommission Complete',
        `Permanently removed ${targets.length} obsolete zero-stock SKU${
          targets.length === 1 ? '' : 's'
        } (${decommissionedSkus.slice(0, 3).join(', ')}${
          decommissionedSkus.length > 3 ? ` +${decommissionedSkus.length - 3}` : ''
        }).`
      );

      return {
        success: true,
        decommissionedCount: targets.length,
        decommissionedSkus,
        blockedProducts: [],
        timestamp: nowIso
      };
    },
    [products, userProfile, addAlert]
  );

  // Track order
  const trackOrder = async (orderNumber: string): Promise<Order | null> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderNumber.trim())}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Post Customer Review
  const addReview = async (
    productId: string,
    reviewData: {
      authorName: string;
      rating: number;
      title?: string;
      comment: string;
      location?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to submit review' };
      }

      const newReview: ProductReview = data.review;
      const updatedProduct = data.product;

      // Update products state
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          const currentReviews = p.reviews || [];
          const updatedReviews = [newReview, ...currentReviews.filter(r => r.id !== newReview.id)];
          return {
            ...p,
            reviews: updatedReviews,
            rating: updatedProduct?.rating ?? p.rating,
            reviewCount: updatedProduct?.reviewCount ?? updatedReviews.length
          };
        }
        return p;
      }));

      // Update active quick view modal state
      setQuickViewProduct(prev => {
        if (prev && prev.id === productId) {
          const currentReviews = prev.reviews || [];
          const updatedReviews = [newReview, ...currentReviews.filter(r => r.id !== newReview.id)];
          return {
            ...prev,
            reviews: updatedReviews,
            rating: updatedProduct?.rating ?? prev.rating,
            reviewCount: updatedProduct?.reviewCount ?? updatedReviews.length
          };
        }
        return prev;
      });

      addAlert('success', 'Review Published', 'Your review and star rating have been published successfully!');
      return { success: true };
    } catch (err: any) {
      // Offline fallback
      const localReview: ProductReview = {
        id: _getUniqueId('rev_local'),
        productId,
        authorName: reviewData.authorName,
        rating: reviewData.rating,
        title: reviewData.title,
        comment: reviewData.comment,
        createdAt: new Date().toISOString(),
        verifiedPurchase: true,
        helpfulCount: 0,
        location: reviewData.location
      };

      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          const currentReviews = p.reviews || [];
          const updated = [localReview, ...currentReviews];
          const newAvg = Number((updated.reduce((sum, r) => sum + r.rating, 0) / updated.length).toFixed(1));
          return {
            ...p,
            reviews: updated,
            rating: newAvg,
            reviewCount: updated.length
          };
        }
        return p;
      }));

      setQuickViewProduct(prev => {
        if (prev && prev.id === productId) {
          const currentReviews = prev.reviews || [];
          const updated = [localReview, ...currentReviews];
          const newAvg = Number((updated.reduce((sum, r) => sum + r.rating, 0) / updated.length).toFixed(1));
          return {
            ...prev,
            reviews: updated,
            rating: newAvg,
            reviewCount: updated.length
          };
        }
        return prev;
      });

      addAlert('success', 'Review Saved Locally', 'Your review has been saved and will appear in your session.');
      return { success: true };
    }
  };

  // Vote Review as Helpful
  const voteReviewHelpful = async (productId: string, reviewId: string) => {
    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p.id === productId && p.reviews) {
        return {
          ...p,
          reviews: p.reviews.map(r => r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r)
        };
      }
      return p;
    }));

    setQuickViewProduct(prev => {
      if (prev && prev.id === productId && prev.reviews) {
        return {
          ...prev,
          reviews: prev.reviews.map(r => r.id === reviewId ? { ...r, helpfulCount: (r.helpfulCount || 0) + 1 } : r)
        };
      }
      return prev;
    });

    try {
      await fetch(`/api/products/${productId}/reviews/${reviewId}/vote`, {
        method: 'POST'
      });
    } catch {
      // Ignored in offline mode
    }
  };

  const updateWarehouseTags = (productId: string, tags: string[]) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, warehouseTags: tags } : p));
    setQuickViewProduct(prev => prev && prev.id === productId ? { ...prev, warehouseTags: tags } : prev);
    addAlert('success', 'Warehouse Tags Updated', 'Custom warehouse tags updated successfully.');
  };

  const batchUpdateWarehouseTags = (productIds: string[], tag: string, action: 'add' | 'remove') => {
    const trimmed = tag.trim();
    if (!trimmed || productIds.length === 0) return;

    setProducts(prev =>
      prev.map(p => {
        if (!productIds.includes(p.id)) return p;
        const existingTags = p.warehouseTags || [];
        let newTags = [...existingTags];
        if (action === 'add') {
          if (!newTags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
            newTags.push(trimmed);
          }
        } else {
          newTags = newTags.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
        }
        return { ...p, warehouseTags: newTags };
      })
    );

    addAlert(
      'success',
      'Batch Tags Updated',
      action === 'add'
        ? `Applied tag "${trimmed}" to ${productIds.length} selected items.`
        : `Removed tag "${trimmed}" from ${productIds.length} selected items.`
    );
  };

  // Order History management
  const updateOrderStatus = (orderId: string, newStatus: Order['status']) => {
    setOrders(prev =>
      prev.map(ord => {
        if (ord.id !== orderId) return ord;
        
        const timeline = [...ord.timeline];
        if (newStatus === 'picking') {
          if (timeline[1]) {
            timeline[1].completed = false;
            timeline[1].current = true;
          }
        } else if (newStatus === 'in_transit') {
          if (timeline[1]) {
            timeline[1].completed = true;
            timeline[1].current = false;
          }
          if (timeline[2]) {
            timeline[2].completed = true;
            timeline[2].current = false;
          }
          if (timeline[3]) {
            timeline[3].completed = false;
            timeline[3].current = true;
            timeline[3].timestamp = 'Active Now';
          }
        } else if (newStatus === 'delivered') {
          timeline.forEach(t => {
            t.completed = true;
            t.current = false;
          });
          const last = timeline[timeline.length - 1];
          if (last) {
            last.completed = true;
            last.current = true;
            last.timestamp = 'Just now';
          }
        }

        return {
          ...ord,
          status: newStatus,
          timeline
        };
      })
    );
    addAlert('info', 'Consignment Status Updated', `Order status updated to "${newStatus.replace('_', ' ').toUpperCase()}".`);
  };

  const updateUserProfile = useCallback((profileUpdates: Partial<UserProfile>) => {
    setUserProfile(prev => {
      const updatedFirst = profileUpdates.firstName !== undefined ? profileUpdates.firstName : prev.firstName;
      const updatedLast = profileUpdates.lastName !== undefined ? profileUpdates.lastName : prev.lastName;
      const displayName = profileUpdates.displayName || `${updatedFirst} ${updatedLast}`.trim();
      return {
        ...prev,
        ...profileUpdates,
        displayName
      };
    });
    addAlert('success', 'Profile Updated', 'Account details have been successfully saved.');
  }, [addAlert]);

  const addSavedAddress = useCallback((addressData: Omit<SavedAddress, 'id'>) => {
    const newAddress: SavedAddress = {
      ...addressData,
      id: _getUniqueId('addr')
    };

    setUserProfile(prev => {
      let existing = prev.savedAddresses || [];
      if (newAddress.isDefaultShipping) {
        existing = existing.map(a => ({ ...a, isDefaultShipping: false }));
      }
      if (newAddress.isDefaultBilling) {
        existing = existing.map(a => ({ ...a, isDefaultBilling: false }));
      }
      if (existing.length === 0) {
        newAddress.isDefaultShipping = true;
        newAddress.isDefaultBilling = true;
      }
      return {
        ...prev,
        savedAddresses: [newAddress, ...existing]
      };
    });
    addAlert('success', 'Address Saved', `"${newAddress.label}" was added to your addresses.`);
  }, [addAlert]);

  const updateSavedAddress = useCallback((id: string, updates: Partial<SavedAddress>) => {
    setUserProfile(prev => {
      let list = prev.savedAddresses.map(a => {
        if (a.id === id) {
          return { ...a, ...updates };
        }
        return a;
      });
      if (updates.isDefaultShipping) {
        list = list.map(a => a.id === id ? a : { ...a, isDefaultShipping: false });
      }
      if (updates.isDefaultBilling) {
        list = list.map(a => a.id === id ? a : { ...a, isDefaultBilling: false });
      }
      return {
        ...prev,
        savedAddresses: list
      };
    });
    addAlert('success', 'Address Updated', 'Saved address details updated.');
  }, [addAlert]);

  const deleteSavedAddress = useCallback((id: string) => {
    setUserProfile(prev => {
      const addressToDelete = prev.savedAddresses.find(a => a.id === id);
      const remaining = prev.savedAddresses.filter(a => a.id !== id);
      if (addressToDelete?.isDefaultShipping && remaining.length > 0) {
        remaining[0].isDefaultShipping = true;
      }
      if (addressToDelete?.isDefaultBilling && remaining.length > 0) {
        remaining[0].isDefaultBilling = true;
      }
      return {
        ...prev,
        savedAddresses: remaining
      };
    });
    addAlert('info', 'Address Removed', 'Address removed from your profile.');
  }, [addAlert]);

  const setDefaultShippingAddress = useCallback((id: string) => {
    setUserProfile(prev => ({
      ...prev,
      savedAddresses: prev.savedAddresses.map(a => ({
        ...a,
        isDefaultShipping: a.id === id
      }))
    }));
    addAlert('success', 'Default Shipping Set', 'Primary shipping address updated.');
  }, [addAlert]);

  const setDefaultBillingAddress = useCallback((id: string) => {
    setUserProfile(prev => ({
      ...prev,
      savedAddresses: prev.savedAddresses.map(a => ({
        ...a,
        isDefaultBilling: a.id === id
      }))
    }));
    addAlert('success', 'Default Billing Set', 'Primary billing address updated.');
  }, [addAlert]);

  const updateCommunicationPreferences = useCallback((preferences: Partial<CommunicationPreferences>) => {
    setUserProfile(prev => ({
      ...prev,
      communicationPreferences: {
        ...prev.communicationPreferences,
        ...preferences
      }
    }));
    addAlert('success', 'Preferences Saved', 'Your communication settings have been saved.');
  }, [addAlert]);

  const reorderItems = (order: Order) => {
    order.items.forEach(item => {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        addToCart(prod, item.quantity);
      } else {
        setCart(prev => {
          const existing = prev.find(c => c.product.id === item.productId);
          if (existing) {
            return prev.map(c => c.product.id === item.productId ? { ...c, quantity: c.quantity + item.quantity } : c);
          }
          return [
            ...prev,
            {
              product: {
                id: item.productId,
                sku: item.sku,
                name: item.name,
                price: item.price,
                images: [item.image],
                tagline: 'Professional grade hardware',
                description: 'Professional grade hardware from past order.',
                category: 'workstation',
                stock: 10,
                reserved: 0,
                lowStockThreshold: 3,
                warehouse: order.warehouseAssigned || 'Bay Area Hub (WH-01)',
                features: [],
                specs: {},
                rating: 5.0,
                reviewCount: 42,
                warranty: 'Standard Warranty'
              },
              quantity: item.quantity
            }
          ];
        });
      }
    });

    setIsOrderHistoryOpen(false);
    setIsCartOpen(true);
    addAlert('success', 'Order Replaced in Cart', `Added ${order.items.length} item(s) from Order ${order.orderNumber} to your cart!`);
  };

  const addSampleOrder = () => {
    const newOrd = createSampleOrder();
    setOrders(prev => [newOrd, ...prev]);
    addAlert('success', 'Demo Order Added', `Generated sample consignment ${newOrd.orderNumber} in order history.`);
  };

  const deleteOrder = (orderId: string) => {
    setOrders(prev => prev.filter(o => o.id !== orderId));
    addAlert('info', 'Order Removed', 'Order record removed from local history.');
  };

  // Compare products operations
  const toggleCompareProduct = (productId: string) => {
    setComparedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      }
      if (prev.length >= 4) {
        addAlert('warning', 'Comparison Limit', 'You can compare up to 4 products at a time.');
        return prev;
      }
      const prod = products.find(p => p.id === productId);
      if (prod) {
        addAlert('info', 'Added to Comparison', `"${prod.name}" added to side-by-side comparison tray (${prev.length + 1}/4).`);
      }
      return [...prev, productId];
    });
  };

  const clearComparison = () => {
    setComparedProductIds([]);
    setIsCompareModalOpen(false);
  };

  // Wishlist toggle & check
  const toggleWishlist = useCallback((productId: string) => {
    setWishlistProductIds(prev => {
      const isAlreadyWishlisted = prev.includes(productId);
      const next = isAlreadyWishlisted ? prev.filter(id => id !== productId) : [...prev, productId];

      const prod = products.find(p => p.id === productId);
      const prodName = prod ? prod.name : 'Hardware item';

      if (isAlreadyWishlisted) {
        addAlert('info', 'Wishlist Updated', `Removed "${prodName}" from your hardware wishlist.`);
      } else {
        addAlert('success', 'Saved to Wishlist', `Added "${prodName}" to your hardware wishlist.`);
      }

      return next;
    });

    setProducts(prev =>
      prev.map(p => {
        if (p.id === productId) {
          const nextVal = !p.isWishlisted;
          return { ...p, isWishlisted: nextVal, wishlist: nextVal };
        }
        return p;
      })
    );

    setQuickViewProduct(prev => {
      if (prev && prev.id === productId) {
        const nextVal = !prev.isWishlisted;
        return { ...prev, isWishlisted: nextVal, wishlist: nextVal };
      }
      return prev;
    });
  }, [products, addAlert]);

  const isWishlisted = useCallback((productId: string) => {
    return wishlistProductIds.includes(productId);
  }, [wishlistProductIds]);

  // Target Price Alerts CRUD & Actions
  const setInventoryAlert = useCallback((product: Product, options: { targetPrice?: number | null, notifyOnRestock?: boolean, notifyOnLowStock?: boolean, notificationEmail?: string }) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    const roundedTarget = options.targetPrice ? Math.round(options.targetPrice * 100) / 100 : undefined;
    const isMetAlready = roundedTarget ? product.price <= roundedTarget : false;

    setInventoryAlerts(prev => {
      const existingIdx = prev.findIndex(a => a.productId === product.id);

      const baseAlert = existingIdx >= 0 ? prev[existingIdx] : {
        id: _getUniqueId("alt_price"),
        productId: product.id,
        productName: product.name,
        productImage: product.images[0] || '',
        sku: product.sku,
        originalPriceAtCreation: product.price,
        currentPrice: product.price,
        createdAt: new Date().toISOString()
      };

      const newAlert: InventoryAlert = {
        ...baseAlert,
        targetPrice: roundedTarget !== undefined ? roundedTarget : baseAlert.targetPrice,
        notifyOnRestock: options.notifyOnRestock ?? baseAlert.notifyOnRestock,
        notifyOnLowStock: options.notifyOnLowStock ?? baseAlert.notifyOnLowStock,
        notificationEmail: options.notificationEmail?.trim() ?? baseAlert.notificationEmail ?? '',
        status: isMetAlready ? 'triggered' : 'active',
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = newAlert;
        return copy;
      }
      return [...prev, newAlert];
    });

    addAlert('success', 'Alert Saved', `You are now tracking "${product.name}".`);
  }, [addAlert]);

  const removeInventoryAlert = useCallback((productId: string) => {
    setInventoryAlerts(prev => prev.filter(a => a.productId !== productId));
    addAlert('info', 'Watch Cancelled', 'Alert removed.');
  }, [addAlert]);

  const getInventoryAlertForProduct = useCallback((productId: string) => {
    return inventoryAlerts.find(a => a.productId === productId);
  }, [inventoryAlerts]);

  const simulatePriceDrop = useCallback(async (productId?: string, discountPercent: number = 15) => {
    try {
      const res = await fetch('/api/inventory/simulate-price-drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, discountPercent })
      });
      const data = await res.json();
      if (data.success && data.product) {
        const updatedProduct = data.product;
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, price: updatedProduct.price, originalPrice: updatedProduct.originalPrice } : p));
        checkAndTriggerInventoryAlerts(updatedProduct.id, { price: updatedProduct.price }, updatedProduct.name);
        return true;
      }
    } catch (err) {
      console.error('Simulate price drop error:', err);
    }
    return false;
  }, [checkAndTriggerInventoryAlerts]);

  const updateProductPrice = useCallback(async (productId: string, newPrice: number) => {
    try {
      const res = await fetch('/api/inventory/update-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, newPrice })
      });
      const data = await res.json();
      if (data.success && data.product) {
        const updatedProduct = data.product;
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? { ...p, price: updatedProduct.price, originalPrice: updatedProduct.originalPrice } : p));
        checkAndTriggerInventoryAlerts(updatedProduct.id, { price: updatedProduct.price }, updatedProduct.name);
        return true;
      }
    } catch (err) {
      console.error('Update price error:', err);
    }
    return false;
  }, [checkAndTriggerInventoryAlerts]);

  const resetAllPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/reset-prices', { method: 'POST' });
      if (res.ok) {
        addAlert('info', 'Catalogue Reset', 'All product prices have been reset to original values.');
        fetchInitialData();
        return true;
      }
    } catch (err) {
      console.error('Reset prices error:', err);
    }
    return false;
  }, [addAlert, fetchInitialData]);

  // Per-SKU Warehouse Maintenance & Storage Instructions Notes (persisted to localStorage + backend API)
  const [skuNotes, setSkuNotes] = useState<Record<string, SkuWarehouseNote>>(() => {
    const seededDefaults: Record<string, SkuWarehouseNote> = {
      'AUD-REF-8040': {
        text: 'Store upright on anti-vibration pallet; keep clear of magnetic fields (40–55% RH).',
        updatedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Julian Vance'
      },
      'DISP-OLED-49': {
        text: 'Fragile curved QD-OLED panel — stack max 1 high; verify foam corner guards before dispatch.',
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Sora Tanaka'
      },
      'OPT-ANAMOR-35': {
        text: 'Climate dry-cabinet storage only (<35% RH); verify rear mount cap seal after bench QA.',
        updatedAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Mei Chen'
      },
      'COMP-WORKSTATION-X9': {
        text: 'ESD-safe bay required; confirm 15-min thermal burn-in sticker before express staging.',
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updatedBy: 'Raj Patel'
      }
    };
    try {
      const saved = localStorage.getItem('omnistore_sku_warehouse_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...seededDefaults, ...parsed };
        }
      }
    } catch {
      // ignore storage errors
    }
    return seededDefaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem('omnistore_sku_warehouse_notes', JSON.stringify(skuNotes));
    } catch {
      // ignore storage quota errors
    }
  }, [skuNotes]);

  const getSkuNote = useCallback(
    (product: Product): SkuWarehouseNote | null => {
      const skuKey = product.sku.trim().toUpperCase();
      if (Object.prototype.hasOwnProperty.call(skuNotes, skuKey)) {
        const stored = skuNotes[skuKey];
        return stored && stored.text.trim() ? stored : null;
      }
      if (product.warehouseNote && product.warehouseNote.trim()) {
        return {
          text: product.warehouseNote.trim(),
          updatedAt: product.warehouseNoteUpdatedAt || new Date().toISOString(),
          updatedBy: product.warehouseNoteUpdatedBy || 'Warehouse Staff'
        };
      }
      return null;
    },
    [skuNotes]
  );

  const updateSkuNote = useCallback(
    async (productId: string, noteText: string): Promise<boolean> => {
      const target = products.find(p => p.id === productId);
      if (!target) return false;

      const trimmed = noteText.trim().slice(0, 240);
      const author = userProfile?.displayName || 'Warehouse Staff';
      const nowIso = new Date().toISOString();
      const skuKey = target.sku.trim().toUpperCase();

      setSkuNotes(prev => ({
        ...prev,
        [skuKey]: trimmed
          ? { text: trimmed, updatedAt: nowIso, updatedBy: author }
          : { text: '', updatedAt: nowIso, updatedBy: author }
      }));

      setProducts(prev =>
        prev.map(p =>
          p.id === productId
            ? {
                ...p,
                warehouseNote: trimmed,
                warehouseNoteUpdatedAt: trimmed ? nowIso : undefined,
                warehouseNoteUpdatedBy: trimmed ? author : undefined
              }
            : p
        )
      );

      try {
        await fetch('/api/inventory/update-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            note: trimmed,
            updatedBy: author
          })
        });
      } catch {
        // local state + localStorage remain authoritative when offline
      }

      addAlert(
        trimmed ? 'success' : 'info',
        trimmed ? `SKU Note Saved (${target.sku})` : `SKU Note Cleared (${target.sku})`,
        trimmed
          ? `Updated maintenance / storage instructions for ${target.sku}: "${trimmed}"`
          : `Removed maintenance / storage instructions for ${target.sku}.`
      );

      return true;
    },
    [products, userProfile, addAlert]
  );

  const [recentSessionSkus, setRecentSessionSkus] = useState<string[]>([]);

  const trackSkuSearch = useCallback((query: string) => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return;
    setTrendingSkuSearches(prev => {
      const existing = prev.find(s => s.query === normalized);
      let updated;
      if (existing) {
        updated = prev.map(s => s.query === normalized ? { ...s, count: s.count + 1 } : s);
      } else {
        updated = [...prev, { query: normalized, count: 1 }];
      }
      return updated.sort((a, b) => b.count - a.count).slice(0, 5); // Keep top 5
    });

    setRecentSearchedSkus(prev => {
      const upper = normalized;
      const filtered = prev.filter(s => s.toUpperCase() !== upper);
      return [upper, ...filtered].slice(0, 5);
    });

    setRecentSessionSkus(prevSession => {
      if (prevSession[prevSession.length - 1] === normalized) return prevSession;
      const updatedSession = [...prevSession, normalized].slice(-5);

      setSkuCooccurrences(prevCooc => {
        const nextCooc = { ...prevCooc };
        prevSession.forEach(existingSku => {
          if (existingSku !== normalized) {
            if (!nextCooc[normalized]) nextCooc[normalized] = {};
            nextCooc[normalized][existingSku] = (nextCooc[normalized][existingSku] || 0) + 1;

            if (!nextCooc[existingSku]) nextCooc[existingSku] = {};
            nextCooc[existingSku][normalized] = (nextCooc[existingSku][normalized] || 0) + 1;
          }
        });
        return nextCooc;
      });

      return updatedSession;
    });
  }, []);

  const getFrequentlySearchedTogether = useCallback((sku: string): Product[] => {
    const norm = sku.trim().toUpperCase();
    const coocMap = skuCooccurrences[norm] || {};
    const sortedSkus = Object.entries(coocMap)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .map(([s]) => s);

    const result = sortedSkus
      .map(s => products.find(p => p.sku.toUpperCase() === s))
      .filter((p): p is Product => !!p && p.sku.toUpperCase() !== norm);

    if (result.length < 3) {
      const primaryProduct = products.find(p => p.sku.toUpperCase() === norm);
      if (primaryProduct) {
        const sameCategory = products.filter(p => p.category === primaryProduct.category && p.sku.toUpperCase() !== norm && !result.some(r => r.id === p.id));
        result.push(...sameCategory);
      }
    }

    return result.slice(0, 3);
  }, [skuCooccurrences, products]);

  return (
    <StoreContext.Provider
      value={{
        products,
        cart,
        orders,
        activeOrder,
        metrics,
        connectionStatus,
        alerts,
        recentActivity,
        isCartOpen,
        isCheckoutOpen,
        isAdminOpen,
        isDensityHeatmapOpen,
        adminActiveTab,
        adminSelectedProductIds,
        isTrackingOpen,
        quickViewProduct,
        skuAdjustProduct,
        comparedProductIds,
        isCompareModalOpen,
        wishlistProductIds,
        onlyWishlist,
        searchQuery,
        skuSearchQuery,
        trendingSkuSearches,
        selectedCategory,
        sortBy,
        onlyInStock,
        onlyLowStock,
        inventoryAlerts,
        isInventoryAlertModalOpen,
        activeInventoryAlertProduct,
        setIsInventoryAlertModalOpen,
        setActiveInventoryAlertProduct,
        setInventoryAlert,
        removeInventoryAlert,
        getInventoryAlertForProduct,
        simulatePriceDrop,
        updateProductPrice,
        resetAllPrices,
        skuNotes,
        getSkuNote,
        updateSkuNote,
        setSearchQuery,
        setSkuSearchQuery,
        trackSkuSearch,
        setSelectedCategory,
        setSortBy,
        setOnlyInStock,
        setOnlyLowStock,
        isSafeModeEnabled,
        setIsSafeModeEnabled,
        warehouseAuditLogs,
        checkSkuSafety,
        toggleSkuDamagedFlag,
        refreshWarehouseAuditLogs,
        clearSkuAuditFlags,
        bulkQuarantineSkus,
        flaggedAuditAlerts,
        dismissFlaggedAuditAlert,
        globalAuditLogTarget,
        openGlobalSkuAuditLog,
        closeGlobalSkuAuditLog,
        customerDefaultWarehouse,
        setCustomerDefaultWarehouse,
        setOnlyWishlist,
        setIsCartOpen,
        setIsCheckoutOpen,
        setIsAdminOpen,
        setIsDensityHeatmapOpen,
        setAdminActiveTab,
        setAdminSelectedProductIds,
        selectedCatalogProductIds,
        setSelectedCatalogProductIds,
        toggleSelectCatalogProduct,
        selectAllCatalogProducts,
        clearSelectedCatalogProducts,
        bulkAddSelectedToCart,
        bulkAddSelectedToWarehouseQueue,
        setIsTrackingOpen,
        isOrderHistoryOpen,
        setIsOrderHistoryOpen,
        isUserProfileOpen,
        setIsUserProfileOpen,
        userProfile,
        updateUserProfile,
        addSavedAddress,
        updateSavedAddress,
        deleteSavedAddress,
        setDefaultShippingAddress,
        setDefaultBillingAddress,
        updateCommunicationPreferences,
        updateOrderStatus,
        reorderItems,
        addSampleOrder,
        deleteOrder,
        setIsCompareModalOpen,
        toggleCompareProduct,
        clearComparison,
        toggleWishlist,
        isWishlisted,
        setQuickViewProduct,
        setSkuAdjustProduct,
        qrCodeProduct,
        setQrCodeProduct,
        setActiveOrder,
        dismissAlert,
        addAlert,
        addToCart,
        quickBuy,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        processCheckout,
        restockProduct,
        batchAdjustStock,
        simulateExternalPurchase,
        trackOrder,
        offlineInventoryQueue,
        syncOfflineInventory,
        addReview,
        voteReviewHelpful,
        updateWarehouseTags,
        batchUpdateWarehouseTags,
        userReservations,
        reserveItem,
        isReserved,
        showWarehouseTags,
        setShowWarehouseTags,
        tagColorMap,
        setTagColor,
        getFrequentlySearchedTogether,
        recentSearchedSkus,
        maxDeliveryDays,
        setMaxDeliveryDays,
        adminTargetProductId,
        setAdminTargetProductId,
        openAdminForProduct,
        warehouseConflicts,
        highlightedConflictId,
        dismissWarehouseConflict,
        focusOrOpenWarehouseConflictToast,
        resolveWarehouseConflict,
        reportInventoryEditingSession,
        simulateWarehouseConflict,
        chartDrilldownSku,
        setChartDrilldownSku,
        drillDownToInventoryChart,
        resolvedRegionalConflictSkus,
        resolveRegionalConflict,
        getSkuRegionalConflict,
        selectedDiscrepancySkus,
        setSelectedDiscrepancySkus,
        toggleDiscrepancySkuSelection,
        reconciledDiscrepancySkus,
        openBatchReconcileForSkus,
        batchClearAndReconcileDiscrepancies,
        executeStockRebalanceTransfers,
        autoReplenishmentRules,
        autoReplenishmentDraftPOs,
        setAutoReplenishmentRule,
        approveAutoReplenishmentDraftPO,
        updateAutoReplenishmentDraftPOQty,
        dismissAutoReplenishmentDraftPO,
        batchDecommissionProducts,
        isBatchAutoRestockEnabled,
        setBatchAutoRestockEnabled,
        autoRestockRequests,
        sku30DayCapacityMap,
        fulfillAutoRestockRequest,
        fulfillAllPendingAutoRestockRequests,
        updateAutoRestockRequestQty,
        dismissAutoRestockRequest,
        isAutoSyncEnabled,
        setIsAutoSyncEnabled,
        autoSyncStatus,
        autoSyncLastRefreshedAt,
        autoSyncNextRefreshAt,
        autoSyncSyncedCount,
        autoSyncScopedToSelection,
        triggerAutoSyncNow
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
