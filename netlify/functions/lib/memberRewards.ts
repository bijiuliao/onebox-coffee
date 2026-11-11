import { getDb } from './db';

// The "skill" choices offered on level-up (see member-level-claim.mts),
// now an admin-editable table (reward_options) instead of a hardcoded
// array - see the create-reward-options migration. min_level/max_level
// gate which rewards apply at a given unclaimedLevel; `active = false`
// retires one without deleting it, so a customer's past pick still
// resolves to a real label. discount_percent, is_mystery_pool, and
// extra_grams_amount are the three auto-applying exceptions: discount_percent
// makes orders.mts auto-apply/consume the reward at checkout;
// is_mystery_pool gives the customer a wheel to spin (see
// member-level-mystery-draw.mts) that picks a specific coffee for admin to
// pack; extra_grams_amount lets the customer pick which beans line in
// their cart gets that many bonus grams added for free at checkout (see
// orders.mts), instead of a flat physical reward with no further
// interaction. All three default to "off" (NULL / false) so every
// pre-existing reward keeps its old manual-only behavior unless the admin
// opts it in.
export interface RewardOptionRow {
  id: number;
  reward_key: string;
  label: string;
  description: string;
  min_level: number;
  max_level: number | null;
  active: boolean;
  sort_order: number;
  discount_percent: number | null;
  is_mystery_pool: boolean;
  extra_grams_amount: number | null;
}

export async function listRewardOptions(db: ReturnType<typeof getDb>): Promise<RewardOptionRow[]> {
  return (await db.sql`SELECT * FROM reward_options ORDER BY sort_order, id`) as RewardOptionRow[];
}

export function appliesToLevel(opt: Pick<RewardOptionRow, 'min_level' | 'max_level'>, level: number): boolean {
  return level >= opt.min_level && (opt.max_level === null || level <= opt.max_level);
}
