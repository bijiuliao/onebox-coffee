import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { notifyNewBeanLaunch } from './lib/notify';

// Every customer who's ever placed an order (same definition as
// customers-list.mts's /api/customers), not just past bean buyers - someone
// who's only ordered hand-drip in-store might still want to hear about a
// new bean they could take home. Shared by the GET preview and the POST
// send, so the admin's "who will this go to" preview always matches
// exactly who actually gets emailed.
async function getAllCustomers(db: ReturnType<typeof getDb>) {
  const rows = (await db.sql`
    SELECT
      customer_email,
      (ARRAY_AGG(customer_name ORDER BY created_at DESC))[1] AS latest_name
    FROM orders
    WHERE customer_email <> ''
    GROUP BY customer_email
    ORDER BY customer_email
  `) as { customer_email: string; latest_name: string }[];
  return rows.map(r => ({ email: r.customer_email, name: r.latest_name }));
}

// Manual, admin-picked batch announcement: the admin selects however many
// newly-launched beans belong together and this sends ONE combined email
// per customer covering all of them, instead of one email per bean (see
// client's NotifyBeansView - this replaced an earlier design that
// auto-sent on each bean's first activation, which could fire several
// separate emails on a busy launch day).
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const db = getDb();

  if (req.method === 'GET') {
    // Recipient preview - who a send would currently go to, shown before
    // the admin commits to sending.
    return json(await getAllCustomers(db));
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const coffeeIds = Array.isArray(body.coffeeIds) ? body.coffeeIds.filter((v: unknown): v is string => typeof v === 'string') : [];
  if (coffeeIds.length === 0) return json({ error: 'coffeeIds is required' }, 400);

  // Admin picks which of the customers (see the GET preview above) actually
  // get this one - not hardcoded to "everyone" so a smaller or test send is
  // possible.
  const recipientEmails = Array.isArray(body.recipientEmails)
    ? body.recipientEmails.filter((v: unknown): v is string => typeof v === 'string' && v.length > 0)
    : [];
  if (recipientEmails.length === 0) return json({ error: 'recipientEmails is required' }, 400);

  const { rows } = await db.pool.query<CoffeeRow>('SELECT * FROM coffees WHERE id = ANY($1)', [coffeeIds]);
  if (rows.length === 0) return json({ error: 'no matching coffees found' }, 404);

  const coffees = rows.map(toCoffee);
  const result = await notifyNewBeanLaunch(coffees, recipientEmails);
  if (result.sent === 0) return json({ error: '寄送失敗，請確認寄信設定' }, 502);

  await db.pool.query('UPDATE coffees SET launch_notified = true WHERE id = ANY($1)', [rows.map((r: CoffeeRow) => r.id)]);

  return json({ ok: true, beanCount: coffees.length, recipientCount: recipientEmails.length, sent: result.sent, failed: result.failed });
};

export const config: Config = {
  path: '/api/admin/notify-beans',
};
