import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// $500 of cumulative beans spend per level, no cap - mirrors
// client/src/memberLevel.ts (trivial one-line arithmetic, not worth
// sharing a module over two separate module graphs for).
const LEVEL_STEP = 500;

// Public lookup so a customer can check their own level with just their
// email - no accounts exist, same "email as the only identifier" pattern
// as the leaderboard and the order-lookup page. An email with no orders at
// all is a legitimate Lv.1/$0 answer, not a 404 - everyone starts there.
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

  return json({ beansSpent, level, toNextLevel });
};

export const config: Config = {
  path: '/api/member-level',
};
