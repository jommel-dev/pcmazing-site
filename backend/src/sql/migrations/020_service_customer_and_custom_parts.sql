ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(180);

ALTER TABLE pcmazing_service_parts
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(180),
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_services.customer_name IS
  'Customer or client name for the service transaction.';

COMMENT ON COLUMN pcmazing_service_parts.custom_item_name IS
  'Custom non-inventory item/service label used when no inventory material exists.';

COMMENT ON COLUMN pcmazing_service_parts.unit_price IS
  'Customer-facing unit amount for custom non-inventory items or services.';
