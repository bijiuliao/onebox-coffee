ALTER TABLE coffees ADD COLUMN sells_beans BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE coffees ADD COLUMN bag_options JSONB NOT NULL DEFAULT '[]';

CREATE TABLE specials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL,
  color TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]',
  hot_enabled BOOLEAN NOT NULL DEFAULT true,
  ice_enabled BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
