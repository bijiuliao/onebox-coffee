import type { Config } from '@netlify/functions';
import { getDb } from './lib/db';
import { json } from './lib/coffees';
import { nextTier, pickCoffeeFromPool, pickCoffeeAtOrAboveTier, CRAFT_SUCCESS_CHANCE, MYSTERY_TIER_ORDER, type MysteryTier } from './lib/mysteryDraw';

function isMysteryTier(v: unknown): v is MysteryTier {
  return typeof v === 'string' && (MYSTERY_TIER_ORDER as string[]).includes(v);
}

// Combines 3 of a customer's own same-tier, still-undelivered mystery-pool
// draws into 1 - a flat 50/50 shot at the next tier up (see
// lib/mysteryDraw.ts), re-rolled within the same tier on a miss. Only ever
// touches drawn-but-unredeemed rows (mystery_coffee_id set, redeemed_at
// still null) - once admin has marked one shipped it's a real bag already
// handed over and can't be fed back in. The 3 oldest-drawn rows of that
// tier are locked (FOR UPDATE) and consumed: one survives with its
// coffee/tier re-rolled to the outcome, the other two are marked
// mystery_merged + redeemed_at so they stop counting as pending anywhere
// (PackingView, future crafts) without ever triggering the
// ship-time stock deduction those two beans were never actually handed
// out for. member_rewards rows are never deleted, so a customer's
// level-up claim history (and the one-reward-per-level guarantee) stays
// intact no matter how many times they craft.
export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const tier = body.tier;
  if (!email) return json({ error: 'email is required' }, 400);
  if (!isMysteryTier(tier)) return json({ error: 'invalid tier' }, 400);

  const target = nextTier(tier);
  if (!target) return json({ error: '已經是最高等級，沒有更高的等級可以合成' }, 400);

  const db = getDb();
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: materialRows } = await client.query<{ id: number }>(
      `SELECT id FROM member_rewards
       WHERE customer_email = $1 AND mystery_tier = $2 AND mystery_coffee_id IS NOT NULL AND redeemed_at IS NULL
       ORDER BY mystery_drawn_at ASC
       LIMIT 3
       FOR UPDATE`,
      [email, tier],
    );
    if (materialRows.length < 3) {
      await client.query('ROLLBACK');
      return json({ error: `材料不足，需要 3 支同等級的神秘豆才能合成（目前只有 ${materialRows.length} 支）` }, 409);
    }

    // Checked up front, before consuming anything, so both outcomes have
    // to be genuinely possible before any of the 3 beans are spent. The
    // success pick is deliberately restricted to target-or-rarer (never
    // falling back down to tier or below) - see pickCoffeeAtOrAboveTier -
    // so a "success" can never quietly resolve to a non-upgrade.
    const successPick = await pickCoffeeAtOrAboveTier(client, target);
    const failPick = await pickCoffeeFromPool(client, tier);
    if (!successPick || !failPick) {
      await client.query('ROLLBACK');
      return json({ error: '神秘豆池還沒有設定夠多豆子，請聯絡店長' }, 409);
    }

    const success = Math.random() < CRAFT_SUCCESS_CHANCE;
    const picked = success ? successPick : failPick;

    const [survivorId, ...consumedIds] = materialRows.map((r: { id: number }) => r.id);
    await client.query(
      'UPDATE member_rewards SET mystery_coffee_id = $1, mystery_tier = $2, mystery_drawn_at = now() WHERE id = $3',
      [picked.id, picked.tier, survivorId],
    );
    await client.query(
      'UPDATE member_rewards SET mystery_merged = true, redeemed_at = now() WHERE id = ANY($1::int[])',
      [consumedIds],
    );

    await client.query('COMMIT');
    return json({ success, tier: picked.tier, coffeeId: picked.id, coffeeName: picked.name });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

export const config: Config = {
  path: '/api/member-level/mystery-craft',
};
