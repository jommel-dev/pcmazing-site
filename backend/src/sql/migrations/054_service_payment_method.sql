ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40);

COMMENT ON COLUMN pcmazing_services.payment_method IS
  'Settlement payment method: Cash, Gcash, or Bank Transfer.';
