export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number; // 1 to 5
  title?: string;
  comment: string;
  createdAt: string;
  verifiedPurchase?: boolean;
  helpfulCount?: number;
  location?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  tagline: string;
  description: string;
  category: 'audio' | 'workstation' | 'computing' | 'optics' | 'peripherals';
  price: number;
  originalPrice?: number;
  rating: number;
  reviewCount: number;
  reviews?: ProductReview[];
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  warehouse: string;
  images: string[];
  features: string[];
  specs: Record<string, string>;
  isTrending?: boolean;
  isBestSeller?: boolean;
  isWishlisted?: boolean;
  wishlist?: boolean;
  warranty: string;
}

export interface SavedAddress {
  id: string;
  label: string; // e.g. "San Francisco Studio (HQ)", "East Coast Warehouse"
  fullName: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

export interface CommunicationPreferences {
  // Order & Logistics
  orderConfirmationsEmail: boolean;
  orderConfirmationsSms: boolean;
  shippingUpdatesEmail: boolean;
  shippingUpdatesSms: boolean;
  deliveryOutAlertsSms: boolean;

  // Inventory & Price Watches
  inventoryAlertsEmail: boolean;
  priceDropAlertsEmail: boolean;
  backInStockSms: boolean;

  // Product & Engineering
  firmwareUpdatesEmail: boolean;
  hardwareDigestNewsletter: boolean;
  developerApiUpdates: boolean;

  // Promotions & VIP Drops
  exclusiveDropsEmail: boolean;
  vipEarlyAccessSms: boolean;

