export type MysteryTier = 'daily' | 'rare' | 'competition' | 'rare_competition';

// Common -> rarest. Used both for weighting/fallback and for crafting's
// "one tier up" direction (see nextTier).
export const MYSTERY_TIER_ORDER: MysteryTier[] = ['daily', 'rare', 'competition', 'rare_competition'];

export interface TierWeights {
  daily: number;
  rare: number;
  competition: number;
  rareCompetition: number;
}

// How likely each tier is to come up, as a percentage of the wheel, for a
// customer at this member level - gets harder to land daily/easier to land
// the rarer tiers the higher the level, with no configuration needed
// beyond the pool assignments themselves (see AdminPage.tsx's mystery-pool
// pills). Competition/rare_competition start deliberately low at the
// earliest levels (2%/1% at Lv.2) rather than being front-loaded, so the
// top tiers stay something a customer grows into rather than something a
// brand new Lv.2 customer can luck into on their first spin. Capped so
// odds never go to 0% or saturate the whole wheel: rare_competition tops
// out at 15%, competition at 25%, rare at 40%, so daily never drops below
// 20%. Rounded to whole percents (daily absorbs the rounding remainder) so
// the four numbers always sum to exactly 100.
export function tierWeightsForLevel(level: number): TierWeights {
  const steps = Math.max(0, level - 2);
  const rareCompetition = Math.round(Math.min(1 + steps * 1, 15));
  const competition = Math.round(Math.min(2 + steps * 1.5, 25));
  const rare = Math.round(Math.min(15 + steps * 3, 40));
  const daily = 100 - rareCompetition - competition - rare;
  return { daily, rare, competition, rareCompetition };
}

// rand is injectable only for tests - production always uses Math.random.
export function pickTier(weights: TierWeights, rand: () => number = Math.random): MysteryTier {
  const roll = rand() * 100;
  if (roll < weights.rareCompetition) return 'rare_competition';
  if (roll < weights.rareCompetition + weights.competition) return 'competition';
  if (roll < weights.rareCompetition + weights.competition + weights.rare) return 'rare';
  return 'daily';
}

// Tiers to try a coffee pool lookup against, in order, when the rolled (or
// crafted-for) tier's own pool might be empty - steps down toward the more
// common end first (a thin pool is far more likely to be missing a rare
// tier than its daily one), then back up past the original tier as a last
// resort.
export function poolFallbackOrder(tier: MysteryTier): MysteryTier[] {
  const idx = MYSTERY_TIER_ORDER.indexOf(tier);
  const order = [tier];
  for (let i = idx - 1; i >= 0; i--) order.push(MYSTERY_TIER_ORDER[i]);
  for (let i = idx + 1; i < MYSTERY_TIER_ORDER.length; i++) order.push(MYSTERY_TIER_ORDER[i]);
  return order;
}

// The tier one step rarer, or null if already at the top (rare_competition
// has nothing above it to craft into - see member-level-mystery-craft.mts).
export function nextTier(tier: MysteryTier): MysteryTier | null {
  const idx = MYSTERY_TIER_ORDER.indexOf(tier);
  return idx >= 0 && idx < MYSTERY_TIER_ORDER.length - 1 ? MYSTERY_TIER_ORDER[idx + 1] : null;
}

// Combining 3 same-tier mystery beans has a flat chance of upgrading to
// the next tier, regardless of which tier - easy to reason about ("always
// 50/50") rather than a second hidden rarity curve layered on top of the
// draw odds above. On failure, one random same-tier bean is kept (see
// member-level-mystery-craft.mts); the other two are consumed either way.
export const CRAFT_SUCCESS_CHANCE = 0.5;

// Minimal shape of a pg PoolClient (or the transaction client orders.mts /
// the mystery endpoints already use) - kept local and structural rather
// than importing a `pg` type, since only .query is ever needed here.
export interface QueryClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

// Picks one random active coffee from the given tier's pool, falling back
// toward more common tiers if it's empty (see poolFallbackOrder) - shared
// by both the wheel draw and crafting's "miss" outcome, so both degrade
// the same way when a pool is thin. null means no coffee exists in *any*
// tier, which both callers treat as "admin hasn't set up the mystery pool
// at all yet".
export async function pickCoffeeFromPool(client: QueryClient, tier: MysteryTier): Promise<{ id: string; name: string; tier: MysteryTier } | null> {
  for (const t of poolFallbackOrder(tier)) {
    const { rows } = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM coffees WHERE mystery_tier = $1 AND archived = false ORDER BY random() LIMIT 1',
      [t],
    );
    if (rows[0]) return { ...rows[0], tier: t };
  }
  return null;
}

// Picks a coffee from the given tier's pool, falling back only to rarer
// tiers above it - never down to tier itself or anything more common.
// Crafting's success outcome has to use this (not pickCoffeeFromPool): a
// "success" that quietly fell back to the same tier the material came
// from wouldn't be an upgrade at all, which would make the whole craft
// pointless even though the roll said it won.
export async function pickCoffeeAtOrAboveTier(client: QueryClient, tier: MysteryTier): Promise<{ id: string; name: string; tier: MysteryTier } | null> {
  const idx = MYSTERY_TIER_ORDER.indexOf(tier);
  for (let i = idx; i < MYSTERY_TIER_ORDER.length; i++) {
    const t = MYSTERY_TIER_ORDER[i];
    const { rows } = await client.query<{ id: string; name: string }>(
      'SELECT id, name FROM coffees WHERE mystery_tier = $1 AND archived = false ORDER BY random() LIMIT 1',
      [t],
    );
    if (rows[0]) return { ...rows[0], tier: t };
  }
  return null;
}
