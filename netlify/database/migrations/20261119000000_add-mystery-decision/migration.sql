-- Lets the customer explicitly decide, right after a mystery-pool draw,
-- whether this specific bean is a keeper (admin should ship it) or
-- material for crafting (combine with 2 more of the same tier - see
-- member-level-mystery-craft.mts) - NULL means "not decided yet", which is
-- neither shippable nor usable as crafting material. This closes the gap
-- where admin had no way to tell, from a drawn-but-unshipped reward alone,
-- whether the customer actually wants it shipped or might feed it into a
-- craft attempt instead.
ALTER TABLE member_rewards ADD COLUMN mystery_decision TEXT NULL CHECK (mystery_decision IN ('keep', 'craft'));

-- Rows drawn before this feature existed were always treated as "pending
-- shipment" (the only state that existed back then) - keep that exact
-- behavior for them rather than suddenly hiding them from PackingView as
-- undecided. Only draws made AFTER this migration start out genuinely
-- undecided and need the customer to actually choose.
UPDATE member_rewards SET mystery_decision = 'keep'
WHERE mystery_coffee_id IS NOT NULL AND redeemed_at IS NULL AND mystery_decision IS NULL;
