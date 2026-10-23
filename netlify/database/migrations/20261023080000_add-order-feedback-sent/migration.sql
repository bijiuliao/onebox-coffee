-- Tracks whether the 30-day "how was it" feedback-request email has gone
-- out for this order, so the daily scheduled function (feedback-reminder.mts)
-- never sends it twice. NULL = not sent yet.
ALTER TABLE orders ADD COLUMN feedback_sent_at TIMESTAMPTZ;
