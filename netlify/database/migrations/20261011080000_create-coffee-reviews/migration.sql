CREATE TABLE coffee_reviews (
  id SERIAL PRIMARY KEY,
  coffee_id TEXT NOT NULL REFERENCES coffees(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  flavor_tags JSONB NOT NULL DEFAULT '[]',
  client_ip TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_coffee_reviews_coffee_id ON coffee_reviews (coffee_id);
CREATE INDEX idx_coffee_reviews_client_ip_created_at ON coffee_reviews (client_ip, created_at);
