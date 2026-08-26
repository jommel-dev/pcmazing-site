-- Missed clock-out adjustment: employee submits claimed time + photo; admin approves.

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS adjustment_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS requested_time_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjustment_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS adjustment_note VARCHAR(255),
  ADD COLUMN IF NOT EXISTS adjustment_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS adjustment_reviewed_by BIGINT,
  ADD COLUMN IF NOT EXISTS adjustment_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjustment_review_note VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_adjustment_status
  ON pcmazing_attendance (adjustment_status, work_date DESC);

COMMENT ON COLUMN pcmazing_attendance.adjustment_status IS
  'none | pending | approved | rejected. Pending time-out requests wait for admin before time_out is set.';
