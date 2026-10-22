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
      SELECT id, created_at, customer_name, customer_email, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, fulfilled
      FROM orders WHERE id = ${id} AND customer_email = ${email}
    `) as OrderRow[];
    if (!row) return json({ error: '找不到這筆訂單，請確認訂單編號與 Email' }, 404);
    return json(toOrderJson(row));
  }

  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.fulfilled !== 'boolean') return json({ error: 'fulfilled must be a boolean' }, 400);

  const db = getDb();
  const [updated] = (await db.sql`
    UPDATE orders SET fulfilled = ${body.fulfilled} WHERE id = ${id}
    RETURNING id, fulfilled
  `) as { id: number; fulfilled: boolean }[];
  if (!updated) return json({ error: 'not found' }, 404);

  return json(updated);
};

export const config: Config = {
  path: '/api/orders/:id',
};
