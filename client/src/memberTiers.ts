// Member tiers, keyed purely by cumulative beans spend (Customer.beansSpent,
// summed server-side from every order's beans line items - see
// customers-list.mts). Tiers are computed client-side on that one number,
// not stored anywhere, so changing a threshold here takes effect
// immediately with no migration. Rewards per tier (discounts, free bags,
// rare-bean access) are NOT automated - admin decides and fulfills them
// manually once they see a customer has reached a tier, the same way paid/
// fulfilled status is confirmed manually. Colors reuse the exact palette
// already used for the leaderboard's 1st/2nd/3rd-place badges, plus the
// brand's green accent for the top tier.
export interface MemberTier {
  key: string;
  label: string;
  threshold: number;
  color: string;
}

export const MEMBER_TIERS: readonly MemberTier[] = [
  { key: 'bronze', label: '銅豆會員', threshold: 1500, color: '#8a5a3a' },
  { key: 'silver', label: '銀豆會員', threshold: 3000, color: '#8a7a68' },
  { key: 'gold', label: '金豆會員', threshold: 4500, color: '#c98a2e' },
  { key: 'rare', label: '稀有豆會員', threshold: 6000, color: '#3d6b4f' },
];

// Highest tier the given beans spend qualifies for, or null if below the
// first threshold.
export function getMemberTier(beansSpent: number): MemberTier | null {
  let current: MemberTier | null = null;
  for (const tier of MEMBER_TIERS) {
    if (beansSpent >= tier.threshold) current = tier;
  }
  return current;
}

// The next tier up, or null if already at (or past) the top tier - lets the
// UI show "$X to 銀豆會員" progress.
export function getNextMemberTier(beansSpent: number): MemberTier | null {
  return MEMBER_TIERS.find(tier => beansSpent < tier.threshold) ?? null;
}
