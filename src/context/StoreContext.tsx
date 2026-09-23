import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product, CartItem, Order, RealtimeMessage, WarehouseStockMetrics, ShippingDetails, PaymentFormState, InventoryAlert, ProductReview, UserProfile, SavedAddress, CommunicationPreferences, SkuAuditLogEntry, SkuSafetyCheckResult } from '../types';
import { INITIAL_SAMPLE_ORDERS, createSampleOrder } from '../data/sampleOrders';
import { INITIAL_USER_PROFILE } from '../data/initialUserProfile';
import { INITIAL_SKU_AUDIT_LOGS } from '../data/initialAuditLogs';
import { checkSkuAuditLogSafety } from '../utils/skuAuditSafety';

let _globalIdCounter = 0;
const _getUniqueId = (prefix = "id") => `${prefix}_${Date.now()}_${++_globalIdCounter}`;

export interface AlertToast {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  title: string;
  message: string;
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
  adminActiveTab: 'inventory' | 'batch' | 'scanner';
  adminSelectedProductIds: string[];
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
  
  // Safe Mode (Audit Log Quarantine & Damage Protection)
  isSafeModeEnabled: boolean;
  setIsSafeModeEnabled: (enabled: boolean) => void;
  warehouseAuditLogs: SkuAuditLogEntry[];
  checkSkuSafety: (sku: string) => SkuSafetyCheckResult;
  
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
  setAdminActiveTab: (tab: 'inventory' | 'batch' | 'scanner') => void;
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
  const [adminActiveTab, setAdminActiveTab] = useState<'inventory' | 'batch' | 'scanner'>('inventory');
  const [adminSelectedProductIds, setAdminSelectedProductIds] = useState<string[]>([]);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [skuAdjustProduct, setSkuAdjustProduct] = useState<Product | null>(null);
  const [qrCodeProduct, setQrCodeProduct] = useState<Product | null>(null);
  const [comparedProductIds, setComparedProductIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
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

  // Sync full live audit logs from backend if available
  useEffect(() => {
    fetch('/api/inventory/audit-logs')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.logs) && data.logs.length > 0) {
          setWarehouseAuditLogs(data.logs);
        }
      })
      .catch(() => {});
  }, []);

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
      return res.ok;
    } catch {
      return false;
    }
  };

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
  }, []);

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
        setOnlyWishlist,
        setIsCartOpen,
        setIsCheckoutOpen,
        setIsAdminOpen,
        setAdminActiveTab,
        setAdminSelectedProductIds,
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
        voteReviewHelpful
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
