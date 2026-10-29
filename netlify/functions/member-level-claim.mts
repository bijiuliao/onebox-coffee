import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { listRewardOptions, appliesToLevel } from './lib/memberRewards';
import { levelProgress } from './lib/memberLevelFormula';

// Lets a customer lock in which "skill" they picked for a level-up they've
// actually reached - no admin auth, same public/email-identified pattern
// as member-level.mts, but re-derives beansSpent itself rather than
// trusting a client-sent level, so someone can't claim a level they
// haven't paid for. UNIQUE(customer_email, level) in the DB is the real
// guard against claiming the same level twice (race-safe); this also
// checks first to give a clear error instead of a raw constraint failure.
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const level = Number(body.level);
  const rewardKey = typeof body.rewardKey === 'string' ? body.rewardKey : '';

  if (!email) return json({ error: 'email is required' }, 400);
  if (!Number.isInteger(level) || level < 2) return json({ error: 'invalid level' }, 400);
  if (!rewardKey) return json({ error: 'rewardKey is required' }, 400);

  const db = getDb();
  const options = await listRewardOptions(db);
  const option = options.find(o => o.reward_key === rewardKey && o.active);
  if (!option || !appliesToLevel(option, level)) return json({ error: 'invalid rewardKey' }, 400);

  const [row] = (await db.sql`
    SELECT COALESCE(SUM(beans.beans_total), 0)::int AS beans_spent
    FROM orders o,
    LATERAL (
      SELECT SUM((item->>'linePrice')::int) AS beans_total
      FROM jsonb_array_elements(o.items) AS item
      WHERE item->>'kind' = 'beans'
    ) beans
    WHERE customer_email = ${email}
  `) as { beans_spent: number }[];
  const { level: actualLevel } = levelProgress(row?.beans_spent ?? 0);
  if (level > actualLevel) return json({ error: '還沒有升到這個等級' }, 400);

  const [existing] = (await db.sql`SELECT id FROM member_rewards WHERE customer_email = ${email} AND level = ${level}`) as { id: number }[];
  if (existing) return json({ error: '這個等級的技能已經選過了' }, 409);

  await db.sql`INSERT INTO member_rewards (customer_email, level, reward_key) VALUES (${email}, ${level}, ${rewardKey})`;

  return json({ ok: true, level, rewardKey });
};

export const config: Config = {
  path: '/api/member-level/claim',
};
