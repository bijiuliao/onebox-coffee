-- NULL means untracked/unlimited (default, backward compatible with every
-- existing bean). A non-null value is shared across hand-drip cups and
-- retail bags of the same coffee, and depletes on each successful order.
ALTER TABLE coffees ADD COLUMN stock_qty INTEGER;
ALTER TABLE coffees ADD CONSTRAINT coffees_stock_qty_nonnegative CHECK (stock_qty IS NULL OR stock_qty >= 0);
