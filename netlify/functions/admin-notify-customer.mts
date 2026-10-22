import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { notifyNewBeanLaunch } from './lib/notify';

// Manual, admin-triggered send of the "new bean" email to one specific
// customer - separate from the automatic one-time broadcast in
// coffees-item.mts (not gated by launch_notified, so it also works for a
// bean that's already been on-menu a while, e.g. "tell this one customer
// about a bean they haven't tried").
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const coffeeId = typeof body.coffeeId === 'string' ? body.coffeeId : '';
  if (!email) return json({ error: 'email is required' }, 400);
  if (!coffeeId) return json({ error: 'coffeeId is required' }, 400);

  const db = getDb();
  const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${coffeeId}`) as CoffeeRow[];
  if (!row) return json({ error: 'coffee not found' }, 404);

  const result = await notifyNewBeanLaunch(toCoffee(row), [email]);
  if (result.sent === 0) return json({ error: '寄送失敗，請確認寄信設定' }, 502);
  return json({ ok: true });
};

export const config: Config = {
  path: '/api/admin/notify-customer',
};
