import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

interface OrderRow {
  id: number;
  customer_name: string;
  customer_email: string;
}

// One-off repair: orders placed before email collection was added to
// checkout (2026-10-13) have customer_email = '' and are invisible to
// customers-list.mts's per-customer totals (it groups by email and
// excludes blank ones outright) - so a customer's early order history
// never counts toward their 總消費/豆子消費/等級, even after the
// kind-tagging backfill (admin-backfill-beans-kind.mts), which only
// touches items.kind and can't fix a missing email.
//
// This merges a blank-email order into an existing customer record by
// matching customer_name - but ONLY when that exact name is tied to
// exactly one email elsewhere in the order history. A name used by two
// or more different emails (two different "小明"s, a typo'd email on one
// of their orders, etc.) is left alone rather than guessed at; those show
// up in `unresolved` for manual review instead of a wrong merge.
// GET = dry run (no writes). POST = apply.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const orders = (await db.sql`SELECT id, customer_name, customer_email FROM orders`) as OrderRow[];

  const emailsByName = new Map<string, Set<string>>();
  for (const o of orders) {
    const name = o.customer_name.trim();
    const email = o.customer_email.trim();
    if (!name || !email) continue;
    const set = emailsByName.get(name) ?? new Set<string>();
    set.add(email);
    emailsByName.set(name, set);
  }

  const merges: { orderId: number; name: string; assignedEmail: string }[] = [];
  const unresolved: { orderId: number; name: string; reason: string }[] = [];

  for (const o of orders) {
    if (o.customer_email.trim() !== '') continue;
    const name = o.customer_name.trim();
    if (!name) {
      unresolved.push({ orderId: o.id, name, reason: '訂單也沒有填姓名，沒有依據可以合併' });
      continue;
    }
    const candidates = emailsByName.get(name);
    if (!candidates || candidates.size === 0) {
      unresolved.push({ orderId: o.id, name, reason: '找不到同名、有留 Email 的其他訂單' });
    } else if (candidates.size > 1) {
      unresolved.push({ orderId: o.id, name, reason: `同名但對到 ${candidates.size} 個不同 Email，無法確定是同一人` });
    } else {
      merges.push({ orderId: o.id, name, assignedEmail: [...candidates][0] });
    }
  }

  if (req.method === 'POST') {
    for (const m of merges) {
      await db.pool.query('UPDATE orders SET customer_email = $1 WHERE id = $2', [m.assignedEmail, m.orderId]);
    }
  }

  return json({
    applied: req.method === 'POST',
    ordersMerged: merges.length,
    merges,
    unresolvedCount: unresolved.length,
    unresolved,
  });
};

export const config: Config = {
  path: '/api/admin/backfill-customer-email',
};
