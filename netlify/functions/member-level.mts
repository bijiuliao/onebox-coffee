import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// $500 of cumulative beans spend per level, no cap - mirrors
// client/src/memberLevel.ts (trivial one-line arithmetic, not worth
// sharing a module over two separate module graphs for).
const LEVEL_STEP = 500;

interface RewardRow {
  id: number;
  level: number;
  reward_key: string;
  chosen_at: string;
  redeemed_at: string | null;
}

// Public lookup so a customer can check their own level with just their
// email - no accounts exist, same "email as the only identifier" pattern
// as the leaderboard and the order-lookup page. An email with no orders at
// all is a legitimate Lv.1/$0 answer, not a 404 - everyone starts there.
// Also reports which level-up(s) still need a reward "skill" picked (see
// member-level-claim.mts) - Lv.1 itself never offers one, since everyone
// starts there with $0 spent and nothing purchased yet.
export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const db = getDb();
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

  const beansSpent = row?.beans_spent ?? 0;
  const level = Math.floor(beansSpent / LEVEL_STEP) + 1;
  const toNextLevel = level * LEVEL_STEP - beansSpent;

  const rewardRows = (await db.sql`
    SELECT id, level, reward_key, chosen_at, redeemed_at FROM member_rewards
    WHERE customer_email = ${email}
    ORDER BY level ASC
  `) as RewardRow[];

  const rewards = rewardRows.map(r => ({
    id: r.id, level: r.level, rewardKey: r.reward_key, chosenAt: r.chosen_at, redeemedAt: r.redeemed_at,
  }));
  const chosenLevels = new Set(rewards.map(r => r.level));
  // The lowest level (above 1) the customer has reached but hasn't picked
  // a reward for yet - only one offered at a time, even if a big order
  // jumped several levels at once.
  let unclaimedLevel: number | null = null;
  for (let lv = 2; lv <= level; lv++) {
    if (!chosenLevels.has(lv)) { unclaimedLevel = lv; break; }
  }

  return json({ beansSpent, level, toNextLevel, rewards, unclaimedLevel });
};

export const config: Config = {
  path: '/api/member-level',
};
