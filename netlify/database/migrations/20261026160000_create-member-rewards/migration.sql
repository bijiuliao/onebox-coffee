-- Records which "skill" (reward) a member picked on reaching a given
-- level (see netlify/functions/member-level-claim.mts). One row per
-- (email, level) - UNIQUE prevents re-claiming the same level-up twice.
-- redeemed_at is set by admin once they've actually handed out the
-- reward (discount applied, extra grams bagged, mystery bag given) - this
-- never auto-applies anything at checkout, same as paid/fulfilled.
CREATE TABLE member_rewards (
  id SERIAL PRIMARY KEY,
  customer_email TEXT NOT NULL,
  level INTEGER NOT NULL,
  reward_key TEXT NOT NULL,
  chosen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at TIMESTAMPTZ,
  UNIQUE (customer_email, level)
);

CREATE INDEX idx_member_rewards_email ON member_rewards (customer_email);
