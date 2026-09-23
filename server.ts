import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_PRODUCTS } from './src/data/initialProducts';
import { INITIAL_SKU_AUDIT_LOGS, getAuditLogsForSku } from './src/data/initialAuditLogs';
import { Product, Order, RealtimeMessage, ShippingDetails, PaymentFormState, SkuAuditLogEntry, ProductReview } from './src/types';
import { calculateSkuAiSuggestions, calculateCategoryDepletionReport } from './src/utils/aiSkuSuggestionEngine';

let _serverIdCounter = 0;
const _getUniqueServerId = (prefix = "id") => `${prefix}_${Date.now()}_${++_serverIdCounter}`;

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// In-memory server-authoritative store
let inventory: Product[] = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
let orders: Order[] = [];
let skuAuditLogs: SkuAuditLogEntry[] = JSON.parse(JSON.stringify(INITIAL_SKU_AUDIT_LOGS));
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

// Get reviews for a product
app.get('/api/products/:id/reviews', (req, res) => {
  const product = inventory.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({
    productId: product.id,
    rating: product.rating,
    reviewCount: product.reviewCount,
    reviews: product.reviews || []
  });
});

// Post a review for a product
app.post('/api/products/:id/reviews', (req, res) => {
  const { authorName, rating, title, comment, location } = req.body;
  const product = inventory.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const numRating = Number(rating);
  if (!authorName || typeof authorName !== 'string' || !authorName.trim()) {
    return res.status(400).json({ error: 'Author name is required' });
  }
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
  }
  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    return res.status(400).json({ error: 'Review comment is required' });
  }

  const newReview: ProductReview = {
    id: _getUniqueServerId('rev'),
    productId: product.id,
    authorName: authorName.trim(),
    rating: Math.round(numRating),
    title: title ? String(title).trim() : undefined,
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
    verifiedPurchase: true,
    helpfulCount: 0,
    location: location ? String(location).trim() : undefined,
  };

  if (!product.reviews) {
    product.reviews = [];
  }
  product.reviews.unshift(newReview);

  // Recalculate average rating & review count
  const totalStars = product.reviews.reduce((sum, r) => sum + r.rating, 0);
  product.rating = Number((totalStars / product.reviews.length).toFixed(1));
  product.reviewCount = product.reviews.length;

  // Broadcast real-time review addition
  broadcast({
    type: 'review:add',
    payload: {
      productId: product.id,
      review: newReview,
      rating: product.rating,
      reviewCount: product.reviewCount
    },
    timestamp: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    review: newReview,
    product: {
      id: product.id,
      rating: product.rating,
      reviewCount: product.reviewCount,
      reviews: product.reviews
    }
  });
});

// Vote a review as helpful
app.post('/api/products/:id/reviews/:reviewId/vote', (req, res) => {
  const product = inventory.find(p => p.id === req.params.id);
  if (!product || !product.reviews) {
    return res.status(404).json({ error: 'Product or reviews not found' });
  }

  const review = product.reviews.find(r => r.id === req.params.reviewId);
  if (!review) {
    return res.status(404).json({ error: 'Review not found' });
  }

  review.helpfulCount = (review.helpfulCount || 0) + 1;

  broadcast({
    type: 'review:vote',
    payload: {
      productId: product.id,
      reviewId: review.id,
      helpfulCount: review.helpfulCount
    },
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, helpfulCount: review.helpfulCount });
});

