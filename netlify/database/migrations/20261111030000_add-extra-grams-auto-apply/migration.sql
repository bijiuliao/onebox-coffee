-- Lets a reward option auto-apply as a free bonus added to a specific
-- beans line at checkout, instead of being a flat physical reward admin
-- hands out by hand (see orders.mts) - same opt-in pattern as
-- discount_percent and is_mystery_pool before it. NULL (the default, and
-- what every existing reward keeps) means the reward stays exactly as
-- before - manual-only, no automatic checkout effect.
ALTER TABLE reward_options ADD COLUMN extra_grams_amount INTEGER NULL;

-- The actual existing "多送 10 克" reward is exactly what this feature is
-- for, so it opts in by default at its original amount - the admin can
-- still change the amount or turn it back off from the reward-options page.
UPDATE reward_options SET extra_grams_amount = 10 WHERE reward_key = 'extra_10g';

-- Which member_rewards row (if any) a checkout consumed for its free-bonus
-- line - lets receipts/order views trace which claimed reward paid for
-- which order's bonus grams, same pattern as discount_reward_id. The
-- actual bonus amount and which line it landed on live on the order's own
-- items (see OrderLine.bonusGrams in orders.mts) rather than a separate
-- column here, since that's what PackingView actually needs to read.
ALTER TABLE orders ADD COLUMN extra_grams_reward_id INTEGER NULL REFERENCES member_rewards(id);
