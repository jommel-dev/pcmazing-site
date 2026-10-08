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

CREATE TABLE IF NOT EXISTS pcmazing_payroll_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  work_week VARCHAR(20) NOT NULL DEFAULT 'mon_fri',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pcmazing_payroll_settings (id, work_week)
VALUES (1, 'mon_fri')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE pcmazing_payroll_settings
  ADD COLUMN IF NOT EXISTS undertime_grace_minutes SMALLINT NOT NULL DEFAULT 30;

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS undertime_category VARCHAR(30);

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS weekly_location_schedule JSONB NULL;

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS wfh_salary NUMERIC(12, 2);

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS work_location_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS location_label VARCHAR(200),
  ADD COLUMN IF NOT EXISTS location_mismatch BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pcmazing_payroll_settings
  ADD COLUMN IF NOT EXISTS shift_start_time TIME NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS late_grace_minutes SMALLINT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS late_deduction_fixed NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_deduction_per_minute NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE pcmazing_generated_payslips
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_loans (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  principal NUMERIC(12, 2) NOT NULL CHECK (principal > 0),
  balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0 AND balance <= principal),
  term_style VARCHAR(30) NOT NULL
    CHECK (term_style IN ('equal_installments', 'fixed_per_cutoff')),
  installment_count INT NULL CHECK (installment_count IS NULL OR installment_count > 0),
  fixed_installment_amount NUMERIC(12, 2) NULL
    CHECK (fixed_installment_amount IS NULL OR fixed_installment_amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paid', 'cancelled', 'deleted')),
  label VARCHAR(120) NOT NULL DEFAULT 'Loan',
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_loans_term
    CHECK (
      (term_style = 'equal_installments'
        AND installment_count IS NOT NULL
        AND fixed_installment_amount IS NOT NULL)
      OR
      (term_style = 'fixed_per_cutoff'
        AND installment_count IS NULL
        AND fixed_installment_amount IS NOT NULL)
    )
);

ALTER TABLE pcmazing_payroll_loans
  ADD COLUMN IF NOT EXISTS label VARCHAR(120);

UPDATE pcmazing_payroll_loans
SET label = 'Loan #' || id::text
WHERE label IS NULL OR BTRIM(label) = '';

ALTER TABLE pcmazing_payroll_loans
  ALTER COLUMN label SET NOT NULL;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pcmazing_payroll_loans'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'status'
      AND con.conname <> 'ck_pcmazing_payroll_loans_status'
  LOOP
    EXECUTE format('ALTER TABLE pcmazing_payroll_loans DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE pcmazing_payroll_loans
  DROP CONSTRAINT IF EXISTS ck_pcmazing_payroll_loans_status;

ALTER TABLE pcmazing_payroll_loans
  ADD CONSTRAINT ck_pcmazing_payroll_loans_status
  CHECK (status IN ('active', 'paid', 'cancelled', 'deleted'));

ALTER TABLE pcmazing_payroll_loans
  DROP CONSTRAINT IF EXISTS ck_pcmazing_payroll_loans_term;
UPDATE pcmazing_payroll_loans
SET fixed_installment_amount = ROUND(principal / installment_count, 2)
WHERE term_style = 'equal_installments'
  AND fixed_installment_amount IS NULL;
ALTER TABLE pcmazing_payroll_loans
  ADD CONSTRAINT ck_pcmazing_payroll_loans_term
  CHECK (
    (term_style = 'equal_installments'
      AND installment_count IS NOT NULL
      AND fixed_installment_amount IS NOT NULL)
    OR
    (term_style = 'fixed_per_cutoff'
      AND installment_count IS NULL
      AND fixed_installment_amount IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_loans_user_status
  ON pcmazing_payroll_loans (user_id, user_source, status);

CREATE TABLE IF NOT EXISTS pcmazing_payroll_loan_period_overrides (
  id BIGSERIAL PRIMARY KEY,
  loan_id BIGINT NOT NULL REFERENCES pcmazing_payroll_loans(id) ON DELETE CASCADE,
  payroll_run_id BIGINT NULL REFERENCES pcmazing_payroll_runs(id) ON DELETE SET NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('skip', 'custom')),
  custom_amount NUMERIC(12, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_loan_overrides_dates CHECK (date_to >= date_from),
  CONSTRAINT ck_pcmazing_payroll_loan_overrides_action
    CHECK (
      (action = 'skip' AND custom_amount IS NULL)
      OR
      (action = 'custom' AND custom_amount IS NOT NULL AND custom_amount >= 0)
    ),
  CONSTRAINT uq_pcmazing_payroll_loan_override_period
    UNIQUE (loan_id, date_from, date_to)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_loan_overrides_run
  ON pcmazing_payroll_loan_period_overrides (payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_commission_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_commission_types_name CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_payroll_commission_types_name
  ON pcmazing_payroll_commission_types (lower(name));

CREATE TABLE IF NOT EXISTS pcmazing_payroll_commission_entries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  payroll_run_id BIGINT NULL REFERENCES pcmazing_payroll_runs(id) ON DELETE SET NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  type_id BIGINT NULL REFERENCES pcmazing_payroll_commission_types(id) ON DELETE RESTRICT,
  label TEXT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_commission_entries_dates CHECK (date_to >= date_from),
  CONSTRAINT ck_pcmazing_payroll_commission_entries_label
    CHECK (type_id IS NOT NULL OR btrim(COALESCE(label, '')) <> '')
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_commission_entries_user_period
  ON pcmazing_payroll_commission_entries (user_id, user_source, date_from, date_to);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_commission_entries_run
  ON pcmazing_payroll_commission_entries (payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_manual_deductions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  payroll_run_id BIGINT NULL REFERENCES pcmazing_payroll_runs(id) ON DELETE SET NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  label TEXT NOT NULL CHECK (btrim(label) <> ''),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  created_by BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_manual_deductions_dates CHECK (date_to >= date_from)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_manual_deductions_user_period
  ON pcmazing_payroll_manual_deductions (user_id, user_source, date_from, date_to);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_manual_deductions_run
  ON pcmazing_payroll_manual_deductions (payroll_run_id)
  WHERE payroll_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_payslip_ledger (
  id BIGSERIAL PRIMARY KEY,
  payslip_id BIGINT NOT NULL REFERENCES pcmazing_generated_payslips(id) ON DELETE CASCADE,
  line_type VARCHAR(40) NOT NULL
    CHECK (line_type IN (
      'commission',
      'late_deduction',
      'loan_deduction',
      'manual_deduction'
    )),
  label TEXT NOT NULL CHECK (btrim(label) <> ''),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  source VARCHAR(20) NOT NULL DEFAULT 'manual'
    CHECK (source IN ('auto', 'manual', 'override')),
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payroll_payslip_ledger_payslip
  ON pcmazing_payroll_payslip_ledger (payslip_id, id);
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
