ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS time_out_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS time_out_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS time_out_location_label VARCHAR(200);
