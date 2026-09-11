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
  stock: number;
  reserved: number;
  lowStockThreshold: number;
  warehouse: string;
  images: string[];
  features: string[];
  specs: Record<string, string>;
  isTrending?: boolean;
  isBestSeller?: boolean;
  warranty: string;
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
  type: 'inventory:sync' | 'inventory:update' | 'inventory:alert' | 'activity:purchase' | 'stats:update';
  payload: any;
  timestamp: string;
}

export interface WarehouseStockMetrics {
  totalSkus: number;
  unitsInStock: number;
  lowStockItemsCount: number;
  ordersProcessedToday: number;
  activeReservations: number;
}
