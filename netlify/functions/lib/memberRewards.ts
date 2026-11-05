import { getDb } from './db';

// The "skill" choices offered on level-up (see member-level-claim.mts),
// now an admin-editable table (reward_options) instead of a hardcoded
// array - see the create-reward-options migration. min_level/max_level
// gate which rewards apply at a given unclaimedLevel; `active = false`
// retires one without deleting it, so a customer's past pick still
// resolves to a real label. Most rewards are still hand-fulfilled by
// admin (extra grams) - discount_percent and is_mystery_pool are the two
// exceptions with their own automated behavior: discount_percent makes
// orders.mts auto-apply/consume the reward at checkout; is_mystery_pool
// gives the customer a wheel to spin (see member-level-mystery-draw.mts)
// that picks a specific coffee for admin to pack, instead of a flat
// physical reward with no further interaction. Both default to "off"
// (NULL / false) so every pre-existing reward keeps its old manual-only
// behavior unless the admin opts it in.
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
}

export async function listRewardOptions(db: ReturnType<typeof getDb>): Promise<RewardOptionRow[]> {
  return (await db.sql`SELECT * FROM reward_options ORDER BY sort_order, id`) as RewardOptionRow[];
}

export function appliesToLevel(opt: Pick<RewardOptionRow, 'min_level' | 'max_level'>, level: number): boolean {
  return level >= opt.min_level && (opt.max_level === null || level <= opt.max_level);
}
