import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import type { RewardOptionRow } from './lib/memberRewards';

function toJson(r: RewardOptionRow) {
  return {
    id: r.id, key: r.reward_key, label: r.label, desc: r.description,
    minLevel: r.min_level, maxLevel: r.max_level, active: r.active, sortOrder: r.sort_order,
  };
}

export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const id = Number(pathSegments(req)[3]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  const db = getDb();

  if (req.method === 'DELETE') {
    // A reward already chosen by someone must keep resolving to a real
    // label in their history (member-level.mts, customers-list.mts) -
    // retiring it (active=false) is the only option once it's referenced;
    // hard delete is only for a reward nobody ever picked.
    const [{ count }] = (await db.sql`SELECT COUNT(*)::int AS count FROM member_rewards WHERE reward_key = (SELECT reward_key FROM reward_options WHERE id = ${id})`) as { count: number }[];
    if (count > 0) {
      return json({ error: `已經有 ${count} 筆客戶選過這個技能了，無法刪除，請改成「停用」` }, 409);
    }
    const { rowCount } = await db.pool.query('DELETE FROM reward_options WHERE id = $1', [id]);
    if (!rowCount) return json({ error: 'not found' }, 404);
    return json({ id, deleted: true });
  }

  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (typeof body.label === 'string') { sets.push(`label = $${i}`); values.push(body.label.trim()); i += 1; }
  if (typeof body.desc === 'string') { sets.push(`description = $${i}`); values.push(body.desc.trim()); i += 1; }
  if ('minLevel' in body) {
    const minLevel = Number(body.minLevel);
    if (!Number.isInteger(minLevel) || minLevel < 2) return json({ error: 'minLevel 至少要是 2' }, 400);
    sets.push(`min_level = $${i}`); values.push(minLevel); i += 1;
  }
  if ('maxLevel' in body) {
    const maxLevel = body.maxLevel === null ? null : Number(body.maxLevel);
    if (maxLevel !== null && !Number.isInteger(maxLevel)) return json({ error: 'maxLevel 必須是整數或 null' }, 400);
    sets.push(`max_level = $${i}`); values.push(maxLevel); i += 1;
  }
  if (typeof body.active === 'boolean') { sets.push(`active = $${i}`); values.push(body.active); i += 1; }
  if (Number.isInteger(body.sortOrder)) { sets.push(`sort_order = $${i}`); values.push(body.sortOrder); i += 1; }

  if (sets.length === 0) return json({ error: 'no fields to update' }, 400);

  values.push(id);
  await db.pool.query(`UPDATE reward_options SET ${sets.join(', ')} WHERE id = $${i}`, values);

  const [updated] = (await db.sql`SELECT * FROM reward_options WHERE id = ${id}`) as RewardOptionRow[];
  if (!updated) return json({ error: 'not found' }, 404);
  return json(toJson(updated));
};

export const config: Config = {
  path: '/api/admin/reward-options/:id',
};
