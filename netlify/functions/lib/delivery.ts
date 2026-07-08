// Shop reference point defaults to MRT Taipei City Hall station (near
// 永吉路30巷148弄) - an approximation good enough for a simple per-km fee.
// Override with exact coordinates via SHOP_LAT/SHOP_LNG if you have them
// (right-click the spot on Google Maps to copy its coordinates).
const SHOP_LAT = Number(process.env.SHOP_LAT ?? 25.0409);
const SHOP_LNG = Number(process.env.SHOP_LNG ?? 121.5677);

const BASE_FEE = Number(process.env.DELIVERY_BASE_FEE ?? 30);
const PER_KM_FEE = Number(process.env.DELIVERY_PER_KM_FEE ?? 10);
const MAX_KM = Number(process.env.DELIVERY_MAX_KM ?? 5);

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  deliverable: boolean;
  maxKm: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function quoteDelivery(lat: number, lng: number): DeliveryQuote {
  const distanceKm = haversineKm(SHOP_LAT, SHOP_LNG, lat, lng);
  const deliverable = distanceKm <= MAX_KM;
  const fee = deliverable ? Math.round(BASE_FEE + PER_KM_FEE * distanceKm) : 0;
  return { distanceKm: Math.round(distanceKm * 10) / 10, fee, deliverable, maxKm: MAX_KM };
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}
