import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// Public leaderboard - no requireAdmin, since this is meant for customers
// (friends in a group-buy) to see, not just the shop owner. Names are
// masked server-side (never send the real name to the client at all) and
// email is left out entirely - only a name, order count and total spent
// are exposed, capped to the top 20 so this never becomes a full customer
// directory.
function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed || '匿名';
  return trimmed[0] + '*'.repeat(trimmed.length - 1);
}

export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const db = getDb();
  const rows = (await db.sql`
    SELECT
      (ARRAY_AGG(customer_name ORDER BY created_at DESC))[1] AS latest_name,
      COUNT(*)::int AS order_count,
      SUM(total)::int AS total_spent
    FROM orders
    WHERE customer_email != ''
    GROUP BY customer_email
    ORDER BY total_spent DESC
    LIMIT 20
  `) as { latest_name: string; order_count: number; total_spent: number }[];

  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    name: maskName(r.latest_name),
    orderCount: r.order_count,
    totalSpent: r.total_spent,
  }));
  return json(leaderboard);
};

export const config: Config = {
  path: '/api/leaderboard',
};
