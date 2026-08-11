ALTER TABLE pcmazing_printing_settings
  ADD COLUMN IF NOT EXISTS printer_connection_type VARCHAR(20) NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS printer_name VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS printer_host VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS printer_port INTEGER NOT NULL DEFAULT 9100,
  ADD COLUMN IF NOT EXISTS printer_bluetooth_device_id VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS printer_bluetooth_device_name VARCHAR(180) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS printer_auto_print BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS printer_last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS printer_last_test_status VARCHAR(40) NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS printer_last_test_message VARCHAR(500) NOT NULL DEFAULT '';

COMMENT ON COLUMN pcmazing_printing_settings.printer_connection_type IS
  'Printer link mode: direct (system/browser), network (IP/host), or bluetooth.';

COMMENT ON COLUMN pcmazing_printing_settings.printer_port IS
  'Network printer port. Common raw/ESC-POS port is 9100.';
