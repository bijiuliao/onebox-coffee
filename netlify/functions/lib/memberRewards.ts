import { getDb } from './db';

// The "skill" choices offered on level-up (see member-level-claim.mts),
// now an admin-editable table (reward_options) instead of a hardcoded
// array - see the create-reward-options migration. min_level/max_level
// gate which rewards apply at a given unclaimedLevel; `active = false`
// retires one without deleting it, so a customer's past pick still
// resolves to a real label. Granting a reward is still always manual -
// nothing here touches checkout.
export interface RewardOptionRow {
  id: number;
  reward_key: string;
  label: string;
  description: string;
  min_level: number;
  max_level: number | null;
  active: boolean;
  sort_order: number;
}

export async function listRewardOptions(db: ReturnType<typeof getDb>): Promise<RewardOptionRow[]> {
  return (await db.sql`SELECT * FROM reward_options ORDER BY sort_order, id`) as RewardOptionRow[];
}

export function appliesToLevel(opt: Pick<RewardOptionRow, 'min_level' | 'max_level'>, level: number): boolean {
  return level >= opt.min_level && (opt.max_level === null || level <= opt.max_level);
}
