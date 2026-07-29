-- Payroll profile (linked to User Management) + daily attendance punches

CREATE TABLE IF NOT EXISTS pcmazing_user_payroll (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  position_title VARCHAR(100),
  monthly_salary NUMERIC(12, 2),
  payroll_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_user_payroll_user UNIQUE (user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_user_payroll_enabled
  ON pcmazing_user_payroll (payroll_enabled)
  WHERE payroll_enabled = TRUE;

CREATE TABLE IF NOT EXISTS pcmazing_attendance (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  username VARCHAR(80) NOT NULL,
  work_date DATE NOT NULL,
  time_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_attendance_day UNIQUE (user_id, user_source, work_date)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_work_date
  ON pcmazing_attendance (work_date DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_username
  ON pcmazing_attendance (LOWER(username));

COMMENT ON TABLE pcmazing_user_payroll IS
  'Payroll fields for users managed in User Management (tblusers or pcmazing_admin_users).';

COMMENT ON TABLE pcmazing_attendance IS
  'Daily time-in / time-out punches. One open or closed record per user per Manila work date.';
