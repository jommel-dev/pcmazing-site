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
