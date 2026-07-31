ALTER TABLE pcmazing_service_types
  ADD COLUMN IF NOT EXISTS labor_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_service_types.labor_price IS
  'Standard labor charge for this service type (used on Job Orders and profit reporting).';

COMMENT ON COLUMN pcmazing_service_types.cost_price IS
  'Internal cost basis for profit monitoring (labor_price - cost_price).';
