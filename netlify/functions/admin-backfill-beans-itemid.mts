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

// Follow-up to admin-backfill-beans-kind.mts: that tool tagged old beans
// lines with kind='beans' (fixing beansSpent-based features - member
// level, customer totals), but deliberately left itemId alone, since
// nothing beansSpent-related needs it and guessing a coffee id from a
// display name risked a wrong attribution. StockView.mts's per-coffee
// rollup (庫存/銷售額) DOES need itemId - it's keyed by
// `line.itemId === coffee.id` - so those same pre-2026-10-22 orders still
// show as untracked there even after the kind backfill.
//
// This fills in itemId by matching a beans line's name (with the trailing
// "（豆）" stripped, same convention as the kind backfill) against the
// CURRENT coffees table (including archived/discontinued ones, since an
// old order can reference a bean no longer for sale) - but only when that
// exact name matches exactly one coffee. A name matching zero or several
// coffees (renamed since, or two coffees that happen to share a name) is
// left alone and reported in `unresolved` rather than guessed at.
// GET = dry run (no writes). POST = apply.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const coffees = (await db.sql`SELECT id, name FROM coffees`) as { id: string; name: string }[];
  const idsByName = new Map<string, string[]>();
  for (const c of coffees) {
    const list = idsByName.get(c.name) ?? [];
    list.push(c.id);
    idsByName.set(c.name, list);
  }

  const orders = (await db.sql`SELECT id, customer_email, items FROM orders`) as Pick<OrderRow, 'id' | 'customer_email' | 'items'>[];

  const changes: { orderId: number; email: string; name: string; assignedItemId: string }[] = [];
  const unresolved: { orderId: number; name: string; reason: string }[] = [];
  const updates: { id: number; items: StoredOrderLine[] }[] = [];

  for (const order of orders) {
    const items = (typeof order.items === 'string' ? JSON.parse(order.items) : order.items) as StoredOrderLine[];
    let changed = false;
    const nextItems = items.map(item => {
      if (item.kind !== 'beans' || item.itemId || !item.name) return item;
      const strippedName = item.name.replace(/（豆）$/, '');
      const candidates = idsByName.get(strippedName);
      if (!candidates || candidates.length === 0) {
        unresolved.push({ orderId: order.id, name: item.name, reason: '找不到名稱相符的豆子（可能後來改名了）' });
        return item;
      }
      if (candidates.length > 1) {
        unresolved.push({ orderId: order.id, name: item.name, reason: `有 ${candidates.length} 款豆子名稱一樣，無法確定是哪一款` });
        return item;
      }
      changed = true;
      changes.push({ orderId: order.id, email: order.customer_email, name: item.name, assignedItemId: candidates[0] });
      return { ...item, itemId: candidates[0] };
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
    changes,
    unresolvedCount: unresolved.length,
    unresolved,
  });
};

export const config: Config = {
  path: '/api/admin/backfill-beans-itemid',
};
