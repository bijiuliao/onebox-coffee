-- Tracks whether the one-time "new bean launched" email has already been
-- sent for this coffee, so toggling active off and back on later (e.g.
-- temporarily taking a bean off-menu) doesn't re-notify customers.
-- Existing rows default to TRUE (they're not "new" as of this migration -
-- they would otherwise all fire the notification the next time any of them
-- gets toggled active). The column default then flips to FALSE so every
-- coffee created from here on starts as not-yet-notified.
ALTER TABLE coffees ADD COLUMN launch_notified BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE coffees ALTER COLUMN launch_notified SET DEFAULT FALSE;
