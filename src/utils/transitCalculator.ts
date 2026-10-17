import { Product, TransitEstimation, QuickShipReadiness } from '../types';

export interface RegionalHub {
  id: string;
  name: string;
  code: string;
  region: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  cutOffHourLocal: number; // 24-hr format
  dispatchSlaHours: number; // 4 hours automated SLA
}

export const REGIONAL_HUBS: RegionalHub[] = [
  {
    id: 'wh-01-sf',
    name: 'Bay Area Hub (WH-01)',
    code: 'WH-01',
    region: 'West Coast',
    city: 'San Francisco',
    state: 'CA',
    lat: 37.7749,
    lng: -122.4194,
    cutOffHourLocal: 17,
    dispatchSlaHours: 4,
  },
  {
    id: 'wh-02-ny',
    name: 'East Coast DC (WH-02)',
    code: 'WH-02',
    region: 'East Coast',
    city: 'New York',
    state: 'NY',
    lat: 40.7128,
    lng: -74.0060,
    cutOffHourLocal: 18,
    dispatchSlaHours: 4,
  },
  {
    id: 'wh-03-chi',
    name: 'Midwest Logistics (WH-03)',
    code: 'WH-03',
    region: 'Midwest',
    city: 'Chicago',
    state: 'IL',
    lat: 41.8781,
    lng: -87.6298,
    cutOffHourLocal: 17,
    dispatchSlaHours: 4,
  },
  {
    id: 'wh-03-sea',
    name: 'Pacific Northwest Facility (WH-03)',
    code: 'WH-03',
    region: 'Pacific Northwest',
    city: 'Seattle',
    state: 'WA',
    lat: 47.6062,
    lng: -122.3321,
    cutOffHourLocal: 16,
    dispatchSlaHours: 4,
  },
  {
    id: 'wh-04-la',
    name: 'SoCal Studio Hub (WH-04)',
    code: 'WH-04',
    region: 'Southwest',
    city: 'Los Angeles',
    state: 'CA',
    lat: 34.0522,
    lng: -118.2437,
    cutOffHourLocal: 17,
    dispatchSlaHours: 4,
  },
  {
    id: 'wh-01-den',
    name: 'Automated Logistics Hub (WH-01)',
    code: 'WH-01',
    region: 'Rocky Mountains',
    city: 'Denver',
    state: 'CO',
    lat: 39.7392,
    lng: -104.9903,
    cutOffHourLocal: 17,
    dispatchSlaHours: 4,
  },
];

// Helper to normalize warehouse name for lookups
export function normalizeWarehouseName(name: string): string {
  if (!name) return 'Bay Area Hub (WH-01)';
  const match = REGIONAL_HUBS.find(
    hub => hub.name.toLowerCase() === name.toLowerCase() ||
           name.toLowerCase().includes(hub.city.toLowerCase()) ||
           name.toLowerCase().includes(hub.name.split('(')[0].trim().toLowerCase())
  );
  return match ? match.name : name;
}

export function getRegionalHubByName(name: string): RegionalHub {
  const normalized = normalizeWarehouseName(name);
  const found = REGIONAL_HUBS.find(h => h.name === normalized);
  return found || REGIONAL_HUBS[0];
}

// Great Circle Distance calculation in miles
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Distance between two regional hubs
export function getDistanceBetweenHubs(whA: string, whB: string): number {
  const hubA = getRegionalHubByName(whA);
  const hubB = getRegionalHubByName(whB);
  if (hubA.name === hubB.name) return 0;
  return calculateDistanceMiles(hubA.lat, hubA.lng, hubB.lat, hubB.lng);
}

