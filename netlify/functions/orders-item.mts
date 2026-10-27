import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { toOrderJson, type OrderRow } from './lib/orders';
import { parseBagWeightGrams } from './lib/weight';

interface StoredOrderLine {
  itemId?: string;
  kind?: string;
  detail?: string;
  qty?: number;
  // Set true once this beans line has actually been bagged - lets the
  // packing queue (PackingView) remember a partial pack across visits
  // instead of re-offering lines that are already done. Index-addressed
  // (not a separate id) since an order's items array never reorders after
  // creation.
  packed?: boolean;
}

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

  if (req.method !== 'PATCH' && req.method !== 'DELETE') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const db = getDb();

  if (req.method === 'DELETE') {
    // For removing test/junk orders from admin, not a customer-facing
    // cancellation flow - permanent, no soft-delete/undo. Mirrors the stock
    // deduction in orders.mts's checkout handler, in reverse: restore the
    // grams this order drew down (where stock is tracked at all) before
    // removing the row, so deleting a test order doesn't leave stock
    // permanently short.
    const [row] = (await db.sql`SELECT items FROM orders WHERE id = ${id}`) as { items: unknown }[];
    if (!row) return json({ error: 'not found' }, 404);
    const items = (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) as StoredOrderLine[];

    const stockToRestore = new Map<string, number>();
    for (const line of items) {
      if (line.kind !== 'beans' || !line.itemId) continue;
      const grams = parseBagWeightGrams(line.detail ?? '');
      if (grams === null) continue;
      const qty = Math.max(1, Math.floor(Number(line.qty) || 1));
      stockToRestore.set(line.itemId, (stockToRestore.get(line.itemId) ?? 0) + grams * qty);
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [coffeeId, grams] of stockToRestore) {
        await client.query(
          'UPDATE coffees SET stock_qty = stock_qty + $1 WHERE id = $2 AND stock_qty IS NOT NULL',
          [grams, coffeeId],
        );
      }
      const { rowCount } = await client.query('DELETE FROM orders WHERE id = $1', [id]);
      if (!rowCount) {
        await client.query('ROLLBACK');
        return json({ error: 'not found' }, 404);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return json({ id, deleted: true });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if ('fulfilled' in body && typeof body.fulfilled !== 'boolean') return json({ error: 'fulfilled must be a boolean' }, 400);
  if ('paid' in body && typeof body.paid !== 'boolean') return json({ error: 'paid must be a boolean' }, 400);
  const packedLineIndexes = Array.isArray(body.packedLineIndexes)
    ? body.packedLineIndexes.filter((v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0)
    : [];
  if (!('fulfilled' in body) && !('paid' in body) && packedLineIndexes.length === 0) {
    return json({ error: 'fulfilled, paid, or packedLineIndexes is required' }, 400);
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if ('fulfilled' in body) { sets.push(`fulfilled = $${i}`); values.push(body.fulfilled); i += 1; }
  if ('paid' in body) { sets.push(`paid = $${i}`); values.push(body.paid); i += 1; }

  // Packing the queue (PackingView) marks specific beans lines done rather
  // than replacing the whole items array, so a concurrent edit elsewhere
  // can't clobber lines this request never touched.
  if (packedLineIndexes.length > 0) {
    const [row] = (await db.sql`SELECT items FROM orders WHERE id = ${id}`) as { items: unknown }[];
    if (!row) return json({ error: 'not found' }, 404);
    const items = (typeof row.items === 'string' ? JSON.parse(row.items) : row.items) as StoredOrderLine[];
    for (const idx of packedLineIndexes) {
      if (items[idx]) items[idx].packed = true;
    }
    sets.push(`items = $${i}`);
    values.push(JSON.stringify(items));
    i += 1;
  }

  values.push(id);
  await db.pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = $${i}`, values);

  const [updated] = (await db.sql`
    SELECT id, created_at, customer_name, customer_email, items, total, order_type, delivery_fee, delivery_distance_km, customer_lat, customer_lng, fulfilled, paid
    FROM orders WHERE id = ${id}
  `) as OrderRow[];
  if (!updated) return json({ error: 'not found' }, 404);

  return json(toOrderJson(updated));
};

export const config: Config = {
  path: '/api/orders/:id',
};
