import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { listRewardOptions, type RewardOptionRow } from './lib/memberRewards';

function toJson(r: RewardOptionRow) {
  return {
    id: r.id, key: r.reward_key, label: r.label, desc: r.description,
    minLevel: r.min_level, maxLevel: r.max_level, active: r.active, sortOrder: r.sort_order,
  };
}

// Admin management for the level-up reward catalog (reward_options table) -
// GET lists everything (including retired ones, so the admin can see and
// reactivate them); POST adds a new one. Editing/retiring/deleting an
// existing row is admin-reward-options-item.mts (/:id).
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const db = getDb();

  if (req.method === 'GET') {
    const options = await listRewardOptions(db);
    return json(options.map(toJson));
  }

  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const desc = typeof body.desc === 'string' ? body.desc.trim() : '';
  const minLevel = Number.isInteger(body.minLevel) ? (body.minLevel as number) : 2;
  const maxLevel = body.maxLevel === null || body.maxLevel === undefined ? null : Number(body.maxLevel);

  if (!/^[a-z0-9_]+$/.test(key)) return json({ error: 'key 只能用小寫英數字和底線' }, 400);
  if (!label) return json({ error: 'label is required' }, 400);
  if (minLevel < 2) return json({ error: 'minLevel 至少要是 2（Lv.1 不會提供技能選擇）' }, 400);
  if (maxLevel !== null && (!Number.isInteger(maxLevel) || maxLevel < minLevel)) {
    return json({ error: 'maxLevel 必須是整數，且不能小於 minLevel' }, 400);
  }

  try {
    const [created] = (await db.sql`
      INSERT INTO reward_options (reward_key, label, description, min_level, max_level, sort_order)
      VALUES (${key}, ${label}, ${desc}, ${minLevel}, ${maxLevel}, COALESCE((SELECT MAX(sort_order) + 1 FROM reward_options), 0))
      RETURNING *
    `) as RewardOptionRow[];
    return json(toJson(created), 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('reward_options_reward_key_key')) {
      return json({ error: `key「${key}」已經被用過了` }, 409);
    }
    throw err;
  }
};

export const config: Config = {
  path: '/api/admin/reward-options',
};
