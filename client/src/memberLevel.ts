// Member level: every $500 of cumulative BEANS spend (Customer.beansSpent,
// or the single-customer lookup from member-level.mts) is one level, no
// cap - level 1 is the baseline every customer starts at, even at $0
// spent. Simple on purpose: this is purely a display number, computed
// fresh from order history every time, not stored anywhere.
export const LEVEL_STEP = 500;

export function getMemberLevel(beansSpent: number): number {
  return Math.floor(Math.max(0, beansSpent) / LEVEL_STEP) + 1;
}

// How much more beans spend is needed to reach the next level.
export function spendToNextLevel(beansSpent: number): number {
  const level = getMemberLevel(beansSpent);
  return level * LEVEL_STEP - beansSpent;
}
