-- Cupping scores are conventionally given to quarter-point precision (e.g. 87.25).
-- DOUBLE PRECISION (not NUMERIC) so the driver still returns a JS number, not a string.
ALTER TABLE coffees ALTER COLUMN score TYPE DOUBLE PRECISION;
