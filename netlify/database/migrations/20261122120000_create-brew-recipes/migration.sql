-- Admin-only brewing log: how a given bean was actually brewed, split into
-- three kinds - 'espresso' (義式), 'pourover' (手沖) and 'special' (特調).
-- coffee_id ties a recipe to one of the shop's own beans so recipes can be
-- picked/filtered per bean; special_id optionally ties a 特調 recipe to the
-- menu item it makes. Both are nullable + ON DELETE SET NULL so a recipe
-- never disappears just because what it pointed at did.
--
-- params holds the kind-specific numbers (dose/yield/time for espresso,
-- water/pours for pour-over, ingredients/steps for specials) as JSON, since
-- each kind has a different shape and the admin UI is the only reader -
-- see client/src/admin/RecipesView.tsx for the exact fields.
CREATE TABLE brew_recipes (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('espresso', 'pourover', 'special')),
  coffee_id TEXT REFERENCES coffees(id) ON DELETE SET NULL,
  special_id TEXT REFERENCES specials(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  favorite BOOLEAN NOT NULL DEFAULT false,
  brewed_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brew_recipes_kind_idx ON brew_recipes (kind, brewed_on DESC);
CREATE INDEX brew_recipes_coffee_idx ON brew_recipes (coffee_id);
