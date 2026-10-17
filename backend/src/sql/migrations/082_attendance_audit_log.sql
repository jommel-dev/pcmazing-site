-- Admin punch-edit audit history for attendance.

CREATE TABLE IF NOT EXISTS pcmazing_attendance_audit_log (
  id BIGSERIAL PRIMARY KEY,
  attendance_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  username VARCHAR(80) NOT NULL,
  employee_full_name VARCHAR(200),
  work_date DATE NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  actor_admin_id BIGINT NOT NULL,
  actor_admin_username VARCHAR(80),
  actor_admin_name VARCHAR(200),
  reason TEXT NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_audit_log_created
  ON pcmazing_attendance_audit_log (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_audit_log_attendance
  ON pcmazing_attendance_audit_log (attendance_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_audit_log_work_date
  ON pcmazing_attendance_audit_log (work_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_audit_log_actor
  ON pcmazing_attendance_audit_log (actor_admin_id, created_at DESC);
