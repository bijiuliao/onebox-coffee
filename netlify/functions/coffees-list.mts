import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { toCoffee, json, slugify, type CoffeeRow } from './lib/coffees';
import { requireAdmin } from './lib/auth';

export default async (req: Request) => {
  const db = getDb();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const all = url.searchParams.get('all') === '1';
    if (all) {
      const unauthorized = requireAdmin(req);
      if (unauthorized) return unauthorized;
    }
    const rows = (await db.sql`SELECT * FROM coffees ORDER BY sort_order ASC`) as CoffeeRow[];
    const coffees = rows.map(toCoffee).filter(c => all || c.active);
    return json(coffees);
  }

  if (req.method === 'POST') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New Coffee';

    const base = slugify(name);
    let id = base;
    let n = 1;
    while (((await db.sql`SELECT 1 FROM coffees WHERE id = ${id}`) as unknown[]).length > 0) {
      n += 1;
      id = `${base}-${n}`;
    }

    const [{ max }] = (await db.sql`SELECT MAX(sort_order) as max FROM coffees`) as { max: number | null }[];
    const sortOrder = (max ?? -1) + 1;

    const [row] = (await db.sql`
      INSERT INTO coffees (id, name, origin_en, roast, level, notes, price, color, score, roaster, hot_enabled, ice_enabled, std_enabled, large_enabled, active, sort_order)
      VALUES (${id}, ${name}, 'ORIGIN', '中焙', 3, '[]', 150, '#c98a2e', 88, 'onebox roastery', true, true, true, false, false, ${sortOrder})
      RETURNING *
    `) as CoffeeRow[];

    return json(toCoffee(row), 201);
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/coffees',
};
