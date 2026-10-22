-- There's no online payment gateway - orders are paid by cash on pickup,
-- bank transfer, etc., confirmed manually by the admin. Independent of
-- `fulfilled` (出貨狀態): an order can be paid before it ships, or handed
-- over before payment is confirmed (e.g. cash on pickup).
ALTER TABLE orders ADD COLUMN paid BOOLEAN NOT NULL DEFAULT FALSE;
