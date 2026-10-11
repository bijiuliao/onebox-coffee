import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';

export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'DELETE') return json({ error: 'method not allowed' }, 405);

  // Path is /api/admin/reviews/:id - segments[0]='api', [1]='admin', [2]='reviews', [3]=id.
  const id = Number(pathSegments(req)[3]);
  if (!Number.isInteger(id)) return json({ error: 'missing id' }, 400);

  const db = getDb();
  const result = await db.pool.query('DELETE FROM coffee_reviews WHERE id = $1', [id]);
  if (result.rowCount === 0) return json({ error: 'not found' }, 404);
  return json({ ok: true });
};

export const config: Config = {
  path: '/api/admin/reviews/:id',
};
