import { getDb } from './db';

// The "skill" choices offered on level-up (see member-level-claim.mts),
// now an admin-editable table (reward_options) instead of a hardcoded
// array - see the create-reward-options migration. min_level/max_level
// gate which rewards apply at a given unclaimedLevel; `active = false`
// retires one without deleting it, so a customer's past pick still
// resolves to a real label. Most rewards are still hand-fulfilled by
// admin (extra grams, mystery bag) - discount_percent is the one
// exception: when set, orders.mts auto-applies it to the beans subtotal
// and consumes the reward at checkout instead of leaving it for admin to
// redeem by hand. NULL (the default) keeps a reward manual-only.
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
}

export async function listRewardOptions(db: ReturnType<typeof getDb>): Promise<RewardOptionRow[]> {
  return (await db.sql`SELECT * FROM reward_options ORDER BY sort_order, id`) as RewardOptionRow[];
}

export function appliesToLevel(opt: Pick<RewardOptionRow, 'min_level' | 'max_level'>, level: number): boolean {
  return level >= opt.min_level && (opt.max_level === null || level <= opt.max_level);
}
