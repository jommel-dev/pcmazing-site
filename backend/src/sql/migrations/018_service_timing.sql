ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

COMMENT ON COLUMN pcmazing_services.started_at IS
  'Service work start timestamp.';

COMMENT ON COLUMN pcmazing_services.ended_at IS
  'Service work end timestamp.';
