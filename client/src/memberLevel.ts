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

// The "skill" choices offered on every level-up past Lv.1 (see
// member-level-claim.mts). Mirrors netlify/functions/lib/memberRewards.ts
// (separate module graph, can't share directly) - keep both in sync.
// Picking one just records the choice for admin to see and hand out by
// hand - discounts, extra grams and mystery bags are never applied
// automatically at checkout.
export interface MemberReward {
  key: string;
  label: string;
  desc: string;
}

export const REWARD_OPTIONS: readonly MemberReward[] = [
  { key: 'discount10', label: '下一單 9 折', desc: '下次購買豆子結帳打 9 折' },
  { key: 'extra_10g', label: '多送 10 克', desc: '下次買豆子任一包多裝 10 克' },
  { key: 'mystery_bag', label: '神秘豆一包', desc: '店長精選的神秘豆，驚喜加贈一包' },
];
