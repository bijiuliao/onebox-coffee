import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json, pathSegments } from './lib/coffees';
import { requireAdmin } from './lib/auth';
import { smallestBagGrams } from './lib/weight';

// Admin marks a chosen "skill" as redeemed once they've actually handed it
// out (applied the discount, bagged the extra grams, handed over the
// mystery-pool bag) - this is the only write path for
// member_rewards.redeemed_at; nothing here, or anywhere else, applies the
// reward automatically. For a mystery-pool reward that's actually been
// drawn (mystery_coffee_id set), flipping redeemed on/off also
// deducts/restores that coffee's tracked stock - a real bag is physically
// going out the door here, same as a retail sale, just not through
// checkout. Only fires on an actual true<->false transition so toggling
// the same value twice (or a double-click) never double-deducts.
export default async (req: Request) => {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  if (req.method !== 'PATCH') return json({ error: 'method not allowed' }, 405);

  const id = Number(pathSegments(req)[3]);
  if (!Number.isInteger(id)) return json({ error: 'invalid id' }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  if (typeof body.redeemed !== 'boolean') return json({ error: 'redeemed must be a boolean' }, 400);
  const wantsRedeemed = body.redeemed;

  const db = getDb();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: rewardRows } = await client.query<{ id: number; redeemed_at: string | null; mystery_coffee_id: string | null }>(
      'SELECT id, redeemed_at, mystery_coffee_id FROM member_rewards WHERE id = $1 FOR UPDATE',
      [id],
    );
    const reward = rewardRows[0];
    if (!reward) {
      await client.query('ROLLBACK');
      return json({ error: 'not found' }, 404);
    }

    const wasRedeemed = reward.redeemed_at !== null;
    if (reward.mystery_coffee_id && wasRedeemed !== wantsRedeemed) {
      const { rows: coffeeRows } = await client.query<{ bag_options: unknown; stock_qty: number | null }>(
        'SELECT bag_options, stock_qty FROM coffees WHERE id = $1 FOR UPDATE',
        [reward.mystery_coffee_id],
      );
      const coffee = coffeeRows[0];
      if (coffee && coffee.stock_qty !== null) {
        const bagOptions = (typeof coffee.bag_options === 'string' ? JSON.parse(coffee.bag_options) : coffee.bag_options) as { label: string }[];
        const grams = smallestBagGrams(bagOptions);
        if (grams !== null) {
          if (wantsRedeemed) {
            // Floored at 0 rather than blocking the ship-out or going
            // negative - the wheel already committed to this coffee before
            // admin gets here, so the choice is "ship it and let stock
            // read 0" vs. "never let this draw be marked shipped," and the
            // former is the one that doesn't strand a customer's prize.
            await client.query('UPDATE coffees SET stock_qty = GREATEST(stock_qty - $1, 0) WHERE id = $2', [grams, reward.mystery_coffee_id]);
          } else {
            await client.query('UPDATE coffees SET stock_qty = stock_qty + $1 WHERE id = $2', [grams, reward.mystery_coffee_id]);
          }
        }
      }
    }

    const { rows: updated } = await client.query<{ id: number; redeemed_at: string | null }>(
      'UPDATE member_rewards SET redeemed_at = $1 WHERE id = $2 RETURNING id, redeemed_at',
      [wantsRedeemed ? new Date().toISOString() : null, id],
    );
    await client.query('COMMIT');
    return json({ id: updated[0].id, redeemedAt: updated[0].redeemed_at });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const config: Config = {
  path: '/api/admin/member-rewards/:id',
};
