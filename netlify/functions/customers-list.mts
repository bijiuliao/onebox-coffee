import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { requireAdmin } from './lib/auth';

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
  const rewardRows = (await db.sql`
    SELECT id, customer_email, level, reward_key, chosen_at, redeemed_at FROM member_rewards ORDER BY customer_email, level
  `) as { id: number; customer_email: string; level: number; reward_key: string; chosen_at: string; redeemed_at: string | null }[];
  const rewardsByEmail = new Map<string, { id: number; level: number; rewardKey: string; chosenAt: string; redeemedAt: string | null }[]>();
  for (const r of rewardRows) {
    const list = rewardsByEmail.get(r.customer_email) ?? [];
    list.push({ id: r.id, level: r.level, rewardKey: r.reward_key, chosenAt: r.chosen_at, redeemedAt: r.redeemed_at });
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
