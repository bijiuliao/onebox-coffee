-- Retiring a sold-out bean is separate from the day-to-day active/inactive
-- toggle: archived beans drop out of the admin's main working list (and are
-- never customer-visible) without deleting their data.
ALTER TABLE coffees ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
