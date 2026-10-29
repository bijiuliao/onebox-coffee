// Member level: based on cumulative BEANS spend (Customer.beansSpent, or
// the single-customer lookup from member-level.mts), no cap - level 1 is
// the baseline every customer starts at, even at $0 spent. Each level-up
// costs more than the last: going from level N to N+1 needs
// LEVEL_BASE_STEP * LEVEL_GROWTH_RATE^(N-1), so 1→2 is $500, 2→3 is $600,
// 3→4 is $720, growing ~20% a level with no cap. Mirrors
// netlify/functions/lib/memberLevelFormula.ts (separate module graph,
// can't share directly) - keep both in sync. Purely a display number,
// computed fresh from order history every time, not stored anywhere.
const LEVEL_BASE_STEP = 500;
const LEVEL_GROWTH_RATE = 1.2;

function stepForLevel(level: number): number {
  return Math.round(LEVEL_BASE_STEP * Math.pow(LEVEL_GROWTH_RATE, level - 1));
}

function levelProgress(beansSpent: number): { level: number; intoLevel: number } {
  let level = 1;
  let remaining = Math.max(0, beansSpent);
  while (remaining >= stepForLevel(level)) {
    remaining -= stepForLevel(level);
    level += 1;
  }
  return { level, intoLevel: remaining };
}

export function getMemberLevel(beansSpent: number): number {
  return levelProgress(beansSpent).level;
}

// How much more beans spend is needed to reach the next level.
export function spendToNextLevel(beansSpent: number): number {
  const { level, intoLevel } = levelProgress(beansSpent);
  return stepForLevel(level) - intoLevel;
}

// The full spend needed to go from the current level to the next one -
// for progress bars, which need the step size itself, not just the
// remainder (see spendToNextLevel).
export function currentLevelStep(beansSpent: number): number {
  return stepForLevel(levelProgress(beansSpent).level);
}
