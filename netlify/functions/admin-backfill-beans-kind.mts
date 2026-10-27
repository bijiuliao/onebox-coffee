import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import type { OrderRow } from './lib/orders';

interface StoredOrderLine {
  name?: string;
  detail?: string;
  linePrice?: number;
  itemId?: string;
  kind?: 'drip' | 'beans' | 'special';
  [key: string]: unknown;
}

// One-off repair, not a recurring admin workflow: orders placed before
// 2026-10-22 (when itemId/kind were added to order lines - see orders.mts)
// have beans lines with no `kind`, so member-level.mts's SQL silently
// excludes them from a customer's beansSpent. Every beans line this app has
// ever written, old schema or new, gets its name suffixed "（豆）" in
// priceItem's beans branch - that's the one deterministic signal used here,
// not fuzzy matching against the coffees table (a renamed/deleted coffee
// can't cause a wrong classification this way). Only `kind` is backfilled;
// itemId is intentionally left alone since nothing downstream needs it for
// beansSpent and guessing a coffee id from an old display name is a real
// way to get it wrong.
// GET = dry run (no writes, safe to open directly in a browser with admin
// basic auth). POST = apply the same classification for real.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const orders = (await db.sql`SELECT id, customer_email, items FROM orders`) as Pick<OrderRow, 'id' | 'customer_email' | 'items'>[];

  const changes: { orderId: number; email: string; name: string; detail: string; linePrice: number }[] = [];
  const updates: { id: number; items: StoredOrderLine[] }[] = [];

  for (const order of orders) {
    const items = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as StoredOrderLine[];
    let changed = false;
    const nextItems = items.map(item => {
      if (item.kind || !item.name?.endsWith('（豆）')) return item;
      changed = true;
      changes.push({ orderId: order.id, email: order.customer_email, name: item.name, detail: item.detail ?? '', linePrice: item.linePrice ?? 0 });
      return { ...item, kind: 'beans' as const };
    });
    if (changed) updates.push({ id: order.id, items: nextItems });
  }

  if (req.method === 'POST') {
    for (const u of updates) {
      await db.pool.query('UPDATE orders SET items = $1 WHERE id = $2', [JSON.stringify(u.items), u.id]);
    }
  }

  return json({
    applied: req.method === 'POST',
    ordersAffected: updates.length,
    linesBackfilled: changes.length,
    beansTotalAdded: changes.reduce((s, c) => s + c.linePrice, 0),
    changes,
  });
};

export const config: Config = {
  path: '/api/admin/backfill-beans-kind',
};
