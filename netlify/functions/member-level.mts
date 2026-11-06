import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { listRewardOptions, appliesToLevel } from './lib/memberRewards';
import { levelProgress } from './lib/memberLevelFormula';
import { tierWeightsForLevel, type MysteryTier } from './lib/mysteryDraw';

interface RewardRow {
  id: number;
  level: number;
  reward_key: string;
  chosen_at: string;
  redeemed_at: string | null;
  mystery_coffee_id: string | null;
  mystery_tier: MysteryTier | null;
  mystery_drawn_at: string | null;
  mystery_coffee_name: string | null;
  mystery_merged: boolean;
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
  const { level, toNextLevel } = levelProgress(beansSpent);

  const allOptions = await listRewardOptions(db);
  const optionsByKey = new Map(allOptions.map(o => [o.reward_key, o]));
  const activeOptions = allOptions.filter(o => o.active);

  const rewardRows = (await db.sql`
    SELECT mr.id, mr.level, mr.reward_key, mr.chosen_at, mr.redeemed_at,
           mr.mystery_coffee_id, mr.mystery_tier, mr.mystery_drawn_at, mr.mystery_merged, c.name AS mystery_coffee_name
    FROM member_rewards mr
    LEFT JOIN coffees c ON c.id = mr.mystery_coffee_id
    WHERE mr.customer_email = ${email}
    ORDER BY mr.level ASC
  `) as RewardRow[];

  const rewards = rewardRows.map(r => {
    const option = optionsByKey.get(r.reward_key);
    return {
      id: r.id, level: r.level, rewardKey: r.reward_key,
      rewardLabel: option?.label ?? r.reward_key, rewardDesc: option?.description ?? '',
      chosenAt: r.chosen_at, redeemedAt: r.redeemed_at,
      // Lets the client explain *how* an unredeemed reward gets redeemed -
      // a discount-percent reward needs no action from the customer (it
      // auto-applies on their next beans checkout); a mystery-pool reward
      // needs the customer to spin the wheel once (see mysteryCoffeeName
      // below); every other reward is still handed out by admin in person.
      isDiscount: option?.discount_percent != null,
      isMysteryPool: option?.is_mystery_pool === true,
      mysteryTier: r.mystery_tier,
      mysteryCoffeeName: r.mystery_coffee_name,
      mysteryDrawnAt: r.mystery_drawn_at,
      // True once this row was consumed as crafting material rather than
      // ever being shipped (see member-level-mystery-craft.mts) - lets the
      // client show "merged into a craft" instead of implying it was
      // handed out.
      isMysteryMerged: r.mystery_merged,
    };
  });
  const chosenLevels = new Set(rewards.map(r => r.level));

  // The lowest level (above 1) the customer has reached but hasn't picked
  // a reward for yet - only one offered at a time, even if a big order
  // jumped several levels at once. A level with no active reward in its
  // range (an odd admin config, or everything retired) is skipped rather
  // than leaving the customer stuck on a level that has nothing to offer.
  let unclaimedLevel: number | null = null;
  for (let lv = 2; lv <= level; lv++) {
    if (chosenLevels.has(lv)) continue;
    if (activeOptions.some(o => appliesToLevel(o, lv))) { unclaimedLevel = lv; break; }
  }

  const availableRewards = unclaimedLevel !== null
    ? activeOptions.filter(o => appliesToLevel(o, unclaimedLevel!)).map(o => ({
      key: o.reward_key, label: o.label, desc: o.description,
      isDiscount: o.discount_percent != null, isMysteryPool: o.is_mystery_pool,
    }))
    : [];

  // Shown alongside an undrawn mystery-pool reward so the wheel's segments
  // can be sized to the customer's actual odds at their current level (see
  // lib/mysteryDraw.ts) - harmless to always include even when nothing in
  // their history needs it.
  const mysteryWeights = tierWeightsForLevel(level);

  return json({ beansSpent, level, toNextLevel, rewards, unclaimedLevel, availableRewards, mysteryWeights });
};

export const config: Config = {
  path: '/api/member-level',
};
