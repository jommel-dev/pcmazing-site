ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_service_parts.discount_amount IS
  'Custom peso discount for the job-order line. Net = max(0, gross - discount_amount).';
