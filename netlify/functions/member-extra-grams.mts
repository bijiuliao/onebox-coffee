import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// Public, read-only list of every unredeemed extra-grams-type reward this
// email can still use - lets the cart show the customer which "多送克數"
// skill(s) they have and (together with /api/coffees' stock figures) let
// them pick which beans line in their own cart the bonus should land on.
// Never mutates anything - redemption only ever happens inside the
// checkout transaction itself (see orders.mts).
export default async (req: Request) => {
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, 405);

  const email = (new URL(req.url).searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);

  const db = getDb();
  const rows = (await db.sql`
    SELECT mr.id, ro.label, ro.extra_grams_amount
    FROM member_rewards mr
    JOIN reward_options ro ON ro.reward_key = mr.reward_key
    WHERE mr.customer_email = ${email} AND mr.redeemed_at IS NULL AND ro.extra_grams_amount IS NOT NULL
    ORDER BY mr.chosen_at ASC
  `) as { id: number; label: string; extra_grams_amount: number }[];

  return json({ rewards: rows.map(r => ({ id: r.id, label: r.label, grams: r.extra_grams_amount })) });
};

export const config: Config = {
  path: '/api/member-extra-grams',
};
