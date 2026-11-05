import type { Config, Context } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { toSpecial, type SpecialRow } from './lib/specials';
import { requireAdmin } from './lib/auth';
import { notifyNewOrder, notifyCustomerOrderConfirmation } from './lib/notify';
import { quoteDelivery, isValidLatLng } from './lib/delivery';
import { parseBagWeightGrams } from './lib/weight';
import { toOrderJson, type OrderRow } from './lib/orders';

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
  // Which coffee/special this line is for, and whether it was ordered as
  // drip or beans - the display name alone isn't a stable key (a coffee can
  // be renamed later), so per-bean sales reporting needs this to reliably
  // group lines back to a coffee. Orders placed before this field existed
  // just won't have it - those older lines are silently left out of any
  // per-bean aggregate rather than guessed at by name matching.
  itemId: string;
  kind: ItemKind;
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

async function priceItem(db: ReturnType<typeof getDb>, item: CartItemInput, dripEnabled: boolean): Promise<OrderLine | { error: string }> {
  const qty = Math.max(1, Math.floor(Number(item.qty) || 1));

  if (item.kind === 'drip') {
    if (!dripEnabled) return { error: '目前暫停手沖供應，僅能購買豆子' };
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return { error: `unknown coffee: ${item.id}` };
    const coffee = toCoffee(row);
    if (coffee.archived) return { error: `${coffee.name} 已經下架` };
    // Stock only tracks retail bean bags, not hand-drip cups - a coffee
    // can run out of beans to sell while the bar keeps brewing it.
    const size = item.size === '大杯' ? '大杯' : '標準';
    const temp = item.temp === '冰' ? '冰' : '熱';
    const unitPrice = coffee.price + (size === '大杯' ? 20 : 0);
    return { name: coffee.name, detail: `${temp} · ${size}`, qty, unitPrice, linePrice: unitPrice * qty, itemId: coffee.id, kind: 'drip' };
  }

  if (item.kind === 'beans') {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${item.id}`) as CoffeeRow[];
    if (!row) return { error: `unknown coffee: ${item.id}` };
    const coffee = toCoffee(row);
    if (coffee.archived) return { error: `${coffee.name} 已經下架` };
    if (!coffee.sellsBeans) return { error: `${coffee.name} 目前沒有開放零售` };
    const bag = coffee.bagOptions.find(b => b.label === item.bagLabel);
    if (!bag) return { error: `${coffee.name} 沒有這個重量選項` };
    // Stock is tracked in grams, deducted by each bag's actual weight (parsed
    // from its label, e.g. "半磅 227g") rather than 1 unit per bag - a 1kg
    // bag should draw down the shared stock far more than a 227g one does.
    // A label with no recognizable weight (no number in it) can't be
    // checked against the gram pool, so it's left untracked rather than
    // blocked outright - see parseBagWeightGrams.
    if (coffee.stockQty !== null) {
      const grams = parseBagWeightGrams(bag.label);
      if (grams !== null && coffee.stockQty < grams * qty) {
        return { error: `${coffee.name}（${bag.label}）庫存不足，只剩 ${coffee.stockQty}g` };
      }
    }
    return { name: `${coffee.name}（豆）`, detail: bag.label, qty, unitPrice: bag.price, linePrice: bag.price * qty, itemId: coffee.id, kind: 'beans' };
  }

  if (item.kind === 'special') {
    const [row] = (await db.sql`SELECT * FROM specials WHERE id = ${item.id}`) as SpecialRow[];
    if (!row) return { error: `unknown special: ${item.id}` };
    const special = toSpecial(row);
    if (!special.active) return { error: `${special.name} 目前未上架` };
    const temp = item.temp === '冰' ? '冰' : '熱';
    return { name: special.name, detail: temp, qty, unitPrice: special.price, linePrice: special.price * qty, itemId: special.id, kind: 'special' };
  }

  return { error: `unknown item kind` };
}

export default async (req: Request, context: Context) => {
  const db = getDb();

  if (req.method === 'GET') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const rows = (await db.sql`
      SELECT id, created_at, customer_name, customer_email, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, fulfilled, paid, discount_amount
      FROM orders ORDER BY created_at DESC LIMIT 200
    `) as OrderRow[];
    return json(rows.map(toOrderJson));
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName) return json({ error: 'customerName is required' }, 400);
  if (customerName.length > 40) return json({ error: 'customerName is too long' }, 400);

  // Required (not just optional contact info) so repeat customers can be
  // grouped reliably in the customer list - customerName alone can collide
  // between different people. Lowercased so "Foo@Example.com" and
  // "foo@example.com" aggregate as the same customer.
  const customerEmail = typeof body.customerEmail === 'string' ? body.customerEmail.trim().toLowerCase() : '';
  if (!customerEmail) return json({ error: 'customerEmail is required' }, 400);
  if (customerEmail.length > 254) return json({ error: 'customerEmail is too long' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return json({ error: 'customerEmail is not a valid email address' }, 400);

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
    SELECT id, created_at, total, order_type, delivery_fee, delivery_distance_km, discount_amount FROM orders
    WHERE client_ip = ${ip} AND dedupe_key = ${dedupeKey} AND created_at > now() - ${DEDUPE_WINDOW}::interval
    ORDER BY created_at DESC LIMIT 1
  `) as { id: number; created_at: string; total: number; order_type: string; delivery_fee: number; delivery_distance_km: number | null; discount_amount: number }[];

  const [{ drip_enabled: dripEnabled }] = (await db.sql`SELECT drip_enabled FROM site_settings WHERE id = 1`) as { drip_enabled: boolean }[];

  const lines: OrderLine[] = [];
  for (const item of items) {
    const priced = await priceItem(db, item, dripEnabled);
    if ('error' in priced) return json({ error: priced.error }, 400);
    lines.push(priced);
  }

  if (dup) {
    // Same customer, same cart, same IP, moments ago - treat as an accidental
    // double-submit rather than creating a second order.
    return json({
      id: dup.id, createdAt: dup.created_at, customerName, customerEmail, items: lines, total: dup.total,
      orderType: dup.order_type, deliveryFee: dup.delivery_fee, deliveryDistanceKm: dup.delivery_distance_km,
      fulfilled: false, paid: false, discountAmount: dup.discount_amount,
    }, 200);
  }

  const itemsTotal = lines.reduce((sum, l) => sum + l.linePrice, 0);
  const beansSubtotal = lines.filter(l => l.kind === 'beans').reduce((sum, l) => sum + l.linePrice, 0);

  // The cart lists every unredeemed discount-type reward by name (see
  // /api/member-discount) and lets the customer pick which one to use, or
  // none at all - this is that choice, not a server-side "best one wins"
  // pick. null (unset, or no discount available) means no discount.
  const requestedDiscountRewardId = Number.isInteger(body.discountRewardId) ? (body.discountRewardId as number) : null;

  // Re-validated here rather than trusted from the client - must still be
  // this email's, still unredeemed, and still a discount-type reward (an
  // id from a stale page load could otherwise have been redeemed, or even
  // retired of its discount %, in the meantime). Picked here but only
  // actually consumed (and only then counted) inside the transaction
  // below, so a race against a second concurrent order can't spend the
  // same reward twice.
  const [discountCandidate] = requestedDiscountRewardId !== null ? (await db.sql`
    SELECT mr.id, ro.discount_percent
    FROM member_rewards mr
    JOIN reward_options ro ON ro.reward_key = mr.reward_key
    WHERE mr.id = ${requestedDiscountRewardId} AND mr.customer_email = ${customerEmail} AND mr.redeemed_at IS NULL AND ro.discount_percent IS NOT NULL
    LIMIT 1
  `) as { id: number; discount_percent: number }[] : [];

  // Only retail bean bags draw down stock - hand-drip cups are unlimited
  // (see priceItem above) - and by each bag's actual gram weight, not 1 per
  // bag, so aggregate grams needed per coffee id from beans lines before
  // touching the DB. A bag label with no parseable weight is left out here
  // too, same as in priceItem's pre-check.
  const stockNeeded = new Map<string, number>();
  for (const item of items) {
    if (item.kind === 'beans') {
      const grams = parseBagWeightGrams(item.bagLabel ?? '');
      if (grams === null) continue;
      const qty = Math.max(1, Math.floor(Number(item.qty) || 1));
      stockNeeded.set(item.id, (stockNeeded.get(item.id) ?? 0) + grams * qty);
    }
  }

  const client = await db.pool.connect();
  let order: { id: number; created_at: string };
  let discountAmount = 0;
  let discountRewardId: number | null = null;
  try {
    await client.query('BEGIN');

    for (const [coffeeId, gramsNeeded] of stockNeeded) {
      // FOR UPDATE locks the row for the rest of this transaction, so a
      // concurrent order on the same coffee waits here instead of both
      // reading the same stock count and overselling it.
      const { rows } = await client.query<{ name: string; stock_qty: number | null }>(
        'SELECT name, stock_qty FROM coffees WHERE id = $1 FOR UPDATE',
        [coffeeId],
      );
      const row = rows[0];
      if (row && row.stock_qty !== null) {
        if (row.stock_qty < gramsNeeded) {
          await client.query('ROLLBACK');
          return json({ error: `${row.name} 剛好賣完了，請重新整理頁面再試一次` }, 409);
        }
        await client.query('UPDATE coffees SET stock_qty = stock_qty - $1 WHERE id = $2', [gramsNeeded, coffeeId]);
      }
    }

    if (discountCandidate) {
      // Conditional on redeemed_at IS NULL so a concurrent order that got
      // here first (rare on a friends' site, but the stock lock above
      // proves it's possible) can't double-spend the same reward - if 0
      // rows come back, this order just doesn't get the discount.
      const { rows: redeemRows } = await client.query<{ id: number }>(
        'UPDATE member_rewards SET redeemed_at = now() WHERE id = $1 AND redeemed_at IS NULL RETURNING id',
        [discountCandidate.id],
      );
      if (redeemRows.length > 0) {
        discountAmount = Math.round(beansSubtotal * discountCandidate.discount_percent / 100);
        discountRewardId = discountCandidate.id;
      }
    }
    const total = itemsTotal + deliveryFee - discountAmount;

    const insert = await client.query<{ id: number; created_at: string }>(
      `INSERT INTO orders (customer_name, customer_email, items, total, client_ip, dedupe_key, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, discount_amount, discount_reward_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id, created_at`,
      [customerName, customerEmail, JSON.stringify(lines), total, ip, dedupeKey, orderType, deliveryFee, deliveryDistanceKm, customerLat, customerLng, discountAmount, discountRewardId],
    );
    order = insert.rows[0];

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const total = itemsTotal + deliveryFee - discountAmount;

  const orderForNotify = {
    id: order.id, customerName, customerEmail, items: lines, total,
    orderType, deliveryFee, deliveryDistanceKm, customerLat, customerLng,
  };
  await notifyNewOrder(orderForNotify);
  await notifyCustomerOrderConfirmation(orderForNotify);

  return json({
    id: order.id, createdAt: order.created_at, customerName, customerEmail, items: lines, total,
    orderType, deliveryFee, deliveryDistanceKm, fulfilled: false, paid: false, discountAmount,
  }, 201);
};

export const config: Config = {
  path: '/api/orders',
};
