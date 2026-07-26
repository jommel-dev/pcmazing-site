-- Commission amount (PHP) for closed-won project deals
ALTER TABLE pcmazing_client_prospects
  ADD COLUMN IF NOT EXISTS commissioned NUMERIC(14, 2);

COMMENT ON COLUMN pcmazing_client_prospects.commissioned IS
  'Commission paid (PHP) on a closed-won project deal.';
