import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { listRewardOptions } from './lib/memberRewards';
import type { MysteryTier } from './lib/mysteryDraw';

// A "customer" here is just an aggregate over orders sharing the same email
// - there's no separate customers table or customer accounts, so this is a
// read-only report, not an editable record. customer_name can vary between
// orders (a typed nickname, not a fixed profile field), so this always
// shows whichever name was used on that customer's most recent order.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const rows = (await db.sql`
    SELECT
      customer_email,
      (ARRAY_AGG(customer_name ORDER BY created_at DESC))[1] AS latest_name,
      COUNT(*)::int AS order_count,
      SUM(total)::int AS total_spent,
      COALESCE(SUM(beans.beans_total), 0)::int AS beans_spent,
      MAX(created_at) AS last_order_at
    FROM orders o,
    LATERAL (
      SELECT SUM((item->>'linePrice')::int) AS beans_total
      FROM jsonb_array_elements(o.items) AS item
      WHERE item->>'kind' = 'beans'
    ) beans
    WHERE customer_email != ''
    GROUP BY customer_email
    ORDER BY last_order_at DESC
    LIMIT 500
  `) as {
    customer_email: string; latest_name: string; order_count: number;
    total_spent: number; beans_spent: number; last_order_at: string;
  }[];

  // Separate query rather than joining into the orders aggregate above -
  // member_rewards is already one row per (email, level), so grouping it in
  // here would multiply the orders rows instead of just adding a column.
  // LEFT JOIN coffees resolves a drawn mystery-pool reward's coffee name,
  // same as member-level.mts does for the customer's own view of it.
  const rewardRows = (await db.sql`
    SELECT mr.id, mr.customer_email, mr.level, mr.reward_key, mr.chosen_at, mr.redeemed_at,
           mr.mystery_coffee_id, mr.mystery_tier, mr.mystery_drawn_at, mr.mystery_merged, c.name AS mystery_coffee_name
    FROM member_rewards mr
    LEFT JOIN coffees c ON c.id = mr.mystery_coffee_id
    ORDER BY mr.customer_email, mr.level
  `) as {
    id: number; customer_email: string; level: number; reward_key: string; chosen_at: string; redeemed_at: string | null;
    mystery_coffee_id: string | null; mystery_tier: MysteryTier | null; mystery_drawn_at: string | null; mystery_merged: boolean; mystery_coffee_name: string | null;
  }[];
  const optionsByKey = new Map((await listRewardOptions(db)).map(o => [o.reward_key, o]));
  const rewardsByEmail = new Map<string, {
    id: number; level: number; rewardKey: string; rewardLabel: string; redeemedAt: string | null; isDiscount: boolean;
    isMysteryPool: boolean; mysteryTier: MysteryTier | null; mysteryCoffeeName: string | null; mysteryDrawnAt: string | null; isMysteryMerged: boolean;
  }[]>();
  for (const r of rewardRows) {
    const list = rewardsByEmail.get(r.customer_email) ?? [];
    const option = optionsByKey.get(r.reward_key);
    list.push({
      id: r.id, level: r.level, rewardKey: r.reward_key, rewardLabel: option?.label ?? r.reward_key, redeemedAt: r.redeemed_at,
      isDiscount: option?.discount_percent != null, isMysteryPool: option?.is_mystery_pool === true,
      mysteryTier: r.mystery_tier, mysteryCoffeeName: r.mystery_coffee_name, mysteryDrawnAt: r.mystery_drawn_at, isMysteryMerged: r.mystery_merged,
    });
    rewardsByEmail.set(r.customer_email, list);
  }

  const customers = rows.map(r => ({
    email: r.customer_email,
    name: r.latest_name,
    orderCount: r.order_count,
    totalSpent: r.total_spent,
    beansSpent: r.beans_spent,
    lastOrderAt: r.last_order_at,
    rewards: rewardsByEmail.get(r.customer_email) ?? [],
  }));
  return json(customers);
};

export const config: Config = {
  path: '/api/customers',
};
