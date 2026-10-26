// The "skill" choices offered on every level-up past Lv.1 (see
// member-level-claim.mts). Mirrors client/src/memberLevel.ts's
// REWARD_OPTIONS (separate module graph, can't share directly) - keep
// both in sync. Purely a catalog of valid reward_key values + display
// copy; actually granting a reward (applying a discount, bagging extra
// grams, picking a mystery bean) is done by admin by hand once they see
// a customer has an unredeemed choice - nothing here touches checkout.
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

export function isValidRewardKey(key: string): boolean {
  return REWARD_OPTIONS.some(r => r.key === key);
}
