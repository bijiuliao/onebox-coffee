import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';

export default async (req: Request) => {
  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = Number(pathSegments(req)[2]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.fulfilled !== 'boolean') return json({ error: 'fulfilled must be a boolean' }, 400);

  const db = getDb();
  const [updated] = (await db.sql`
    UPDATE orders SET fulfilled = ${body.fulfilled} WHERE id = ${id}
    RETURNING id, fulfilled
  `) as { id: number; fulfilled: boolean }[];
  if (!updated) return json({ error: 'not found' }, 404);

  return json(updated);
};

export const config: Config = {
  path: '/api/orders/:id',
};
