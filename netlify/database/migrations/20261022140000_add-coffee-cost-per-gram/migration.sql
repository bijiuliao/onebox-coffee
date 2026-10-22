-- Reference cost-per-gram (NT$), usually auto-filled from a loffeelabs
-- import's estimated TWD/g price but editable by hand too. Used only to
-- suggest a bag-option price when the admin types a weight - never affects
-- stock, checkout, or anything customer-facing.
ALTER TABLE coffees ADD COLUMN cost_per_gram_twd NUMERIC NULL;
