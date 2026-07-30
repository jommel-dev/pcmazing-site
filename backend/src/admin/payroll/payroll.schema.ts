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

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS time_in_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS time_out_selfie_url VARCHAR(500);

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
