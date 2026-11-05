-- Lets a reward option auto-apply as a real checkout discount instead of
-- being a manual-only "skill" admin hands out by hand (see orders.mts).
-- NULL (the default, and what every existing reward keeps) means the
-- reward stays exactly as before - manual fulfillment, no automatic
-- checkout effect. Physical rewards (extra grams, mystery bag) should
-- always leave this NULL; only percentage-discount rewards set it.
ALTER TABLE reward_options ADD COLUMN discount_percent INTEGER NULL;

-- How much (if any) a checkout auto-discounted off the beans subtotal, and
-- which member_rewards row was consumed for it (NULL if none applied) -
-- lets receipts/order views show "會員折扣 -$X" and lets admin trace which
-- claimed reward paid for which order. Consuming the reward (setting its
-- redeemed_at) happens atomically with the order insert in orders.mts.
ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN discount_reward_id INTEGER NULL REFERENCES member_rewards(id);