// Reserve inventory for active checkout
app.post('/api/checkout/reserve', (req, res) => {
  const { items } = req.body as { items: { productId: string; quantity: number }[] };
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Invalid items array' });
  }

  const reservationId = _getUniqueServerId("res");
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
    id: _getUniqueServerId("ord"),
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
      transactionId: _getUniqueServerId("txn"),
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
  const prevStock = prod.stock;
  prod.stock += addQty;

  // Record audit log entry
  const restockAuditEntry: SkuAuditLogEntry = {
    id: _getUniqueServerId("audit"),
    sku: prod.sku,
    productId: prod.id,
    productName: prod.name,
    timestamp: new Date().toISOString(),
    adjustmentValue: addQty,
    adjustmentType: 'restock',
    previousStock: prevStock,
    newStock: prod.stock,
    operatorId: 'OP-8821 (J. Vance)',
    operatorName: 'Julian Vance - Senior Floor Specialist',
    reason: 'Instant Manual Restock Action',
    warehouse: prod.warehouse,
    batchNumber: `RESTOCK-${Date.now().toString().slice(-6)}`,
    notes: `Manual inventory replenishment (+${addQty} units).`
  };
  skuAuditLogs.unshift(restockAuditEntry);

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

// Admin: Batch adjust inventory stock levels across multiple SKUs
app.post('/api/inventory/batch-adjust', (req, res) => {
  const {
    productIds,
    adjustmentType,
    quantity,
    reason
  } = req.body as {
    productIds: string[];
    adjustmentType: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
  };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'No product SKUs selected for batch update.' });
  }

  const qty = Number(quantity);
  if (isNaN(qty) || qty < 0) {
    return res.status(400).json({ error: 'Invalid adjustment quantity.' });
  }

  const updatedProducts: typeof inventory = [];
  const adjustmentDeltas: { productId: string; sku: string; name: string; oldStock: number; newStock: number; delta: number }[] = [];

  for (const pid of productIds) {
    const prod = inventory.find(p => p.id === pid || p.sku === pid);
    if (!prod) continue;

    const oldStock = prod.stock;
    let newStock = oldStock;

    if (adjustmentType === 'add') {
      newStock = oldStock + qty;
    } else if (adjustmentType === 'subtract') {
      newStock = Math.max(0, oldStock - qty);
    } else if (adjustmentType === 'set') {
      newStock = Math.max(0, qty);
    }

    prod.stock = newStock;
    updatedProducts.push(prod);
    adjustmentDeltas.push({
      productId: prod.id,
      sku: prod.sku,
      name: prod.name,
      oldStock,
      newStock,
      delta: newStock - oldStock
    });

    // Broadcast individual real-time inventory updates so all clients update synchronously
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

    if (prod.stock <= prod.lowStockThreshold) {
      broadcast({
        type: 'inventory:alert',
        payload: {
          productId: prod.id,
          productName: prod.name,
          stock: prod.stock,
          level: prod.stock === 0 ? 'out_of_stock' : 'low_stock',
          message: prod.stock === 0
            ? `ALERT: "${prod.name}" (${prod.sku}) has officially SOLD OUT!`
            : `WARNING: "${prod.name}" (${prod.sku}) is now at low stock (${prod.stock} left)!`
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  const actionText =
    adjustmentType === 'add'
      ? `added +${qty} units each`
      : adjustmentType === 'subtract'
      ? `reduced by -${qty} units each`
      : `set to exactly ${qty} units`;

  broadcast({
    type: 'inventory:alert',
    payload: {
      level: 'restocked',
      message: `BATCH UPDATE: Successfully ${actionText} across ${updatedProducts.length} SKUs.`
    },
    timestamp: new Date().toISOString()
  });

  // Record audit log entry for each adjusted SKU
  for (const delta of adjustmentDeltas) {
    const batchAuditEntry: SkuAuditLogEntry = {
      id: _getUniqueServerId("audit"),
      sku: delta.sku,
      productId: delta.productId,
      productName: delta.name,
      timestamp: new Date().toISOString(),
      adjustmentValue: delta.delta,
      adjustmentType: adjustmentType === 'add' ? 'add' : adjustmentType === 'subtract' ? 'subtract' : 'set',
      previousStock: delta.oldStock,
      newStock: delta.newStock,
      operatorId: 'OP-8821 (J. Vance - Console)',
      operatorName: 'Julian Vance - Senior Floor Specialist',
      reason: reason || `Batch Stock Adjustment (${adjustmentType})`,
      warehouse: updatedProducts.find(p => p.sku === delta.sku)?.warehouse || 'Bay Area Hub (WH-01)',
      batchNumber: `BATCH-${Date.now().toString().slice(-6)}`,
      notes: `Batch operation applied: ${actionText}`
    };
    skuAuditLogs.unshift(batchAuditEntry);
  }

  res.json({
    success: true,
    message: `Batch update successful for ${updatedProducts.length} SKUs (${actionText}).`,
    updatedCount: updatedProducts.length,
    adjustmentType,
    quantity: qty,
    reason: reason || 'Manual batch inventory adjustment',
    deltas: adjustmentDeltas
  });
});

// GET /api/inventory/audit-logs/:sku - Retrieve recent stock adjustments for a specific SKU
app.get('/api/inventory/audit-logs/:sku', (req, res) => {
  const { sku } = req.params;
  const decodedSku = decodeURIComponent(sku).trim();
  const prod = inventory.find(p => p.sku.toUpperCase() === decodedSku.toUpperCase());

  let logs = skuAuditLogs.filter(
    l => l.sku.toUpperCase() === decodedSku.toUpperCase() ||
         l.sku.replace(/[-\s_]/g, '').toUpperCase() === decodedSku.replace(/[-\s_]/g, '')
  );

  if (logs.length === 0) {
    logs = getAuditLogsForSku(decodedSku, prod?.stock || 10, prod?.name || 'Hardware Item');
    skuAuditLogs.push(...logs);
  }

  // Sort by timestamp descending (newest first)
  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  res.json({
    sku: decodedSku,
    productId: prod?.id,
    productName: prod?.name || logs[0]?.productName || 'Hardware Item',
    currentStock: prod?.stock ?? 0,
    warehouse: prod?.warehouse || 'Bay Area Hub (WH-01)',
    logs
  });
});

// GET /api/inventory/audit-logs - Query audit logs with optional ?sku=... filter
app.get('/api/inventory/audit-logs', (req, res) => {
  const skuQuery = req.query.sku as string | undefined;
  if (skuQuery) {
    const decodedSku = decodeURIComponent(skuQuery).trim();
    const prod = inventory.find(p => p.sku.toUpperCase() === decodedSku.toUpperCase());

    let logs = skuAuditLogs.filter(
      l => l.sku.toUpperCase() === decodedSku.toUpperCase() ||
           l.sku.replace(/[-\s_]/g, '').toUpperCase() === decodedSku.replace(/[-\s_]/g, '')
    );

    if (logs.length === 0) {
      logs = getAuditLogsForSku(decodedSku, prod?.stock || 10, prod?.name || 'Hardware Item');
      skuAuditLogs.push(...logs);
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      sku: decodedSku,
      productId: prod?.id,
      productName: prod?.name || logs[0]?.productName || 'Hardware Item',
      currentStock: prod?.stock ?? 0,
      warehouse: prod?.warehouse || 'Bay Area Hub (WH-01)',
      logs
    });
  }

  res.json({ logs: skuAuditLogs });
});

// POST /api/inventory/audit-logs - Append an audit log entry manually
app.post('/api/inventory/audit-logs', (req, res) => {
  const {
    sku,
    productName,
    adjustmentValue,
    adjustmentType,
    previousStock,
    newStock,
    operatorId,
    operatorName,
    reason,
    warehouse,
    notes
  } = req.body;

  if (!sku || adjustmentValue === undefined) {
    return res.status(400).json({ error: 'Missing required audit log parameters: sku and adjustmentValue' });
  }

  const prod = inventory.find(p => p.sku.toUpperCase() === sku.trim().toUpperCase());
  const entry: SkuAuditLogEntry = {
    id: _getUniqueServerId("audit"),
    sku: sku.trim().toUpperCase(),
    productId: prod?.id,
    productName: productName || prod?.name || 'Hardware Item',
    timestamp: new Date().toISOString(),
    adjustmentValue: Number(adjustmentValue),
    adjustmentType: adjustmentType || (adjustmentValue >= 0 ? 'add' : 'subtract'),
    previousStock: Number(previousStock ?? prod?.stock ?? 0),
    newStock: Number(newStock ?? (prod ? prod.stock + Number(adjustmentValue) : Number(adjustmentValue))),
    operatorId: operatorId || 'OP-8821 (J. Vance)',
    operatorName: operatorName || 'Julian Vance',
    reason: reason || 'Physical Stock Verification',
    warehouse: warehouse || prod?.warehouse || 'Bay Area Hub (WH-01)',
    notes: notes || ''
  };

  skuAuditLogs.unshift(entry);
  res.status(201).json({ success: true, log: entry });
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

// Update product price (or trigger promotional flash sale price drop)
app.post('/api/inventory/update-price', (req, res) => {
  const { productId, newPrice, discountPercent } = req.body as {
    productId: string;
    newPrice?: number;
    discountPercent?: number;
  };

  const prod = inventory.find(p => p.id === productId);
  if (!prod) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const oldPrice = prod.price;
  let targetPrice = oldPrice;

  if (typeof newPrice === 'number' && newPrice > 0) {
    targetPrice = Math.round(newPrice * 100) / 100;
  } else if (typeof discountPercent === 'number' && discountPercent > 0) {
    targetPrice = Math.round(oldPrice * (1 - discountPercent / 100) * 100) / 100;
  }

  if (targetPrice === oldPrice) {
    return res.json({ success: true, product: prod, unchanged: true });
  }

  if (!prod.originalPrice || prod.originalPrice < oldPrice) {
    prod.originalPrice = oldPrice;
  }
  prod.price = targetPrice;

  const dropAmount = Math.max(0, oldPrice - targetPrice);
  const dropPercent = Math.round(((oldPrice - targetPrice) / oldPrice) * 100);

  broadcast({
    type: 'price:update',
    payload: {
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      oldPrice,
      newPrice: prod.price,
      dropAmount,
      dropPercent,
      isPriceDrop: targetPrice < oldPrice
    },
    timestamp: new Date().toISOString()
  });

  if (targetPrice < oldPrice) {
    broadcast({
      type: 'inventory:alert',
      payload: {
        productId: prod.id,
        productName: prod.name,
        level: 'price_drop',
        message: `FLASH SALE: "${prod.name}" marked down from $${oldPrice.toFixed(2)} to $${targetPrice.toFixed(2)} (${dropPercent}% OFF)!`
      },
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    product: prod,
    oldPrice,
    newPrice: prod.price,
    dropAmount,
    dropPercent
  });
});

// Simulate price drop on a product (or random product) to demonstrate target price notifications
app.post('/api/inventory/simulate-price-drop', (req, res) => {
  const { productId, discountPercent = 15 } = req.body as { productId?: string; discountPercent?: number };
  const target = productId ? inventory.find(p => p.id === productId) : inventory[0];
  if (!target) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const oldPrice = target.price;
  const pct = Math.min(80, Math.max(5, Number(discountPercent) || 15));
  const newPrice = Math.round(oldPrice * (1 - pct / 100) * 100) / 100;

  if (!target.originalPrice || target.originalPrice < oldPrice) {
    target.originalPrice = oldPrice;
  }
  target.price = newPrice;

  const dropAmount = oldPrice - newPrice;

  broadcast({
    type: 'price:update',
    payload: {
      productId: target.id,
      productName: target.name,
      sku: target.sku,
      oldPrice,
      newPrice: target.price,
      dropAmount,
      dropPercent: pct,
      isPriceDrop: true
    },
    timestamp: new Date().toISOString()
  });

  broadcast({
    type: 'inventory:alert',
    payload: {
      productId: target.id,
      productName: target.name,
      level: 'price_drop',
      message: `PRICE DROP ALERT: "${target.name}" dropped to $${newPrice.toFixed(2)} (-${pct}%)!`
    },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    product: target,
    oldPrice,
    newPrice,
    dropAmount,
    dropPercent: pct
  });
});

// Reset product prices back to initial catalogue prices
app.post('/api/inventory/reset-prices', (req, res) => {
  for (const item of inventory) {
    const orig = INITIAL_PRODUCTS.find(p => p.id === item.id);
    if (orig) {
      item.price = orig.price;
      item.originalPrice = orig.originalPrice;
    }
  }

  broadcast({
    type: 'inventory:sync',
    payload: { products: inventory, ordersCount: orders.length },
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: 'All catalogue prices reset' });
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

// Lazy Gemini client helper
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    try {
      geminiClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.warn('Gemini client init error:', e);
      return null;
    }
  }
  return geminiClient;
}

// AI-Powered SKU Suggestion Engine endpoint
app.get('/api/inventory/ai-suggestions', async (req, res) => {
  try {
    const calculation = calculateSkuAiSuggestions(inventory, orders, skuAuditLogs);
    
    // Check if client requested Gemini strategic briefing or if Gemini is available
    const wantGemini = req.query.gemini === 'true';
    const ai = getGeminiClient();

    if (wantGemini && ai) {
      try {
        const topUrgent = calculation.suggestions.slice(0, 4);
        const prompt = `You are the OmniStore Chief Supply Chain AI Officer. 
Analyze these high-velocity warehouse inventory replenishment metrics based on real-time stock depletion rates:
${JSON.stringify({
  urgentCount: calculation.urgentRestockCount,
  avgBurnRate: calculation.averageDailyDepletionAll,
  capitalNeeded: calculation.totalCapitalRecommended,
  topItems: topUrgent.map(s => ({
    sku: s.sku,
    name: s.name,
    stock: s.currentStock,
    burnRate: s.dailyDepletionRate,
    timeToStockoutHours: s.projectedStockoutHours,
    recommendedRestockQty: s.recommendedRestockQty
  }))
}, null, 2)}

Provide a sharp, 2-to-3 sentence executive restock directive highlighting the most urgent product stockout risks, recommended supplier order priorities, and inventory buffer protection. Keep it concise, action-oriented, and professional.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        if (response.text) {
          calculation.executiveBriefing = response.text.trim();
          calculation.algorithmDetails.usingGemini = true;
        }
      } catch (geminiErr) {
        console.warn('Gemini AI synthesis fallback:', geminiErr);
      }
    }

    res.json(calculation);
  } catch (error: any) {
    console.error('Error computing AI suggestions:', error);
    res.status(500).json({ error: 'Failed to compute SKU suggestions', details: error.message });
  }
});

// Dedicated endpoint to synthesize Gemini AI Strategic Executive Briefing
app.post('/api/inventory/ai-suggestions/generate-briefing', async (req, res) => {
  try {
    const calculation = calculateSkuAiSuggestions(inventory, orders, skuAuditLogs);
    const ai = getGeminiClient();

    if (!ai) {
      // Fallback to sophisticated analytical briefing if API key is not configured
      return res.json({
        success: true,
        usingGemini: false,
        briefing: calculation.executiveBriefing,
        generatedAt: new Date().toISOString()
      });
    }

    const urgentItems = calculation.suggestions.filter(s => s.urgency === 'critical' || s.urgency === 'high');
    const prompt = `You are the OmniStore Strategic Supply Chain AI. 
Review this warehouse inventory depletion report:
- Total analyzed SKUs: ${calculation.totalSkusAnalyzed}
- Urgent Stockout Risks: ${calculation.urgentRestockCount}
- Overall Depletion Velocity: ${calculation.averageDailyDepletionAll} units/day
- Total Restock Capital: $${calculation.totalCapitalRecommended.toLocaleString()}
Top Items Needing Immediate PO:
${urgentItems.map(item => `- ${item.sku} (${item.name}): Stock = ${item.currentStock}, Depletion = ${item.dailyDepletionRate}/day, Stockout in ~${item.projectedStockoutHours} hrs, Rec. PO = +${item.recommendedRestockQty}`).join('\n')}

Synthesize an executive briefing with:
1. Primary stockout bottleneck and imminent loss-of-sales exposure
2. Specific SKU reorder directives
3. Strategic warehouse buffer guidance.
Limit response to 140 words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      success: true,
      usingGemini: true,
      briefing: response.text?.trim() || calculation.executiveBriefing,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error generating AI briefing:', error);
    const calculation = calculateSkuAiSuggestions(inventory, orders, skuAuditLogs);
    res.json({
      success: true,
      usingGemini: false,
      briefing: calculation.executiveBriefing,
      generatedAt: new Date().toISOString()
    });
  }
});

// Category Depletion Insights: identifies which categories are trending toward depletion based on real-time sales velocity
app.get('/api/inventory/category-depletion', async (req, res) => {
  try {
    const report = calculateCategoryDepletionReport(inventory, orders, skuAuditLogs);
    const withGemini = req.query.gemini === 'true';

    if (withGemini) {
      const ai = getGeminiClient();
      if (ai) {
        try {
          const prompt = `You are the OmniStore Chief Supply Chain AI.
Analyze category-level depletion trends and velocity turnover from real-time sales patterns:
- Total Warehouse Burn Rate: ${report.overallWarehouseDepletionVelocity} units/day
- Highest Turnover Category: ${report.highestTurnoverCategory}
- Highest Runout Risk Category: ${report.highestRiskCategory}
- Categories at Risk: ${report.categoriesAtRiskCount} of ${report.categories.length}
- Total Recommended Optimal Reorder: +${report.totalRecommendedOptimalReorderUnits} units
Category Breakdown:
${report.categories.map(c => `- ${c.categoryLabel}: Avail = ${c.availableStock}u, Daily Burn = ${c.dailyBurnRate}u/d, Turnover = ${c.turnoverSpeed.toUpperCase()} (${c.turnoverRatio}x), Depletion in ~${c.projectedDepletionDays}d, Optimal Reorder = +${c.optimalReorderQuantity}u, Lead Time = ${c.suggestedPoLeadTimeDays}d, Top SKU = ${c.topDepletingSku.sku} (${c.topDepletingSku.hoursLeft}h left)`).join('\n')}

Provide an ultra-concise 2-sentence executive summary highlighting warehouse categories with high velocity turnover and suggesting optimal reorder quantities based on current sales patterns.`;

          const geminiRes = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
          });

          if (geminiRes.text) {
            report.executiveAiSynthesis = geminiRes.text.trim();
          }
        } catch (err) {
          console.warn('Gemini category synthesis fallback:', err);
        }
      }
    }

    res.json(report);
  } catch (error: any) {
    console.error('Error calculating category depletion:', error);
    res.status(500).json({ error: 'Failed to compute category depletion', details: error.message });
  }
});

// Quick AI restock application endpoint
app.post('/api/inventory/ai-suggestions/quick-restock', (req, res) => {
  const { productId, quantity, operatorId = 'OP-AI-DIRECTOR' } = req.body;
  if (!productId || typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({ error: 'Valid productId and positive quantity required' });
  }

  const product = inventory.find(p => p.id === productId || p.sku === productId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const previousStock = product.stock;
  product.stock += quantity;

  // Append audit trail log
  const newLog: SkuAuditLogEntry = {
    id: _getUniqueServerId("audit"),
    sku: product.sku,
    productId: product.id,
    productName: product.name,
    timestamp: new Date().toISOString(),
    adjustmentValue: quantity,
    adjustmentType: 'restock',
    previousStock,
    newStock: product.stock,
    operatorId: operatorId || 'OP-AI-DIRECTOR',
    operatorName: 'AI Predictive Replenishment System',
    reason: `AI Velocity Replenishment (+${quantity} units for 14-day safety buffer)`,
    warehouse: product.warehouse,
    batchNumber: `BATCH-AI-${Date.now().toString().slice(-6)}`,
    notes: 'Triggered from AI-Powered SKU Suggestion Engine'
  };

  skuAuditLogs.unshift(newLog);

  // Broadcast update
  broadcast({
    type: 'inventory:update',
    payload: {
      productId: product.id,
      stock: product.stock,
      reserved: product.reserved || 0
    },
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Replenished +${quantity} units to SKU ${product.sku} (${product.name})`,
    product,
    auditLog: newLog
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
