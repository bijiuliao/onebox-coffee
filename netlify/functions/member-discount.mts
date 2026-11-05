import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// Public, read-only preview of the discount a customer would get on their
// next beans checkout - lets the cart show it *before* they place the
// order, instead of it only showing up after the fact. Picks the same
// "best unredeemed discount reward" orders.mts actually applies at
// checkout (see its discountCandidate query), but never mutates anything -
// redemption only ever happens inside the checkout transaction itself, so
// this can be called as often as the cart re-renders without side effects.
export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const db = getDb();
  const [candidate] = (await db.sql`
    SELECT ro.discount_percent
    FROM member_rewards mr
    JOIN reward_options ro ON ro.reward_key = mr.reward_key
    WHERE mr.customer_email = ${email} AND mr.redeemed_at IS NULL AND ro.discount_percent IS NOT NULL
    ORDER BY ro.discount_percent DESC
    LIMIT 1
  `) as { discount_percent: number }[];

  return json({ discountPercent: candidate?.discount_percent ?? null });
};

export const config: Config = {
  path: '/api/member-discount',
};
