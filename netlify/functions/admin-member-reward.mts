import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';

// Admin marks a chosen "skill" as redeemed once they've actually handed it
// out (applied the discount, bagged the extra grams, picked the mystery
// bean) - this is the only write path for member_rewards.redeemed_at;
// nothing here, or anywhere else, applies the reward automatically.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const id = Number(pathSegments(req)[3]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.redeemed !== 'boolean') return json({ error: 'redeemed must be a boolean' }, 400);

  const db = getDb();
  const { rows } = await db.pool.query<{ id: number; redeemed_at: string | null }>(
    'UPDATE member_rewards SET redeemed_at = $1 WHERE id = $2 RETURNING id, redeemed_at',
    [body.redeemed ? new Date().toISOString() : null, id],
  );
  if (!rows[0]) return json({ error: 'not found' }, 404);

  return json({ id: rows[0].id, redeemedAt: rows[0].redeemed_at });
};

export const config: Config = {
  path: '/api/admin/member-rewards/:id',
};
