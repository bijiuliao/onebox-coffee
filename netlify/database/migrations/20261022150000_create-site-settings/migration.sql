-- Singleton row holding site-wide toggles - currently just whether hand-drip
-- (手沖) service is available at all, independent of any individual
-- coffee's own hot/ice settings (see coffees.hot_enabled/ice_enabled).
-- A fixed id=1 with a CHECK constraint keeps this a true singleton.
CREATE TABLE site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  drip_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO site_settings (id, drip_enabled) VALUES (1, TRUE);
