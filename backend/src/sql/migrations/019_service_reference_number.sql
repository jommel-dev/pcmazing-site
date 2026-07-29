ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS reference_no VARCHAR(30);

UPDATE pcmazing_services
SET reference_no = 'SRV-' || LPAD(id::text, 6, '0')
WHERE COALESCE(TRIM(reference_no), '') = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_services_reference_no
  ON pcmazing_services (reference_no)
  WHERE reference_no IS NOT NULL;

COMMENT ON COLUMN pcmazing_services.reference_no IS
  'Auto-generated unique service reference number.';
