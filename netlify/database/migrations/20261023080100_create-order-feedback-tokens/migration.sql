-- One-click star-rating links embedded in the 30-day feedback email (see
-- notify.ts's notifyFeedbackRequest) - each token scopes a link to exactly
-- one (order, coffee) pair and is single-use (redeemed_at), so a customer
-- can rate a coffee straight from the email with no login or typing.
CREATE TABLE order_feedback_tokens (
  token TEXT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  coffee_id TEXT NOT NULL REFERENCES coffees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ
);

CREATE INDEX idx_order_feedback_tokens_order_id ON order_feedback_tokens (order_id);
