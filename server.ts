import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS } from './src/data/initialProducts';
import { Product, Order, RealtimeMessage, ShippingDetails, PaymentFormState } from './src/types';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory server-authoritative store
let inventory: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let orders: Order[] = [];
const reservations = new Map<string, { productId: string; quantity: number; expiresAt: number }>();

// WebSocket Server
const wss = new WebSocketServer({ server });
const wsClients = new Set<WebSocket>();
const sseClients = new Set<express.Response>();

function broadcast(message: RealtimeMessage) {
  const payload = JSON.stringify(message);
  
  // Broadcast via WebSockets
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload);
      } catch (err) {
        console.error('WS broadcast error:', err);
      }
    }
  }

  // Broadcast via Server-Sent Events (SSE) fallback
  for (const res of sseClients) {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error('SSE broadcast error:', err);
    }
  }
}

wss.on('connection', (ws) => {
  wsClients.add(ws);

  // Send initial inventory sync on connect
  const initialSyncMsg: RealtimeMessage = {
    type: 'inventory:sync',
    payload: {
      products: inventory,
      ordersCount: orders.length,
    },
    timestamp: new Date().toISOString(),
  };
  ws.send(JSON.stringify(initialSyncMsg));

  ws.on('close', () => {
    wsClients.delete(ws);
  });

  ws.on('error', () => {
    wsClients.delete(ws);
  });
});

// Periodic cleanup of expired reservations (10 min TTL)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [key, res] of reservations.entries()) {
    if (res.expiresAt <= now) {
      const prod = inventory.find(p => p.id === res.productId);
      if (prod) {
        prod.reserved = Math.max(0, prod.reserved - res.quantity);
        changed = true;
      }
      reservations.delete(key);
    }
  }
  if (changed) {
    broadcast({
      type: 'inventory:sync',
      payload: { products: inventory, ordersCount: orders.length },
      timestamp: new Date().toISOString()
    });
  }
}, 30000);

// --- REST API ENDPOINTS ---

// Server Sent Events endpoint for fallback
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);

  // Send initial state
  const syncMsg: RealtimeMessage = {
    type: 'inventory:sync',
    payload: { products: inventory, ordersCount: orders.length },
    timestamp: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(syncMsg)}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Get all products with current inventory state
