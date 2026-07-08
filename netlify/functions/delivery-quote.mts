import type { Config } from '@netlify/functions';
import { json } from './lib/coffees';
import { quoteDelivery, isValidLatLng } from './lib/delivery';

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!isValidLatLng(lat, lng)) return json({ error: 'invalid lat/lng' }, 400);

  return json(quoteDelivery(lat, lng));
};

export const config: Config = {
  path: '/api/delivery-quote',
};
