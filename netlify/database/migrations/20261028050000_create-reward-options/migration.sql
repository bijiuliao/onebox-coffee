-- Admin-configurable catalog of level-up "skill" choices (see
-- member-level-claim.mts) - replaces the hardcoded REWARD_OPTIONS array so
-- the admin can add/edit/retire rewards and restrict each one to a level
-- range without a code change. min_level/max_level gate which rewards are
-- offered at a given unclaimedLevel (max_level NULL = no upper bound).
-- `active = false` retires a reward from future offers while keeping the
-- row (and its label) around for anyone who already picked it - rows are
-- never hard-deleted once referenced by member_rewards.
CREATE TABLE reward_options (
  id SERIAL PRIMARY KEY,
  reward_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  min_level INTEGER NOT NULL DEFAULT 2,
  max_level INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds the 3 rewards that were previously hardcoded, at the same
-- "every level past 1, no cap" range they already had - existing level-up
-- behavior doesn't change just because this moved into the database.
INSERT INTO reward_options (reward_key, label, description, min_level, max_level, sort_order) VALUES
  ('discount10', '下一單 9 折', '下次購買豆子結帳打 9 折', 2, NULL, 0),
  ('extra_10g', '多送 10 克', '下次買豆子任一包多裝 10 克', 2, NULL, 1),
  ('mystery_bag', '神秘豆一包', '店長精選的神秘豆，驚喜加贈一包', 2, NULL, 2);
