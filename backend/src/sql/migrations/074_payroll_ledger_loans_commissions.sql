-- 074_payroll_ledger_loans_commissions.sql
-- Payroll ledger, loans, commissions, manual deductions, late settings, and remarks.

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
    CHECK (status IN ('active', 'paid', 'cancelled')),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_pcmazing_payroll_loans_term
    CHECK (
      (term_style = 'equal_installments'
        AND installment_count IS NOT NULL
        AND fixed_installment_amount IS NULL)
      OR
      (term_style = 'fixed_per_cutoff'
        AND installment_count IS NULL
        AND fixed_installment_amount IS NOT NULL)
    )
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
