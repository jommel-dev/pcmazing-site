ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS weekly_location_schedule JSONB NULL;

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS work_location_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(200),
  ADD COLUMN IF NOT EXISTS location_mismatch BOOLEAN NOT NULL DEFAULT FALSE;
