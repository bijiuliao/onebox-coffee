import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { levelProgress } from './lib/memberLevelFormula';
import { tierWeightsForLevel, pickTier, pickCoffeeFromPool } from './lib/mysteryDraw';

// Spins the mystery-pool wheel for a claimed reward - public/email-
// identified like the rest of the member-level endpoints, but locked down
// by re-validating everything server-side rather than trusting the
// client: the reward must actually belong to this email, actually be a
// mystery-pool reward (see reward_options.is_mystery_pool), and not
// already have a draw recorded. Runs inside a transaction with the reward
// row locked (FOR UPDATE), so two taps/tabs racing to spin the same wheel
// can't both get a result - only the first one in wins, the second sees
// mystery_coffee_id already set and is rejected.
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rewardId = Number(body.rewardId);
  if (!email) return json({ error: 'email is required' }, 400);
  if (!Number.isInteger(rewardId)) return json({ error: 'invalid rewardId' }, 400);

  const db = getDb();

  // Re-derives the customer's actual level from their order history rather
  // than trusting anything client-sent - the odds this draw uses have to
  // match what they've genuinely earned.
  const [spendRow] = (await db.sql`
    SELECT COALESCE(SUM(beans.beans_total), 0)::int AS beans_spent
    FROM orders o,
    LATERAL (
      SELECT SUM((item->>'linePrice')::int) AS beans_total
      FROM jsonb_array_elements(o.items) AS item
      WHERE item->>'kind' = 'beans'
    ) beans
    WHERE customer_email = ${email}
  `) as { beans_spent: number }[];
  const { level } = levelProgress(spendRow?.beans_spent ?? 0);
  const weights = tierWeightsForLevel(level);

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rewardRows } = await client.query<{ id: number; mystery_coffee_id: string | null; is_mystery_pool: boolean }>(
      `SELECT mr.id, mr.mystery_coffee_id, ro.is_mystery_pool
       FROM member_rewards mr
       JOIN reward_options ro ON ro.reward_key = mr.reward_key
       WHERE mr.id = $1 AND mr.customer_email = $2
       FOR UPDATE OF mr`,
      [rewardId, email],
    );
    const reward = rewardRows[0];
    if (!reward || !reward.is_mystery_pool) {
      await client.query('ROLLBACK');
      return json({ error: '找不到這個神秘豆技能' }, 404);
    }
    if (reward.mystery_coffee_id !== null) {
      await client.query('ROLLBACK');
      return json({ error: '這個神秘豆已經抽過了' }, 409);
    }

    const rolledTier = pickTier(weights);
    const picked = await pickCoffeeFromPool(client, rolledTier);

    if (!picked) {
      await client.query('ROLLBACK');
      return json({ error: '神秘豆池還沒有設定豆子，請聯絡店長' }, 409);
    }

    await client.query(
      'UPDATE member_rewards SET mystery_coffee_id = $1, mystery_tier = $2, mystery_drawn_at = now() WHERE id = $3',
      [picked.id, picked.tier, rewardId],
    );
    await client.query('COMMIT');

    return json({ tier: picked.tier, coffeeId: picked.id, coffeeName: picked.name });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const config: Config = {
  path: '/api/member-level/mystery-draw',
};
