export const MOCK_USER_LOCATION = { lat: 30.2672, lng: -97.7431, city: 'Austin, TX' }; // Austin, TX

const WAREHOUSE_COORDS: Record<string, { lat: number, lng: number }> = {
  'Bay Area Hub (WH-01)': { lat: 37.7749, lng: -122.4194 },
  'East Coast DC (WH-02)': { lat: 40.7128, lng: -74.0060 },
  'Midwest Logistics (WH-03)': { lat: 41.8781, lng: -87.6298 },
  'Pacific Northwest Facility (WH-03)': { lat: 47.6062, lng: -122.3321 },
  'SoCal Studio Hub (WH-04)': { lat: 34.0522, lng: -118.2437 },
  'Automated Logistics Hub (WH-01)': { lat: 39.7392, lng: -104.9903 }, // Denver
};

export function getDistanceToWarehouse(warehouseName: string): number | null {
  const coords = WAREHOUSE_COORDS[warehouseName];
  if (!coords) return null;

  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (coords.lat - MOCK_USER_LOCATION.lat) * (Math.PI / 180);
  const dLng = (coords.lng - MOCK_USER_LOCATION.lng) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(MOCK_USER_LOCATION.lat * (Math.PI / 180)) * Math.cos(coords.lat * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}
