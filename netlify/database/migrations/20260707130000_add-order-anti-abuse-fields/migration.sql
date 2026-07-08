ALTER TABLE orders ADD COLUMN client_ip TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN dedupe_key TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_orders_client_ip_created_at ON orders (client_ip, created_at);
