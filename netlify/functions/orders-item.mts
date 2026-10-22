import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { toOrderJson, type OrderRow } from './lib/orders';

export default async (req: Request) => {
  const id = Number(pathSegments(req)[2]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  if (req.method === 'GET') {
    // Public order lookup for customers (no accounts exist) - the order's
    // own email acts as a shared secret, so this never exposes an order to
    // someone who only guesses/knows an id. The admin's full list stays
    // behind GET /api/orders instead.
    const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
    if (!email) return json({ error: 'email is required' }, 400);

    const db = getDb();
    const [row] = (await db.sql`
      SELECT id, created_at, customer_name, customer_email, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, fulfilled, paid
      FROM orders WHERE id = ${id} AND customer_email = ${email}
    `) as OrderRow[];
    if (!row) return json({ error: '找不到這筆訂單，請確認訂單編號與 Email' }, 404);
    return json(toOrderJson(row));
  }

  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if ('fulfilled' in body && typeof body.fulfilled !== 'boolean') return json({ error: 'fulfilled must be a boolean' }, 400);
  if ('paid' in body && typeof body.paid !== 'boolean') return json({ error: 'paid must be a boolean' }, 400);
  if (!('fulfilled' in body) && !('paid' in body)) return json({ error: 'fulfilled or paid is required' }, 400);

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if ('fulfilled' in body) { sets.push(`fulfilled = $${i}`); values.push(body.fulfilled); i += 1; }
  if ('paid' in body) { sets.push(`paid = $${i}`); values.push(body.paid); i += 1; }
  values.push(id);

  const db = getDb();
  const { rows } = await db.pool.query<{ id: number; fulfilled: boolean; paid: boolean }>(
    `UPDATE orders SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, fulfilled, paid`,
    values,
  );
  if (!rows[0]) return json({ error: 'not found' }, 404);

  return json(rows[0]);
};

export const config: Config = {
  path: '/api/orders/:id',
};
