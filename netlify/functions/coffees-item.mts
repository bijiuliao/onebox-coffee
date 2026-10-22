import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, pathSegments, EDITABLE_COLUMNS, JSON_COLUMNS, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { notifyNewBeanLaunch } from './lib/notify';

export default async (req: Request) => {
  const db = getDb();
  const id = decodeURIComponent(pathSegments(req)[2] ?? '');
  if (!id) return json({ error: 'missing id' }, 400);

  if (req.method === 'GET') {
    const [row] = (await db.sql`SELECT * FROM coffees WHERE id = ${id}`) as CoffeeRow[];
    if (!row) return json({ error: 'not found' }, 404);
    return json(toCoffee(row));
  }

  if (req.method === 'PATCH') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const existing = (await db.sql`SELECT * FROM coffees WHERE id = ${id}`) as CoffeeRow[];
    if (existing.length === 0) return json({ error: 'not found' }, 404);
    const existingRow = existing[0];

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    if (typeof body.coverUrl === 'string' && body.coverUrl.length > 0) {
      if (!/^(https?:\/\/|\/api\/cover-image\/)/.test(body.coverUrl)) {
        return json({ error: 'coverUrl must be http(s) or an /api/cover-image/ path' }, 400);
      }
    }

    if ('stockQty' in body && body.stockQty !== null) {
      if (typeof body.stockQty !== 'number' || !Number.isInteger(body.stockQty) || body.stockQty < 0) {
        return json({ error: 'stockQty must be a non-negative integer or null' }, 400);
      }
    }

    if ('costPerGramTwd' in body && body.costPerGramTwd !== null) {
      if (typeof body.costPerGramTwd !== 'number' || !Number.isFinite(body.costPerGramTwd) || body.costPerGramTwd < 0) {
        return json({ error: 'costPerGramTwd must be a non-negative number or null' }, 400);
      }
    }

    // First-ever activation ("上架") triggers a one-time email to past bean
    // customers - gated on launch_notified so re-toggling active later
    // (e.g. temporarily taking a bean off-menu and back on) doesn't re-fire it.
    const willLaunch = body.active === true && !existingRow.active && !existingRow.launch_notified;
    // The admin is asked at that one moment whether to actually send it;
    // declining still consumes the one-time flag below (launch_notified is
    // about "the first-activation decision has been made", not "an email
    // was sent") so re-toggling later doesn't ask again.
    const skipLaunchEmail = body.notifyOnLaunch === false;

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [apiField, column] of Object.entries(EDITABLE_COLUMNS)) {
      if (apiField in body) {
        const value = JSON_COLUMNS.has(apiField) ? JSON.stringify(body[apiField]) : body[apiField];
        sets.push(`${column} = $${i}`);
        values.push(value);
        i += 1;
      }
    }
    const temps = body.temps as { hot?: boolean; ice?: boolean } | undefined;
    if (temps) {
      if ('hot' in temps) { sets.push(`hot_enabled = $${i}`); values.push(!!temps.hot); i += 1; }
      if ('ice' in temps) { sets.push(`ice_enabled = $${i}`); values.push(!!temps.ice); i += 1; }
    }
    const sizes = body.sizes as { std?: boolean; large?: boolean } | undefined;
    if (sizes) {
      if ('std' in sizes) { sets.push(`std_enabled = $${i}`); values.push(!!sizes.std); i += 1; }
      if ('large' in sizes) { sets.push(`large_enabled = $${i}`); values.push(!!sizes.large); i += 1; }
    }

    if (willLaunch) {
      sets.push(`launch_notified = $${i}`);
      values.push(true);
      i += 1;
    }

    if (sets.length > 0) {
      values.push(id);
      await db.pool.query(`UPDATE coffees SET ${sets.join(', ')} WHERE id = $${i}`, values);
    }

    const [updated] = (await db.sql`SELECT * FROM coffees WHERE id = ${id}`) as CoffeeRow[];
    const coffee = toCoffee(updated);

    if (willLaunch && !skipLaunchEmail) {
      // Awaited (not fire-and-forget) - a serverless function's process can
      // freeze right after the response is sent, so background work isn't
      // guaranteed to finish. notifyNewBeanLaunch itself never throws.
      const recipients = (await db.sql`
        SELECT DISTINCT customer_email FROM orders
        WHERE customer_email <> ''
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(items) AS item WHERE item->>'kind' = 'beans')
      `) as { customer_email: string }[];
      await notifyNewBeanLaunch(coffee, recipients.map(r => r.customer_email));
    }

    return json(coffee);
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/coffees/:id',
};
