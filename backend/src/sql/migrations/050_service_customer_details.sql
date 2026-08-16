ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(180),
  ADD COLUMN IF NOT EXISTS customer_contact VARCHAR(60),
  ADD COLUMN IF NOT EXISTS customer_address TEXT;

COMMENT ON COLUMN pcmazing_services.customer_email IS
  'Customer email for the job order.';

COMMENT ON COLUMN pcmazing_services.customer_contact IS
  'Customer contact number for the job order.';

COMMENT ON COLUMN pcmazing_services.customer_address IS
  'Customer address for the job order.';
