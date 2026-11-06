import type { Config } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { toOrderJson, type OrderRow } from './lib/orders';

// Lets the admin bump a test email's "豆子消費" without actually placing
// real orders through checkout - for exercising member levels, level-up
// rewards, and the mystery wheel without a real stock deduction, real
// notification emails, or a trip through the cart UI each time. Creates
// one ordinary order row (marked clearly as test in its only line item)
// with a beans-kind line for the requested amount - it participates in
// level/beansSpent math exactly like a real order would, but has no
// itemId (so it never shows up in PackingView's packing queue or
// StockView's per-coffee rollup) and starts paid+fulfilled (so it doesn't
// clutter the pending-orders views either). It's a real row in the same
// `orders` table, so it's also removable the same way any order is -
// delete it from the admin Orders page once done testing.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : '測試帳號';
  const amount = Number(body.amount);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'email is not a valid email address' }, 400);
  if (!Number.isInteger(amount) || amount < 1 || amount > 1_000_000) {
    return json({ error: 'amount must be an integer between 1 and 1,000,000' }, 400);
  }

  const db = getDb();
  const items = [{
    name: '測試消費（測試帳號，可直接刪除）', detail: '管理後台新增', qty: 1,
    unitPrice: amount, linePrice: amount, kind: 'beans',
  }];

  const [created] = (await db.sql`
    INSERT INTO orders (customer_name, customer_email, items, total, client_ip, dedupe_key, order_type, fulfilled, paid)
    VALUES (${name}, ${email}, ${JSON.stringify(items)}, ${amount}, 'admin-test', ${randomUUID()}, '自取', true, true)
    RETURNING id, created_at, customer_name, customer_email, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, fulfilled, paid, discount_amount
  `) as OrderRow[];

  return json(toOrderJson(created), 201);
};

export const config: Config = {
  path: '/api/admin/test-spend',
};
