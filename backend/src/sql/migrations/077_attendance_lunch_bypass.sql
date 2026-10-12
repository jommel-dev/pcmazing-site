-- Lunch punches + admin bypass audit on daily attendance.

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS lunch_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_out_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS lunch_in_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS time_in_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS lunch_out_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS lunch_in_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS time_out_bypassed_by_admin_id BIGINT;
