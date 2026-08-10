ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20) NOT NULL DEFAULT 'none';

ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS labor_discount_type VARCHAR(20) NOT NULL DEFAULT 'none';

COMMENT ON COLUMN pcmazing_service_parts.discount_type IS
  'Customer discount type for the part line: none | senior | pwd (PH SC/PWD rules).';

COMMENT ON COLUMN pcmazing_services.labor_discount_type IS
  'Customer discount type for service labor: none | senior | pwd (PH SC/PWD rules).';