app.get('/api/products', (req, res) => {
  res.json({
    products: inventory,
    totalSkus: inventory.length,
    totalUnits: inventory.reduce((sum, p) => sum + p.stock, 0),
    lowStockSkus: inventory.filter(p => p.stock <= p.lowStockThreshold).length
  });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const product = inventory.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Reserve inventory for active checkout
app.post('/api/checkout/reserve', (req, res) => {
  const { items } = req.body as { items: { productId: string; quantity: number }[] };
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  const reservationId = 'res_' + Math.random().toString(36).substring(2, 10);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  for (const item of items) {
    const prod = inventory.find(p => p.id === item.productId);
    if (!prod) {
      return res.status(404).json({ error: `Product ${item.productId} not found` });
    }
    const available = prod.stock - prod.reserved;
    if (available < item.quantity) {
      return res.status(409).json({
        error: 'INSUFFICIENT_STOCK',
        message: `Only ${Math.max(0, available)} available for ${prod.name}`,
        productId: prod.id,
        available
      });
    }
  }

  // Apply reservations
  for (const item of items) {
    const prod = inventory.find(p => p.id === item.productId)!;
    prod.reserved += item.quantity;
    reservations.set(`${reservationId}_${item.productId}`, {
      productId: item.productId,
      quantity: item.quantity,
      expiresAt
    });

    broadcast({
      type: 'inventory:update',
      payload: {
        productId: prod.id,
        stock: prod.stock,
        reserved: prod.reserved,
        available: prod.stock - prod.reserved
      },
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    reservationId,
    expiresAt: new Date(expiresAt).toISOString()
  });
});

// Secure Payment Processing & Stock Settlement
app.post('/api/checkout/process-payment', (req, res) => {
  const {
    items,
    shippingDetails,
    paymentDetails,
    discountCode,
    reservationId
  } = req.body as {
    items: { productId: string; quantity: number; price: number; name: string; sku: string; image: string }[];
    shippingDetails: ShippingDetails;
    paymentDetails: PaymentFormState;
    discountCode?: string;
    reservationId?: string;
  };

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  // 1. Payment Gateway Validation & Security Emulation
  if (paymentDetails.method === 'card') {
    const rawCard = paymentDetails.cardNumber.replace(/\s+/g, '');
    if (rawCard.length < 13 || rawCard.length > 19) {
      return res.status(422).json({ error: 'INVALID_CARD_NUMBER', message: 'Card number must be between 13 and 19 digits.' });
    }
    if (!paymentDetails.expiryMonth || !paymentDetails.expiryYear) {
      return res.status(422).json({ error: 'INVALID_EXPIRY', message: 'Expiration date is required.' });
    }
    if (!paymentDetails.cvv || paymentDetails.cvv.length < 3) {
      return res.status(422).json({ error: 'INVALID_CVV', message: 'Valid 3 or 4 digit security code required.' });
    }
  }

  // 2. Authoritative Stock Lock & Verification
  const stockErrors: { productId: string; name: string; available: number; requested: number }[] = [];

  for (const item of items) {
    const prod = inventory.find(p => p.id === item.productId);
    if (!prod) {
      return res.status(404).json({ error: `Product not found: ${item.productId}` });
    }
    if (prod.stock < item.quantity) {
      stockErrors.push({
        productId: prod.id,
        name: prod.name,
        available: prod.stock,
        requested: item.quantity
      });
    }
  }

  if (stockErrors.length > 0) {
    return res.status(409).json({
      error: 'STOCK_DEPLETED',
      message: 'One or more items in your cart just sold out or have insufficient units.',
      details: stockErrors
    });
  }

  // 3. Atomically decrement stock
  for (const item of items) {
    const prod = inventory.find(p => p.id === item.productId)!;
    prod.stock -= item.quantity;
    
    // Clear matching reservations if any
    if (reservationId) {
      const resKey = `${reservationId}_${item.productId}`;
      const resEntry = reservations.get(resKey);
      if (resEntry) {
        prod.reserved = Math.max(0, prod.reserved - resEntry.quantity);
        reservations.delete(resKey);
      }
    } else {
      prod.reserved = Math.max(0, prod.reserved - item.quantity);
    }
  }

  // 4. Financial computations
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  let discount = 0;
  if (discountCode) {
    const code = discountCode.trim().toUpperCase();
    if (code === 'PRO15') {
      discount = Number((subtotal * 0.15).toFixed(2));
    } else if (code === 'VIP50') {
      discount = 50.00;
    } else if (code === 'FREESHIP') {
      discount = 0; // handled in shipping
    }
  }

  let shippingCost = 0;
  if (shippingDetails.shippingSpeed === 'express') {
    shippingCost = 25.00;
  } else if (shippingDetails.shippingSpeed === 'overnight') {
    shippingCost = 45.00;
  } else {
    shippingCost = subtotal >= 500 || discountCode?.toUpperCase() === 'FREESHIP' ? 0 : 15.00;
  }

  const taxableAmount = Math.max(0, subtotal - discount);
  const tax = Number((taxableAmount * 0.0825).toFixed(2));
  const total = Number((taxableAmount + shippingCost + tax).toFixed(2));

  // Determine card brand or payment tag
  let cardBrand = 'Visa';
  let last4 = '4242';
  if (paymentDetails.method === 'card') {
    const rawCard = paymentDetails.cardNumber.replace(/\s+/g, '');
    if (rawCard.startsWith('4')) cardBrand = 'Visa';
    else if (rawCard.startsWith('5')) cardBrand = 'Mastercard';
    else if (rawCard.startsWith('34') || rawCard.startsWith('37')) cardBrand = 'American Express';
    else cardBrand = 'Credit Card';
    last4 = rawCard.slice(-4) || '8821';
  } else if (paymentDetails.method === 'apple_pay') {
    cardBrand = 'Apple Pay';
    last4 = '9102';
  } else if (paymentDetails.method === 'google_pay') {
    cardBrand = 'Google Pay';
    last4 = '6013';
  } else {
    cardBrand = 'Instant Vault';
    last4 = '0019';
  }

  const orderNum = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  const trackingNum = `TRK-US-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  
  const estimatedDays = shippingDetails.shippingSpeed === 'overnight' ? 1 : shippingDetails.shippingSpeed === 'express' ? 2 : 4;
  const deliveryDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  const newOrder: Order = {
    id: 'ord_' + Math.random().toString(36).substring(2, 12),
    orderNumber: orderNum,
    trackingNumber: trackingNum,
    createdAt: new Date().toISOString(),
    items: items.map(i => ({
      productId: i.productId,
      name: i.name,
      sku: i.sku,
      price: i.price,
      quantity: i.quantity,
      image: i.image
    })),
    subtotal,
    discount,
    discountCode,
    shippingCost,
    tax,
    total,
    payment: {
      method: paymentDetails.method,
      cardBrand,
      last4,
      transactionId: 'txn_' + Math.random().toString(36).substring(2, 14),
      authorizationCode: 'AUTH_' + Math.floor(100000 + Math.random() * 900000),
      status: 'paid'
    },
    shipping: shippingDetails,
    status: 'processing',
    estimatedDeliveryDate: deliveryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    warehouseAssigned: inventory.find(p => p.id === items[0].productId)?.warehouse || 'Bay Area Hub (WH-01)',
    timeline: [
      {
        status: 'Order Placed & Payment Secured',
        description: `Payment authorized via ${cardBrand} (${last4}). Zero-fraud flag passed.`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        completed: true,
        current: false
      },
      {
        status: 'Fulfillment Routing',
        description: 'Assigned to nearest automated warehouse for picking & scanning.',
        timestamp: 'Pending (in 15m)',
        completed: false,
        current: true
      },
      {
        status: 'Carrier Hand-off & Dispatch',
        description: 'Tracking barcode generated and staged for logistics pickup.',
        timestamp: 'Estimated Tomorrow',
        completed: false
      },
      {
        status: 'Delivered',
        description: `Signature required on delivery by ${deliveryDate.toLocaleDateString()}.`,
        timestamp: 'Estimated',
        completed: false
      }
    ]
  };

  orders.unshift(newOrder);

  // 5. Broadcast Real-Time Events to all connected clients!
  for (const item of items) {
    const updatedProd = inventory.find(p => p.id === item.productId)!;
    broadcast({
      type: 'inventory:update',
      payload: {
        productId: updatedProd.id,
        stock: updatedProd.stock,
        reserved: updatedProd.reserved,
        available: updatedProd.stock - updatedProd.reserved
      },
      timestamp: new Date().toISOString()
    });

    if (updatedProd.stock <= updatedProd.lowStockThreshold) {
      broadcast({
        type: 'inventory:alert',
        payload: {
          productId: updatedProd.id,
          productName: updatedProd.name,
          stock: updatedProd.stock,
          level: updatedProd.stock === 0 ? 'out_of_stock' : 'low_stock',
          message: updatedProd.stock === 0
            ? `ALERT: "${updatedProd.name}" has officially SOLD OUT across all warehouses!`
            : `WARNING: Only ${updatedProd.stock} unit(s) remaining for "${updatedProd.name}"!`
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  // Broadcast live store activity ticker
  broadcast({
    type: 'activity:purchase',
    payload: {
      orderNumber: newOrder.orderNumber,
      productName: items[0].name,
      quantity: items.reduce((acc, it) => acc + it.quantity, 0),
      city: shippingDetails.city || 'San Francisco',
      country: shippingDetails.country || 'USA',
      total: newOrder.total
    },
    timestamp: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    order: newOrder
  });
});

// Admin / Simulation: Restock inventory
app.post('/api/inventory/restock', (req, res) => {
  const { productId, quantity } = req.body as { productId: string; quantity: number };
  const prod = inventory.find(p => p.id === productId);
  if (!prod) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const addQty = Math.max(1, Number(quantity) || 5);
  prod.stock += addQty;

  broadcast({
    type: 'inventory:update',
    payload: {
      productId: prod.id,
      stock: prod.stock,
      reserved: prod.reserved,
      available: prod.stock - prod.reserved
    },
    timestamp: new Date().toISOString()
  });

  broadcast({
    type: 'inventory:alert',
    payload: {
      productId: prod.id,
      productName: prod.name,
      stock: prod.stock,
      level: 'restocked',
      message: `RESTOCK: Added ${addQty} new units to "${prod.name}" (Now: ${prod.stock} in stock).`
    },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    product: prod
  });
});

// Simulation: Simulate external shopper purchase (for demonstrating live multi-user real-time stock updates)
app.post('/api/inventory/simulate-purchase', (req, res) => {
  const { productId } = req.body as { productId?: string };
  
  // Pick requested or random product with stock > 0
  let target = productId ? inventory.find(p => p.id === productId) : null;
  if (!target || target.stock <= 0) {
    target = inventory.find(p => p.stock > 0);
  }

  if (!target) {
    return res.status(400).json({ error: 'All products currently sold out' });
  }

  const qty = 1;
  target.stock = Math.max(0, target.stock - qty);

  const sampleCities = [
    { city: 'New York, NY', country: 'US' },
    { city: 'Tokyo', country: 'Japan' },
    { city: 'London', country: 'UK' },
    { city: 'Berlin', country: 'Germany' },
    { city: 'Seattle, WA', country: 'US' },
    { city: 'Toronto', country: 'Canada' },
    { city: 'Sydney', country: 'Australia' }
  ];
  const randomLoc = sampleCities[Math.floor(Math.random() * sampleCities.length)];

  broadcast({
    type: 'inventory:update',
    payload: {
      productId: target.id,
      stock: target.stock,
      reserved: target.reserved,
      available: target.stock - target.reserved
    },
    timestamp: new Date().toISOString()
  });

  if (target.stock <= target.lowStockThreshold) {
    broadcast({
      type: 'inventory:alert',
      payload: {
        productId: target.id,
        productName: target.name,
        stock: target.stock,
        level: target.stock === 0 ? 'out_of_stock' : 'low_stock',
        message: target.stock === 0
          ? `ALERT: "${target.name}" has officially SOLD OUT!`
          : `WARNING: Only ${target.stock} unit(s) remaining for "${target.name}"!`
      },
      timestamp: new Date().toISOString()
    });
  }

  broadcast({
    type: 'activity:purchase',
    payload: {
      orderNumber: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
      productName: target.name,
      quantity: 1,
      city: randomLoc.city,
      country: randomLoc.country,
      total: target.price
    },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Simulated external order for 1x ${target.name}`,
    remainingStock: target.stock
  });
});

// Orders list
app.get('/api/orders', (req, res) => {
  res.json({ orders });
});

// Single order tracking
app.get('/api/orders/:orderNumber', (req, res) => {
  const order = orders.find(o => o.orderNumber === req.params.orderNumber || o.id === req.params.orderNumber);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Live inventory metrics
app.get('/api/metrics', (req, res) => {
  res.json({
    totalSkus: inventory.length,
    unitsInStock: inventory.reduce((acc, p) => acc + p.stock, 0),
    lowStockItemsCount: inventory.filter(p => p.stock <= p.lowStockThreshold && p.stock > 0).length,
    outOfStockCount: inventory.filter(p => p.stock === 0).length,
    ordersProcessedToday: orders.length + 18, // baseline realistic daily throughput
    activeReservations: Array.from(reservations.values()).reduce((acc, r) => acc + r.quantity, 0)
  });
});

// Attach Vite middleware in development or serve static in production
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`OmniStore Pro Commerce server live on http://0.0.0.0:${PORT}`);
  });
}

start();
