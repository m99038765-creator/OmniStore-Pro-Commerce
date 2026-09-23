import { Order } from '../types';

let _globalIdCounter = 0;
const _getUniqueId = (prefix = "id") => `${prefix}_${Date.now()}_${++_globalIdCounter}`;

export const INITIAL_SAMPLE_ORDERS: Order[] = [
  {
    id: 'ord_sample_849201',
    orderNumber: 'ORD-849201',
    trackingNumber: 'TRK-US-SF49-8201',
    createdAt: '2026-09-09T14:32:00.000Z',
    status: 'in_transit',
    items: [
      {
        productId: 'prod_cinema_camera_fx',
        name: 'Lumix Alpha Full-Frame 6K Digital Cinema Core',
        sku: 'OPT-CIN-4K60',
        price: 2399.00,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=900&auto=format&fit=crop&q=80'
      },
      {
        productId: 'prod_spatial_headphones_nc',
        name: 'Solace Pro Spatial ANC Studio Headphones',
        sku: 'AUD-HP-APEX',
        price: 449.00,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=900&auto=format&fit=crop&q=80'
      }
    ],
    subtotal: 2848.00,
    discount: 50.00,
    discountCode: 'VIP50',
    shippingCost: 0,
    tax: 230.84,
    total: 3028.84,
    payment: {
      method: 'card',
      cardBrand: 'Visa',
      last4: '4242',
      transactionId: 'txn_992144810a',
      authorizationCode: 'AUTH_891044',
      status: 'paid'
    },
    shipping: {
      fullName: 'Alex Vance',
      email: 'm99038765@gmail.com',
      phone: '+1 (415) 890-2134',
      addressLine1: '450 Mission Street, Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      shippingSpeed: 'express'
    },
    estimatedDeliveryDate: 'Fri, Sep 12, 2026',
    warehouseAssigned: 'Bay Area Hub (WH-01)',
    timeline: [
      {
        status: 'Order Placed & Payment Secured',
        description: 'Payment authorized via Visa (4242). Security score 99.8%.',
        timestamp: 'Sep 9, 2:32 PM',
        completed: true,
        current: false
      },
      {
        status: 'Fulfillment & Quality Barcode Scan',
        description: 'Automated warehouse robotics picked items from Bin A4-Row 12.',
        timestamp: 'Sep 9, 5:10 PM',
        completed: true,
        current: false
      },
      {
        status: 'Carrier Hand-off & Dispatch',
        description: 'Package inducted into NextGen Freight Logistics fleet at Bay Area Hub.',
        timestamp: 'Sep 10, 8:45 AM',
        completed: true,
        current: false
      },
      {
        status: 'In Transit - Out for Regional Distribution',
        description: 'Scanned at San Francisco Central Sort Facility. Courier assigned.',
        timestamp: 'Today, 7:20 AM',
        completed: false,
        current: true
      },
      {
        status: 'Final Delivery',
        description: 'Direct courier delivery with digital signature requirement.',
        timestamp: 'Estimated Tomorrow, 2:30 PM',
        completed: false
      }
    ]
  },
  {
    id: 'ord_sample_731940',
    orderNumber: 'ORD-731940',
    trackingNumber: 'TRK-US-EA22-1940',
    createdAt: '2026-09-02T10:15:00.000Z',
    status: 'delivered',
    items: [
      {
        productId: 'prod_studio_ref_monitors',
        name: 'AcousticLab Model 8 Active Reference Monitors',
        sku: 'AUD-REF-8040',
        price: 849.00,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=900&auto=format&fit=crop&q=80'
      }
    ],
    subtotal: 849.00,
    discount: 0,
    shippingCost: 0,
    tax: 70.04,
    total: 919.04,
    payment: {
      method: 'apple_pay',
      cardBrand: 'Apple Pay',
      last4: '9102',
      transactionId: 'txn_771920381b',
      authorizationCode: 'AUTH_441209',
      status: 'paid'
    },
    shipping: {
      fullName: 'Alex Vance',
      email: 'm99038765@gmail.com',
      phone: '+1 (415) 890-2134',
      addressLine1: '450 Mission Street, Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      shippingSpeed: 'standard'
    },
    estimatedDeliveryDate: 'Fri, Sep 5, 2026',
    warehouseAssigned: 'Bay Area Hub (WH-01)',
    timeline: [
      {
        status: 'Order Placed & Payment Secured',
        description: 'Biometric authorization verified via Apple Pay device token.',
        timestamp: 'Sep 2, 10:15 AM',
        completed: true,
        current: false
      },
      {
        status: 'Warehouse Automated Packaging',
        description: 'Inspected, cushioned with ESD-protective foam, barcode verified.',
        timestamp: 'Sep 2, 1:40 PM',
        completed: true,
        current: false
      },
      {
        status: 'Carrier Dispatch & Regional Transit',
        description: 'Arrived at San Francisco Logistics Depo.',
        timestamp: 'Sep 3, 9:20 AM',
        completed: true,
        current: false
      },
      {
        status: 'Delivered - Signed by Receptionist',
        description: 'Package delivered safely to Front Desk Mailroom. Proof of delivery logged.',
        timestamp: 'Sep 5, 1:42 PM',
        completed: true,
        current: true
      }
    ]
  },
  {
    id: 'ord_sample_920412',
    orderNumber: 'ORD-920412',
    trackingNumber: 'TRK-US-NY88-0412',
    createdAt: '2026-09-10T18:45:00.000Z',
    status: 'picking',
    items: [
      {
        productId: 'prod_mech_keyboard_cnc',
        name: 'Vanguard 75% CNC Billet Aluminum Mechanical Keyboard',
        sku: 'KB-TITAN-75',
        price: 329.00,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=80'
      }
    ],
    subtotal: 329.00,
    discount: 0,
    shippingCost: 15.00,
    tax: 28.38,
    total: 372.38,
    payment: {
      method: 'card',
      cardBrand: 'Mastercard',
      last4: '8821',
      transactionId: 'txn_339102844c',
      authorizationCode: 'AUTH_620199',
      status: 'paid'
    },
    shipping: {
      fullName: 'Alex Vance',
      email: 'm99038765@gmail.com',
      phone: '+1 (415) 890-2134',
      addressLine1: '450 Mission Street, Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      shippingSpeed: 'standard'
    },
    estimatedDeliveryDate: 'Mon, Sep 15, 2026',
    warehouseAssigned: 'East Coast DC (WH-02)',
    timeline: [
      {
        status: 'Order Placed & Payment Secured',
        description: 'Payment verified with 3D Secure 2.0 biometric challenge.',
        timestamp: 'Sep 10, 6:45 PM',
        completed: true,
        current: false
      },
      {
        status: 'Fulfillment & Warehouse Picking',
        description: 'Automated warehouse robotics picking units from East Coast DC.',
        timestamp: 'In Progress',
        completed: false,
        current: true
      },
      {
        status: 'Carrier Hand-off & Dispatch',
        description: 'Staging barcode generated for express cargo transport.',
        timestamp: 'Scheduled Tonight',
        completed: false
      },
      {
        status: 'In Transit & Final Delivery',
        description: 'Interstate cross-dock transit to West Coast terminal.',
        timestamp: 'Estimated Sep 15',
        completed: false
      }
    ]
  }
];

