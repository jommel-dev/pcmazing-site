ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

COMMENT ON COLUMN pcmazing_services.cancel_reason IS
  'Required explanation when a job order is marked Cancelled.';