  // Frequency
  frequency: 'realtime' | 'daily_digest' | 'weekly_summary';
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  avatarColor: string;
  timezone: string;
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD';
  memberSince: string;
  membershipTier: 'OmniStore Pro' | 'Enterprise VIP' | 'Standard Creator';
  twoFactorEnabled: boolean;
  savedAddresses: SavedAddress[];
  communicationPreferences: CommunicationPreferences;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type ShippingSpeed = 'standard' | 'express' | 'overnight';

export interface ShippingDetails {
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  shippingSpeed: ShippingSpeed;
}

export type PaymentType = 'card' | 'apple_pay' | 'google_pay' | 'instant_vault';

export interface PaymentFormState {
  method: PaymentType;
  cardNumber: string;
  cardHolder: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  saveCard: boolean;
  billingSameAsShipping: boolean;
  billingAddress?: {
    address: string;
    city: string;
    postalCode: string;
  };
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingNumber: string;
  createdAt: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  discountCode?: string;
  shippingCost: number;
  tax: number;
  total: number;
  payment: {
    method: PaymentType;
    cardBrand: string;
    last4: string;
    transactionId: string;
    authorizationCode: string;
    status: 'paid' | 'authorized';
  };
  shipping: ShippingDetails;
  status: 'processing' | 'picking' | 'in_transit' | 'delivered';
  estimatedDeliveryDate: string;
  warehouseAssigned: string;
  timeline: {
    status: string;
    description: string;
    timestamp: string;
    completed: boolean;
    current?: boolean;
  }[];
}

export interface RealtimeMessage {
  type: 'inventory:sync' | 'inventory:update' | 'inventory:alert' | 'activity:purchase' | 'stats:update' | 'price:update' | 'price:alert' | 'review:add' | 'review:vote';
  payload: any;
  timestamp: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  sku: string;
  originalPriceAtCreation: number;
  targetPrice: number;
  currentPrice: number;
  notificationEmail?: string;
  status: 'active' | 'triggered';
  createdAt: string;
  triggeredAt?: string;
  triggeredPrice?: number;
}

export interface WarehouseStockMetrics {
  totalSkus: number;
  unitsInStock: number;
  lowStockItemsCount: number;
  ordersProcessedToday: number;
  activeReservations: number;
}

export interface ScanLogEntry {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  trackingSerial: string;
  warehouse: string;
  binLocation: string;
  timestamp: string;
  action: 'check_in' | 'cycle_count' | 'inspection' | 'relocation';
  actionLabel: string;
  stockOnHand: number;
}

export interface SkuAuditLogEntry {
  id: string;
  sku: string;
  productId?: string;
  productName: string;
  timestamp: string;
  adjustmentValue: number; // e.g. +10, -5
  adjustmentType: 'add' | 'subtract' | 'set' | 'restock' | 'cycle_count' | 'reconciliation';
  previousStock: number;
  newStock: number;
  operatorId: string; // e.g. "OP-8821 (J. Vance)"
  operatorName?: string;
  reason: string;
  warehouse: string;
  batchNumber?: string;
  notes?: string;
}

export interface SkuSafetyCheckResult {
  isSafe: boolean;
  flagType: 'quarantine' | 'damaged' | 'both' | null;
  statusLabel: string;
  flaggedEntries: SkuAuditLogEntry[];
  primaryFlaggedEntry?: SkuAuditLogEntry;
}

export interface SkuAiSuggestion {
  productId: string;
  sku: string;
  name: string;
  image: string;
  category: string;
  warehouse: string;
  price: number;
  currentStock: number;
  reserved: number;
  availableStock: number;
  lowStockThreshold: number;
  dailyDepletionRate: number; // units/day
  hourlyDepletionRate: number; // units/hour
  projectedStockoutHours: number; // hours until stock is 0
  projectedStockoutDays: number; // days until stock is 0
  urgency: 'critical' | 'high' | 'moderate' | 'stable';
  salesVelocityTrend: 'accelerating' | 'steady' | 'cooling';
  recent30DaysSales: number;
  recent7DaysSales: number;
  recommendedRestockQty: number;
  targetBufferDays: number;
  estimatedRestockCost: number;
  reasoning: string;
  aiStrategicInsight?: string;
  confidenceScore: number; // 0 to 1 (e.g. 0.94)
}

export interface AiSuggestionEngineResponse {
  generatedAt: string;
  totalSkusAnalyzed: number;
  urgentRestockCount: number;
  averageDailyDepletionAll: number;
  totalCapitalRecommended: number;
  suggestions: SkuAiSuggestion[];
  executiveBriefing?: string;
  algorithmDetails: {
    model: string;
    bufferDays: number;
    dataPointsConsidered: number;
    usingGemini: boolean;
  };
}

export interface CategoryDepletionInsight {
  categoryId: string;
  categoryLabel: string;
  color: string;
  availableStock: number;
  reservedStock: number;
  totalStock: number;
  inventoryValuation: number;
  skuCount: number;
  dailyBurnRate: number; // units consumed per day across all category SKUs
  hourlyBurnRate: number; // units/hour
  monthlySalesVolume: number; // estimated monthly units sold
  turnoverRatio: number; // annual or cycle turnover velocity ratio
  turnoverSpeed: 'ultra-high' | 'high' | 'moderate' | 'steady';
  projectedDepletionHours: number; // hours until category hits 0
  projectedDepletionDays: number; // days until category hits 0
  runoutRiskLevel: 'critical' | 'high' | 'moderate' | 'healthy';
  depletionVelocityTrend: 'accelerating' | 'steady' | 'cooling';
  criticalSkusCount: number; // number of SKUs with imminent stockout
  topDepletingSku: {
    sku: string;
    name: string;
    stock: number;
    hoursLeft: number;
  };
  reorderCapitalNeeded: number;
  recommendedPoUnits: number;
  optimalReorderQuantity: number; // suggested optimal reorder based on turnover velocity and 14-day safety buffer
  targetBufferDays: number;
  suggestedPoLeadTimeDays: number;
  aiPredictiveNarrative: string;
}

export interface CategoryDepletionReport {
  generatedAt: string;
  highestRiskCategory: string;
  highestTurnoverCategory: string;
  overallWarehouseDepletionVelocity: number;
  totalRecommendedOptimalReorderUnits: number;
  totalEstimatedReorderCost: number;
  categoriesAtRiskCount: number;
  categories: CategoryDepletionInsight[];
  executiveAiSynthesis?: string;
}


