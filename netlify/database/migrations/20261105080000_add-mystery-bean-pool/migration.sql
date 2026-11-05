-- Which mystery-pool tier a coffee belongs to (see MemberLevelScreen's
-- wheel and lib/mysteryDraw.ts) - NULL (the default, every existing
-- coffee) means it's not in any pool and can never be drawn. A coffee can
-- only sit in one tier at a time; the admin assigns this from the coffee
-- editor (AdminPage.tsx).
ALTER TABLE coffees ADD COLUMN mystery_tier TEXT NULL CHECK (mystery_tier IN ('daily', 'rare', 'competition'));

-- Marks a reward_options row as a "mystery pool" reward - once a customer
-- claims one, they get a wheel to spin (see member-level-mystery-draw.mts)
-- instead of it being a flat physical reward with no further interaction.
-- false (default) for every existing reward keeps the old manual-only
-- behavior, same trade-off as discount_percent before it.
ALTER TABLE reward_options ADD COLUMN is_mystery_pool BOOLEAN NOT NULL DEFAULT false;

-- The actual existing "神秘豆一包" reward is exactly what this feature is
-- for, so it opts in by default - the admin can still set up this flag for
-- a different reward, or turn it back off, from the reward-options page.
UPDATE reward_options SET is_mystery_pool = true WHERE reward_key = 'mystery_bag';

-- Which coffee the wheel landed on for a claimed mystery-pool reward, and
-- when - NULL until the customer actually spins. Once set it's permanent
-- (no re-spinning); tier is captured alongside the coffee id so a reward's
-- history stays accurate even if that coffee's pool tier changes later.
ALTER TABLE member_rewards ADD COLUMN mystery_coffee_id TEXT NULL REFERENCES coffees(id);
ALTER TABLE member_rewards ADD COLUMN mystery_tier TEXT NULL;
ALTER TABLE member_rewards ADD COLUMN mystery_drawn_at TIMESTAMPTZ NULL;
