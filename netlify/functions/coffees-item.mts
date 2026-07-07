import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, pathSegments, EDITABLE_COLUMNS, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';

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

    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    if (typeof body.coverUrl === 'string' && body.coverUrl.length > 0) {
      if (!/^(https?:\/\/|\/api\/cover-image\/)/.test(body.coverUrl)) {
        return json({ error: 'coverUrl must be http(s) or an /api/cover-image/ path' }, 400);
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    for (const [apiField, column] of Object.entries(EDITABLE_COLUMNS)) {
      if (apiField in body) {
        const value = apiField === 'notes' ? JSON.stringify(body[apiField]) : body[apiField];
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

    if (sets.length > 0) {
      values.push(id);
      await db.pool.query(`UPDATE coffees SET ${sets.join(', ')} WHERE id = $${i}`, values);
    }

    const [updated] = (await db.sql`SELECT * FROM coffees WHERE id = ${id}`) as CoffeeRow[];
    return json(toCoffee(updated));
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/coffees/:id',
};
