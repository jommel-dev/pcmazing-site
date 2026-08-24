-- Use the smallest printable margins as the default for receipts.

ALTER TABLE pcmazing_printing_settings
  ALTER COLUMN margin_top_mm SET DEFAULT 0,
  ALTER COLUMN margin_right_mm SET DEFAULT 0,
  ALTER COLUMN margin_bottom_mm SET DEFAULT 0,
  ALTER COLUMN margin_left_mm SET DEFAULT 0;

UPDATE pcmazing_printing_settings
SET
  margin_top_mm = 0,
  margin_right_mm = 0,
  margin_bottom_mm = 0,
  margin_left_mm = 0,
  updated_at = NOW()
WHERE id = 1;
