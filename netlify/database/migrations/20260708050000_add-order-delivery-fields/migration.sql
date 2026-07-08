ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT '自取';
ALTER TABLE orders ADD COLUMN delivery_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN delivery_distance_km REAL;
ALTER TABLE orders ADD COLUMN customer_lat REAL;
ALTER TABLE orders ADD COLUMN customer_lng REAL;