// Format future date by adding business days
function addBusinessDays(startDate: Date, days: number): Date {
  const date = new Date(startDate);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return date;
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Calculates Estimated Transit Days based on the customer's default warehouse selection
 */
export function calculateTransitEstimation(
  productWarehouse: string,
  customerWarehouse: string,
  stock: number
): TransitEstimation {
  const originHub = getRegionalHubByName(productWarehouse);
  const destHub = getRegionalHubByName(customerWarehouse);
  const isSameWarehouse = originHub.name === destHub.name;
  const distanceMiles = isSameWarehouse ? 0 : calculateDistanceMiles(originHub.lat, originHub.lng, destHub.lat, destHub.lng);

  if (stock <= 0) {
    const today = new Date();
    const minDate = addBusinessDays(today, 5);
    const maxDate = addBusinessDays(today, 8);

    return {
      daysMin: 5,
      daysMax: 8,
      daysLabel: '5-8 Business Days (Backordered)',
      shortDaysLabel: '5-8 Days',
      estimatedDeliveryDate: `${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
      fullDeliveryDateText: `Est. Restock & Delivery: ${formatDateShort(minDate)}`,
      transitTier: 'out_of_stock',
      distanceMiles,
      productWarehouse: originHub.name,
      customerWarehouse: destHub.name,
      isSameWarehouse,
      badgeColorClass: {
        bg: 'bg-neutral-900/90 hover:bg-neutral-850',
        border: 'border-neutral-700/80',
        text: 'text-neutral-400',
        icon: 'text-neutral-500',
      },
    };
  }

  // Same Warehouse Hub: 1-2 Business Days (Local Pick, Pack & Ground Fast Track)
  if (isSameWarehouse || distanceMiles < 50) {
    const today = new Date();
    const minDate = addBusinessDays(today, 1);
    const maxDate = addBusinessDays(today, 2);

    return {
      daysMin: 1,
      daysMax: 2,
      daysLabel: '1-2 Business Days (Local Hub)',
      shortDaysLabel: '1-2 Days',
      estimatedDeliveryDate: `${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
      fullDeliveryDateText: `Est. Delivery: ${formatDateShort(minDate)} (Same Hub Direct)`,
      transitTier: 'same_hub',
      distanceMiles: 0,
      productWarehouse: originHub.name,
      customerWarehouse: destHub.name,
      isSameWarehouse: true,
      badgeColorClass: {
        bg: 'bg-emerald-950/60 hover:bg-emerald-950/80',
        border: 'border-emerald-500/50 hover:border-emerald-500/80',
        text: 'text-emerald-300 font-semibold',
        icon: 'text-emerald-400',
      },
    };
  }

  // Regional Express (< 650 miles, e.g., Bay Area to SoCal or PNW): 2-3 Business Days
  if (distanceMiles <= 650) {
    const today = new Date();
    const minDate = addBusinessDays(today, 2);
    const maxDate = addBusinessDays(today, 3);

    return {
      daysMin: 2,
      daysMax: 3,
      daysLabel: '2-3 Business Days (Regional Express)',
      shortDaysLabel: '2-3 Days',
      estimatedDeliveryDate: `${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
      fullDeliveryDateText: `Est. Delivery: ${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
      transitTier: 'regional_express',
      distanceMiles,
      productWarehouse: originHub.name,
      customerWarehouse: destHub.name,
      isSameWarehouse: false,
      badgeColorClass: {
        bg: 'bg-sky-950/60 hover:bg-sky-950/80',
        border: 'border-sky-500/50 hover:border-sky-500/80',
        text: 'text-sky-300 font-semibold',
        icon: 'text-sky-400',
      },
    };
  }

  // Cross-Country National Transit (> 650 miles): 3-4 Business Days
  const today = new Date();
  const minDate = addBusinessDays(today, 3);
  const maxDate = addBusinessDays(today, 4);

  return {
    daysMin: 3,
    daysMax: 4,
    daysLabel: '3-4 Business Days (National Transit)',
    shortDaysLabel: '3-4 Days',
    estimatedDeliveryDate: `${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
    fullDeliveryDateText: `Est. Delivery: ${formatDateShort(minDate)} - ${formatDateShort(maxDate)}`,
    transitTier: 'national_transit',
    distanceMiles,
    productWarehouse: originHub.name,
    customerWarehouse: destHub.name,
    isSameWarehouse: false,
    badgeColorClass: {
      bg: 'bg-indigo-950/50 hover:bg-indigo-950/70',
      border: 'border-indigo-500/50 hover:border-indigo-500/80',
      text: 'text-indigo-300 font-semibold',
      icon: 'text-indigo-400',
    },
  };
}

/**
 * Calculates Quick Ship Readiness:
 * Assesses whether the product can be dispatched within 4 hours based on real-time availability in the closest regional hub.
 */
export function calculateQuickShipReadiness(
  product: Product,
  options?: {
    customerWarehouse?: string;
    isSafe?: boolean;
    userLocation?: { lat: number; lng: number };
  }
): QuickShipReadiness {
  const hub = getRegionalHubByName(product.warehouse);
  const availableUnits = Math.max(0, product.stock - (product.reserved || 0));

  let distanceToHub: number | null = null;
  if (options?.userLocation) {
    distanceToHub = calculateDistanceMiles(
      options.userLocation.lat,
      options.userLocation.lng,
      hub.lat,
      hub.lng
    );
  } else if (options?.customerWarehouse) {
    distanceToHub = getDistanceBetweenHubs(product.warehouse, options.customerWarehouse);
  }

  // Calculate cutoff time window (e.g. next 4-hour wave)
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const minutesToNextWave = (240 - ((now.getHours() * 60 + currentMinutes) % 240)) % 240;
  const hoursLeft = Math.floor(minutesToNextWave / 60);
  const minsLeft = minutesToNextWave % 60;
  const cutoffCountdownText = `Order within ${hoursLeft > 0 ? `${hoursLeft}h ` : ''}${minsLeft}m for next 4h dispatch wave`;

  // Check 1: Safe Mode quarantine or damage lock
  if (options?.isSafe === false) {
    return {
      isEligible: false,
      canDispatchWithin4Hours: false,
      status: 'quarantined',
      badgeLabel: 'Dispatch Blocked (Quarantined)',
      shortBadgeLabel: 'Intercepted',
      dispatchWindow: 'Indefinitely Held',
      closestHubName: hub.name,
      closestHubCity: `${hub.city}, ${hub.state}`,
      distanceToHub,
      availableUnits: 0,
      cutoffCountdownText: 'Fulfillment halted pending quality audit verification',
      reason: 'SKU is quarantined or flagged for damage in warehouse audit trail. Automated dispatch disabled.',
      confidenceScore: 1.0,
    };
  }

  // Check 2: Stock depleted
  if (availableUnits <= 0) {
    return {
      isEligible: false,
      canDispatchWithin4Hours: false,
      status: 'out_of_stock',
      badgeLabel: 'Quick Ship Unavailable',
      shortBadgeLabel: 'Unavailable',
      dispatchWindow: 'Standard (24-48h post-restock)',
      closestHubName: hub.name,
      closestHubCity: `${hub.city}, ${hub.state}`,
      distanceToHub,
      availableUnits: 0,
      cutoffCountdownText: 'Awaiting restocking shipment scan',
      reason: '0 physical units currently on shelf in regional hub. Automated 4-hour dispatch unavailable.',
      confidenceScore: 0.95,
    };
  }

  // Check 3: Low stock warning, but currently still available for 4h dispatch
  if (availableUnits <= product.lowStockThreshold) {
    return {
      isEligible: true,
      canDispatchWithin4Hours: true,
      status: 'low_stock_ready',
      badgeLabel: 'Quick Ship: <4h Dispatch',
      shortBadgeLabel: '<4h Dispatch',
      dispatchWindow: '< 4 Hours',
      closestHubName: hub.name,
      closestHubCity: `${hub.city}, ${hub.state}`,
      distanceToHub,
      availableUnits,
      cutoffCountdownText,
      reason: `Only ${availableUnits} unit${availableUnits > 1 ? 's' : ''} left at ${hub.city}! Immediate robotic pick & pack queue active.`,
      confidenceScore: 0.98,
    };
  }

  // Standard: High real-time availability in closest regional hub -> Ready for < 4 hours dispatch
  return {
    isEligible: true,
    canDispatchWithin4Hours: true,
    status: 'ready',
    badgeLabel: 'Quick Ship: <4h Dispatch',
    shortBadgeLabel: '<4h Dispatch',
    dispatchWindow: '< 4 Hours',
    closestHubName: hub.name,
    closestHubCity: `${hub.city}, ${hub.state}`,
    distanceToHub,
    availableUnits,
    cutoffCountdownText,
    reason: `Real-time availability confirmed (${availableUnits} units on shelf at ${hub.name}). Automated pick, scan, and carrier handover ready within 4 hours.`,
    confidenceScore: 0.99,
  };
}
