-- 072_local_price_lists_and_quotation_topup.sql

CREATE TABLE IF NOT EXISTS pcmazing_local_price_stores (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pcmazing_local_price_items (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES pcmazing_local_price_stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT NULL,
  price_php NUMERIC(14, 2) NOT NULL CHECK (price_php >= 0),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_price_items_store ON pcmazing_local_price_items(store_id);
CREATE INDEX IF NOT EXISTS idx_local_price_items_title ON pcmazing_local_price_items (lower(title));
CREATE UNIQUE INDEX IF NOT EXISTS uq_local_price_items_store_sku
  ON pcmazing_local_price_items(store_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

ALTER TABLE pcmazing_quotation_items
  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS topup_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS topup_value NUMERIC(14, 2) NOT NULL DEFAULT 0;

UPDATE pcmazing_quotation_items
SET base_unit_price = unit_price
WHERE base_unit_price IS NULL;

ALTER TABLE pcmazing_quotation_items
  ALTER COLUMN base_unit_price SET NOT NULL;

ALTER TABLE pcmazing_quotation_items
  DROP CONSTRAINT IF EXISTS chk_quotation_items_topup_mode;
ALTER TABLE pcmazing_quotation_items
  ADD CONSTRAINT chk_quotation_items_topup_mode
  CHECK (topup_mode IN ('none', 'fixed', 'percent'));