export function createSampleOrder(): Order {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const orderNumber = `ORD-${randomNum}`;
  const trackingNumber = `TRK-US-WH01-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date();
  const deliveryDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  return {
    id: _getUniqueId("ord_custom"),
    orderNumber,
    trackingNumber,
    createdAt: now.toISOString(),
    status: 'processing',
    items: [
      {
        productId: 'prod_mech_keyboard_cnc',
        name: 'Vanguard 75% CNC Billet Aluminum Mechanical Keyboard',
        sku: 'KB-TITAN-75',
        price: 329.00,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=900&auto=format&fit=crop&q=80'
      }
    ],
    subtotal: 329.00,
    discount: 0,
    shippingCost: 0,
    tax: 27.14,
    total: 356.14,
    payment: {
      method: 'card',
      cardBrand: 'Visa',
      last4: '4242',
      transactionId: _getUniqueId("txn"),
      authorizationCode: `AUTH_${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'paid'
    },
    shipping: {
      fullName: 'Alex Vance',
      email: 'm99038765@gmail.com',
      phone: '+1 (415) 890-2134',
      addressLine1: '450 Mission Street, Suite 1200',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'United States',
      shippingSpeed: 'standard'
    },
    estimatedDeliveryDate: deliveryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    warehouseAssigned: 'Bay Area Hub (WH-01)',
    timeline: [
      {
        status: 'Order Placed & Payment Secured',
        description: 'Payment authorized and escrow verified.',
        timestamp: 'Just now',
        completed: true,
        current: false
      },
      {
        status: 'Fulfillment & Warehouse Picking',
        description: 'Order queued for optical robotic picking.',
        timestamp: 'Starting in 10 mins',
        completed: false,
        current: true
      },
      {
        status: 'Carrier Hand-off & Transit',
        description: 'Package barcode staged for courier hand-off.',
        timestamp: 'Pending',
        completed: false
      },
      {
        status: 'Delivered',
        description: 'Standard courier delivery to destination.',
        timestamp: deliveryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: false
      }
    ]
  };
}
