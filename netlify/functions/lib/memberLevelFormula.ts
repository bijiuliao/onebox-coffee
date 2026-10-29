// Each level-up requires more than the last: the spend needed to go from
// level N to N+1 is LEVEL_BASE_STEP * LEVEL_GROWTH_RATE^(N-1), so level 1→2
// is $500, 2→3 is $600, 3→4 is $720, and so on, growing ~20% a level with
// no cap. Mirrors client/src/memberLevel.ts (separate module graph, can't
// share directly) - keep both in sync. Shared between member-level.mts and
// member-level-claim.mts since those ARE in the same module graph.
const LEVEL_BASE_STEP = 500;
const LEVEL_GROWTH_RATE = 1.2;

function stepForLevel(level: number): number {
  return Math.round(LEVEL_BASE_STEP * Math.pow(LEVEL_GROWTH_RATE, level - 1));
}

export function levelProgress(beansSpent: number): { level: number; toNextLevel: number } {
  let level = 1;
  let remaining = Math.max(0, beansSpent);
  while (remaining >= stepForLevel(level)) {
    remaining -= stepForLevel(level);
    level += 1;
  }
  return { level, toNextLevel: stepForLevel(level) - remaining };
}
