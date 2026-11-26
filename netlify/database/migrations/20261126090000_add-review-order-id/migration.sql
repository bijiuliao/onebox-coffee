-- Ties a rating that came from the 30-day feedback email (see feedback.mts)
-- back to the order whose link was clicked, so the admin reviews page can
-- show which customer gave it. Ratings left on the public product page stay
-- anonymous - order_id is NULL for those.
ALTER TABLE coffee_reviews ADD COLUMN order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL;

-- Backfill ratings made before this column existed. feedback.mts inserted the
-- review and then, a moment later, stamped the token's redeemed_at - so for
-- each email-feedback review, the matching token is the one for the same
-- coffee redeemed closest after it (within a minute). Two customers rating
-- the same coffee within the same minute could in theory swap; that's rare
-- enough to accept for historical rows. Unmatched rows just stay NULL.
UPDATE coffee_reviews r
SET order_id = m.order_id
FROM (
  SELECT DISTINCT ON (r2.id) r2.id AS review_id, t.order_id
  FROM coffee_reviews r2
  JOIN order_feedback_tokens t
    ON t.coffee_id = r2.coffee_id
   AND t.redeemed_at IS NOT NULL
   AND t.redeemed_at BETWEEN r2.created_at AND r2.created_at + interval '1 minute'
  WHERE r2.client_ip = 'email-feedback'
  ORDER BY r2.id, t.redeemed_at - r2.created_at
) m
WHERE r.id = m.review_id;
