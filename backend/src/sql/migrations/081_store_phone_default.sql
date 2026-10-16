-- Ensure company phone is available for printable letterheads.
UPDATE pcmazing_printing_settings
SET store_phone = '09394133225'
WHERE TRIM(COALESCE(store_phone, '')) = '';

ALTER TABLE pcmazing_printing_settings
  ALTER COLUMN store_phone SET DEFAULT '09394133225';
