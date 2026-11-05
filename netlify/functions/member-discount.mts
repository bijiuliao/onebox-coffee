import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// Public, read-only list of every unredeemed discount-type reward this
// email can still use - lets the cart show the customer their actual
// coupon names and let them pick which one to use (or none), instead of
// orders.mts silently always picking the highest %. Never mutates
// anything - redemption only ever happens inside the checkout transaction
// itself (see orders.mts), so this can be called as often as the cart
// re-renders without side effects.
export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const db = getDb();
  const rows = (await db.sql`
    SELECT mr.id, ro.label, ro.discount_percent
    FROM member_rewards mr
    JOIN reward_options ro ON ro.reward_key = mr.reward_key
    WHERE mr.customer_email = ${email} AND mr.redeemed_at IS NULL AND ro.discount_percent IS NOT NULL
    ORDER BY ro.discount_percent DESC, mr.chosen_at ASC
  `) as { id: number; label: string; discount_percent: number }[];

  return json({ rewards: rows.map(r => ({ id: r.id, label: r.label, discountPercent: r.discount_percent })) });
};

export const config: Config = {
  path: '/api/member-discount',
};
