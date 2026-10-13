-- Required going forward (validated at the API layer, same as customer_name)
-- so repeat customers can be grouped reliably - a free-text name alone can
-- collide between different people. DEFAULT '' keeps this backward
-- compatible with existing rows, same pattern as customer_name's own
-- migration.
ALTER TABLE orders ADD COLUMN customer_email TEXT NOT NULL DEFAULT '';
