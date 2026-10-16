ALTER TABLE pcmazing_quotations
  ADD COLUMN IF NOT EXISTS use_manual_total BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pcmazing_quotations
  ADD COLUMN IF NOT EXISTS manual_total_amount NUMERIC(12, 2) NULL;

ALTER TABLE pcmazing_quotations
  ADD COLUMN IF NOT EXISTS hide_item_prices BOOLEAN NOT NULL DEFAULT FALSE;
