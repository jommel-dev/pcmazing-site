-- Store commission as percentage (0–100) instead of fixed PHP amount
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pcmazing_client_prospects'
      AND column_name = 'commissioned'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'pcmazing_client_prospects'
      AND column_name = 'commission_percent'
  ) THEN
    ALTER TABLE pcmazing_client_prospects
      RENAME COLUMN commissioned TO commission_percent;
  END IF;
END $$;

ALTER TABLE pcmazing_client_prospects
  ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5, 2);

ALTER TABLE pcmazing_client_prospects
  DROP CONSTRAINT IF EXISTS pcmazing_client_prospects_commission_percent_check;

ALTER TABLE pcmazing_client_prospects
  ADD CONSTRAINT pcmazing_client_prospects_commission_percent_check
  CHECK (commission_percent IS NULL OR (commission_percent >= 0 AND commission_percent <= 100));

COMMENT ON COLUMN pcmazing_client_prospects.commission_percent IS
  'Commission percentage (0-100) applied to the closed-won project deal.';
