import { DatabaseService } from '../../database/database.service';

const ENSURE_PAYROLL_SQL = `
CREATE TABLE IF NOT EXISTS pcmazing_user_payroll (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  position_title VARCHAR(100),
  salary_type VARCHAR(30) NOT NULL DEFAULT 'monthly',
  monthly_salary NUMERIC(12, 2),
  payroll_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_user_payroll_user UNIQUE (user_id, user_source)
);

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

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS salary_type VARCHAR(30) NOT NULL DEFAULT 'monthly';

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS fixed_monthly_salary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS qr_image_url VARCHAR(500);

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS time_in_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS time_out_selfie_url VARCHAR(500);

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overtime_status VARCHAR(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overtime_reviewed_by BIGINT,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS overtime_review_note VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_pcmazing_attendance_overtime_status
  ON pcmazing_attendance (overtime_status, work_date DESC);

-- Recalculate OT using 9-hour full day. Eligible OT stays 'none' until employee requests approval.
UPDATE pcmazing_attendance
SET overtime_hours = CASE
      WHEN EXTRACT(EPOCH FROM (time_out - time_in)) / 3600.0 > 9
        THEN ROUND((EXTRACT(EPOCH FROM (time_out - time_in)) / 3600.0 - 9)::numeric, 2)
      ELSE 0
    END,
    overtime_status = CASE
      WHEN EXTRACT(EPOCH FROM (time_out - time_in)) / 3600.0 <= 9 THEN 'none'
      WHEN overtime_status IN ('pending', 'approved', 'rejected') THEN overtime_status
      ELSE 'none'
    END,
    updated_at = NOW()
WHERE time_in IS NOT NULL
  AND time_out IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  period_days INT NOT NULL,
  label VARCHAR(120) NOT NULL,
  generated_by_user_id BIGINT,
  generated_by_username VARCHAR(80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_payroll_runs_period UNIQUE (date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_runs_date_to
  ON pcmazing_payroll_runs (date_to DESC, id DESC);

CREATE TABLE IF NOT EXISTS pcmazing_generated_payslips (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES pcmazing_payroll_runs(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  username VARCHAR(80) NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  employee_code VARCHAR(50),
  department VARCHAR(100),
  salary_type VARCHAR(30) NOT NULL,
  salary_amount NUMERIC(12, 2),
  days_present INT NOT NULL DEFAULT 0,
  days_completed INT NOT NULL DEFAULT 0,
  total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  estimated_pay NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payroll_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_generated_payslips_run_user UNIQUE (run_id, user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_generated_payslips_user
  ON pcmazing_generated_payslips (user_id, user_source, run_id DESC);
`;

export async function ensurePayrollTables(databaseService: DatabaseService): Promise<void> {
  await databaseService.query(ENSURE_PAYROLL_SQL);
}

/** Current calendar date in Asia/Manila as YYYY-MM-DD. */
export function manilaWorkDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
