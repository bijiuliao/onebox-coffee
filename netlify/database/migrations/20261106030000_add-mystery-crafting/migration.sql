-- Adds a fourth, rarer mystery-pool tier above "competition" (see
-- lib/mysteryDraw.ts) - the inline CHECK from the add-mystery-bean-pool
-- migration has to be dropped and re-added since Postgres has no ALTER
-- CHECK; coffees_mystery_tier_check is the default name Postgres gives an
-- inline column CHECK (<table>_<column>_check).
ALTER TABLE coffees DROP CONSTRAINT coffees_mystery_tier_check;
ALTER TABLE coffees ADD CONSTRAINT coffees_mystery_tier_check CHECK (mystery_tier IN ('daily', 'rare', 'competition', 'rare_competition'));

-- Marks a mystery-pool reward row that was consumed as raw material by
-- crafting (combining 3 same-tier beans into 1 of the next tier up - see
-- member-level-mystery-craft.mts) rather than ever being shipped to the
-- customer. These rows still get redeemed_at set (so they stop showing up
-- as "pending" anywhere, and PackingView/stock logic leave them alone -
-- nothing was ever shipped for them, so no stock was ever deducted) but
-- this flag lets the UI show "merged into a craft" instead of "redeemed"
-- so the history stays honest about what actually happened to them.
ALTER TABLE member_rewards ADD COLUMN mystery_merged BOOLEAN NOT NULL DEFAULT false;
