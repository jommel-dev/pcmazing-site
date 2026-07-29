-- Selfie proof for attendance punches

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS time_in_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS time_out_selfie_url VARCHAR(500);

COMMENT ON COLUMN pcmazing_attendance.time_in_selfie_url IS
  'Public URL path to the time-in selfie proof image.';

COMMENT ON COLUMN pcmazing_attendance.time_out_selfie_url IS
  'Public URL path to the time-out selfie proof image.';
