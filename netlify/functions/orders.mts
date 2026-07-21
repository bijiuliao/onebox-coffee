import type { Config, Context } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { toSpecial, type SpecialRow } from './lib/specials';
import { requireAdmin } from './lib/auth';
import { notifyNewOrder } from './lib/notify';
import { quoteDelivery, isValidLatLng } from './lib/delivery';

type ItemKind = 'drip' | 'beans' | 'special';
type OrderType = '自取' | '外送';

interface CartItemInput {
  kind: ItemKind;
  id: string;
  temp?: string;
  size?: string;
  bagLabel?: string;
  qty: number;
}

interface OrderLine {
  name: string;
  detail: string;
  qty: number;
  unitPrice: number;
  linePrice: number;
}

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = '5 minutes';
const DEDUPE_WINDOW = '30 seconds';

function dedupeKeyFor(customerName: string, orderType: OrderType, items: CartItemInput[]) {
  const itemsKey = items
    .map(i => `${i.kind}:${i.id}:${i.temp ?? ''}:${i.size ?? ''}:${i.bagLabel ?? ''}:${i.qty}`)
    .sort()
    .join(',');
  return `${customerName}|${orderType}|${itemsKey}`;
}

async function priceItem(db: ReturnType<typeof getDb>, item: CartItemInput): Promise<OrderLine | { error: string }> {
  const qty = Math.max(1, Math.floor(Number(item.qty) || 1));

  if (item.kind === 'drip') {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return { error: `unknown coffee: ${item.id}` };
    const coffee = toCoffee(row);
    const size = item.size === '大杯' ? '大杯' : '標準';
    const temp = item.temp === '冰' ? '冰' : '熱';
    const unitPrice = coffee.price + (size === '大杯' ? 20 : 0);
    return { name: coffee.name, detail: `${temp} · ${size}`, qty, unitPrice, linePrice: unitPrice * qty };
  }

  if (item.kind === 'beans') {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return { error: `unknown coffee: ${item.id}` };
    const coffee = toCoffee(row);
    if (!coffee.sellsBeans) return { error: `${coffee.name} 目前沒有開放零售` };
    const bag = coffee.bagOptions.find(b => b.label === item.bagLabel);
    if (!bag) return { error: `${coffee.name} 沒有這個重量選項` };
    return { name: `${coffee.name}（豆）`, detail: bag.label, qty, unitPrice: bag.price, linePrice: bag.price * qty };
  }

  if (item.kind === 'special') {
    const [row] = (await db.sql`SELECT * FROM specials WHERE id = ${item.id}`) as SpecialRow[];
    if (!row) return { error: `unknown special: ${item.id}` };
    const special = toSpecial(row);
    if (!special.active) return { error: `${special.name} 目前未上架` };
    const temp = item.temp === '冰' ? '冰' : '熱';
    return { name: special.name, detail: temp, qty, unitPrice: special.price, linePrice: special.price * qty };
  }

  return { error: `unknown item kind` };
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

  const lines: OrderLine[] = [];
  for (const item of items) {
    const priced = await priceItem(db, item);
    if ('error' in priced) return json({ error: priced.error }, 400);
    lines.push(priced);
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
