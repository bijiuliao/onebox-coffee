import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, slugify } from './lib/coffees';
import { toSpecial, type SpecialRow } from './lib/specials';
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
    const rows = (await db.sql`SELECT * FROM specials ORDER BY sort_order ASC`) as SpecialRow[];
    const specials = rows.map(toSpecial).filter(s => all || s.active);
    return json(specials);
  }

  if (req.method === 'POST') {
    const unauthorized = requireAdmin(req);
    if (unauthorized) return unauthorized;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'New Special';

    const base = slugify(name);
    let id = base;
    let n = 1;
    while (((await db.sql`SELECT 1 FROM specials WHERE id = ${id}`) as unknown[]).length > 0) {
      n += 1;
      id = `${base}-${n}`;
    }

    const [{ max }] = (await db.sql`SELECT MAX(sort_order) as max FROM specials`) as { max: number | null }[];
    const sortOrder = (max ?? -1) + 1;

    const [row] = (await db.sql`
      INSERT INTO specials (id, name, description, price, color, notes, hot_enabled, ice_enabled, active, sort_order)
      VALUES (${id}, ${name}, '', 120, '#9a4f7d', '[]', true, true, false, ${sortOrder})
      RETURNING *
    `) as SpecialRow[];

    return json(toSpecial(row), 201);
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = {
  path: '/api/specials',
};
