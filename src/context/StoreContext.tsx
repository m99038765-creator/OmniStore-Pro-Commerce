import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, CartItem, Order, RealtimeMessage, WarehouseStockMetrics, ShippingDetails, PaymentFormState } from '../types';

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
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  isAdminOpen: boolean;
  isTrackingOpen: boolean;
  quickViewProduct: Product | null;
  searchQuery: string;
  selectedCategory: string;
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating';
  onlyInStock: boolean;
  
  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (cat: string) => void;
  setSortBy: (sort: 'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating') => void;
  setOnlyInStock: (val: boolean) => void;
  setIsCartOpen: (open: boolean) => void;
  setIsCheckoutOpen: (open: boolean) => void;
  setIsAdminOpen: (open: boolean) => void;
  setIsTrackingOpen: (open: boolean) => void;
  setQuickViewProduct: (product: Product | null) => void;
  setActiveOrder: (order: Order | null) => void;
  dismissAlert: (id: string) => void;

  addToCart: (product: Product, quantity?: number) => { success: boolean; message?: string };
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
  simulateExternalPurchase: (productId?: string) => Promise<boolean>;
  trackOrder: (orderNumber: string) => Promise<Order | null>;
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [metrics, setMetrics] = useState<WarehouseStockMetrics>({
    totalSkus: 8,
    unitsInStock: 64,
    lowStockItemsCount: 2,
    ordersProcessedToday: 24,
    activeReservations: 0,
  });
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
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'stock-desc' | 'stock-asc' | 'rating'>('featured');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Sync cart to local storage
  useEffect(() => {
    try {
      localStorage.setItem('omnistore_cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  const addAlert = useCallback((type: AlertToast['type'], title: string, message: string) => {
    const newAlert: AlertToast = {
      id: 'alt_' + Math.random().toString(36).substring(2, 9),
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
        setProducts(pData.products || []);
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
          setProducts(data.payload.products);
        }
      } else if (data.type === 'inventory:update') {
        const { productId, stock, reserved } = data.payload;
        setProducts(prev => prev.map(p => {
          if (p.id === productId) {
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
          id: 'act_' + Date.now(),
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
  const addToCart = (product: Product, quantity = 1): { success: boolean; message?: string } => {
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

    addAlert('info', 'Added to Cart', `${quantity}x "${currentProd.name}" reserved in cart.`);
    return { success: true };
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
    try {
      const res = await fetch('/api/inventory/restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity })
      });
      return res.ok;
    } catch {
      return false;
    }
  };

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
        isTrackingOpen,
        quickViewProduct,
        searchQuery,
        selectedCategory,
        sortBy,
        onlyInStock,
        setSearchQuery,
        setSelectedCategory,
        setSortBy,
        setOnlyInStock,
        setIsCartOpen,
        setIsCheckoutOpen,
        setIsAdminOpen,
        setIsTrackingOpen,
        setQuickViewProduct,
        setActiveOrder,
        dismissAlert,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        clearCart,
        processCheckout,
        restockProduct,
        simulateExternalPurchase,
        trackOrder
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
