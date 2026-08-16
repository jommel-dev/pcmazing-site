ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS downpayment NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_services.downpayment IS
  'Optional customer downpayment collected when the job is created or updated.';
