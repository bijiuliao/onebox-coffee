import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';

// Lets the customer lock in, right after a mystery-pool draw (or any time
// before it's shipped or merged into a craft), whether this specific
// drawn bean is a keeper or material for crafting - this is what lets
// admin's packing queue (PackingView) tell "really waiting to ship" apart
// from "might get combined into something else soon" instead of treating
// every drawn-but-unshipped row the same way. Switchable back and forth
// freely up until it's actually shipped or merged, since nothing is
// consumed just by setting this flag.
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const rewardId = Number(body.rewardId);
  const decision = body.decision;
  if (!email) return json({ error: 'email is required' }, 400);
  if (!Number.isInteger(rewardId)) return json({ error: 'invalid rewardId' }, 400);
  if (decision !== 'keep' && decision !== 'craft') return json({ error: 'invalid decision' }, 400);

  const db = getDb();
  const rows = (await db.sql`
    UPDATE member_rewards SET mystery_decision = ${decision}
    WHERE id = ${rewardId} AND customer_email = ${email}
      AND mystery_coffee_id IS NOT NULL AND redeemed_at IS NULL
    RETURNING id
  `) as { id: number }[];
  if (rows.length === 0) return json({ error: '找不到這個神秘豆，或已經出貨/合成了，不能再更改' }, 404);

  return json({ ok: true, rewardId, decision });
};

export const config: Config = {
  path: '/api/member-level/mystery-decide',
};
