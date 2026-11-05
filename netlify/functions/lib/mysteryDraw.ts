export type MysteryTier = 'daily' | 'rare' | 'competition';

export interface TierWeights {
  daily: number;
  rare: number;
  competition: number;
}

// How likely each tier is to come up, as a percentage of the wheel, for a
// customer at this member level - gets harder to land daily/easier to land
// rare+competition the higher the level, with no configuration needed
// beyond the pool assignments themselves (see AdminPage.tsx's mystery-pool
// pills). Capped so odds never go to 0% or saturate the whole wheel:
// competition tops out at 30%, rare at 40%, so daily never drops below 30%.
export function tierWeightsForLevel(level: number): TierWeights {
  const steps = Math.max(0, level - 2);
  const competition = Math.min(5 + steps * 2, 30);
  const rare = Math.min(15 + steps * 3, 40);
  const daily = 100 - competition - rare;
  return { daily, rare, competition };
}

// rand is injectable only for tests - production always uses Math.random.
export function pickTier(weights: TierWeights, rand: () => number = Math.random): MysteryTier {
  const roll = rand() * 100;
  if (roll < weights.competition) return 'competition';
  if (roll < weights.competition + weights.rare) return 'rare';
  return 'daily';
}
