-- Tracks whether an order has been handed to the customer: picked up
-- in-store (自取) or delivered (外送). DEFAULT FALSE so existing orders
-- start as not-yet-fulfilled; admin marks them manually via PATCH.
ALTER TABLE orders ADD COLUMN fulfilled BOOLEAN NOT NULL DEFAULT FALSE;
