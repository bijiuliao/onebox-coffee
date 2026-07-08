import type { Config, Context } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { notifyNewOrder } from './lib/notify';
import { quoteDelivery, isValidLatLng } from './lib/delivery';

interface CartItemInput {
  id: string;
  temp: string;
  size: string;
  qty: number;
}

type OrderType = '自取' | '外送';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = '5 minutes';
const DEDUPE_WINDOW = '30 seconds';

function dedupeKeyFor(customerName: string, orderType: OrderType, items: CartItemInput[]) {
  const itemsKey = items.map(i => `${i.id}:${i.temp}:${i.size}:${i.qty}`).sort().join(',');
  return `${customerName}|${orderType}|${itemsKey}`;
}

export default async (req: Request, context: Context) => {
  const db = getDb();

  if (req.method === 'GET') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const rows = (await db.sql`
      SELECT id, created_at, customer_name, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng
      FROM orders ORDER BY created_at DESC LIMIT 200
    `) as {
      id: number; created_at: string; customer_name: string; items: unknown; total: number;
      order_type: string; delivery_fee: number; delivery_distance_km: number | null;
      customer_lat: number | null; customer_lng: number | null;
    }[];
    const orders = rows.map(r => ({
      id: r.id,
      createdAt: r.created_at,
      customerName: r.customer_name,
      items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items,
      total: r.total,
      orderType: r.order_type,
      deliveryFee: r.delivery_fee,
      deliveryDistanceKm: r.delivery_distance_km,
      customerLat: r.customer_lat,
      customerLng: r.customer_lng,
    }));
    return json(orders);
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName) return json({ error: 'customerName is required' }, 400);
  if (customerName.length > 40) return json({ error: 'customerName is too long' }, 400);

  const orderType: OrderType = body.orderType === '外送' ? '外送' : '自取';

  const items: CartItemInput[] = Array.isArray(body.items) ? (body.items as CartItemInput[]) : [];
  if (items.length === 0) return json({ error: 'cart is empty' }, 400);

  let deliveryFee = 0;
  let deliveryDistanceKm: number | null = null;
  let customerLat: number | null = null;
  let customerLng: number | null = null;

  if (orderType === '外送') {
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!isValidLatLng(lat, lng)) return json({ error: 'delivery requires a valid lat/lng' }, 400);
    const quote = quoteDelivery(lat, lng);
    if (!quote.deliverable) {
      return json({ error: `此位置距離超過 ${quote.maxKm} 公里外送範圍，請選擇自取` }, 400);
    }
    deliveryFee = quote.fee;
    deliveryDistanceKm = quote.distanceKm;
    customerLat = lat;
    customerLng = lng;
  }

  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

  const [{ count: recentCount }] = (await db.sql`
    SELECT COUNT(*)::int as count FROM orders
    WHERE client_ip = ${ip} AND created_at > now() - ${RATE_LIMIT_WINDOW}::interval
  `) as { count: number }[];
  if (recentCount >= RATE_LIMIT_MAX) {
    return json({ error: '短時間內下單次數過多，請稍後再試' }, 429);
  }

  const dedupeKey = dedupeKeyFor(customerName, orderType, items);
  const [dup] = (await db.sql`
    SELECT id, created_at, total, order_type, delivery_fee, delivery_distance_km FROM orders
    WHERE client_ip = ${ip} AND dedupe_key = ${dedupeKey} AND created_at > now() - ${DEDUPE_WINDOW}::interval
    ORDER BY created_at DESC LIMIT 1
  `) as { id: number; created_at: string; total: number; order_type: string; delivery_fee: number; delivery_distance_km: number | null }[];

  const lines: { id: string; name: string; temp: string; size: string; qty: number; unitPrice: number; linePrice: number }[] = [];
  for (const item of items) {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return json({ error: `unknown coffee: ${item.id}` }, 400);
    const coffee = toCoffee(row);
    const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
    const unitPrice = coffee.price + (item.size === '大杯' ? 20 : 0);
    lines.push({ id: coffee.id, name: coffee.name, temp: item.temp, size: item.size, qty, unitPrice, linePrice: unitPrice * qty });
  }

  if (dup) {
    // Same customer, same cart, same IP, moments ago - treat as an accidental
    // double-submit rather than creating a second order.
    return json({
      id: dup.id, createdAt: dup.created_at, customerName, items: lines, total: dup.total,
      orderType: dup.order_type, deliveryFee: dup.delivery_fee, deliveryDistanceKm: dup.delivery_distance_km,
    }, 200);
  }

  const total = lines.reduce((sum, l) => sum + l.linePrice, 0) + deliveryFee;
  const [order] = (await db.sql`
    INSERT INTO orders (customer_name, items, total, client_ip, dedupe_key, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng)
    VALUES (${customerName}, ${JSON.stringify(lines)}, ${total}, ${ip}, ${dedupeKey}, ${orderType}, ${deliveryFee}, ${deliveryDistanceKm}, ${customerLat}, ${customerLng})
    RETURNING id, created_at
  `) as { id: number; created_at: string }[];

  await notifyNewOrder({
    id: order.id, customerName, items: lines, total,
    orderType, deliveryFee, deliveryDistanceKm, customerLat, customerLng,
  });

  return json({
    id: order.id, createdAt: order.created_at, customerName, items: lines, total,
    orderType, deliveryFee, deliveryDistanceKm,
  }, 201);
};

export const config: Config = {
  path: '/api/orders',
};
