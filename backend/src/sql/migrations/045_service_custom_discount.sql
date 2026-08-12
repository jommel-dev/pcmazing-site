ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_services.custom_discount IS
  'Flat peso discount applied to the customer payment total and shown on receipts.';
