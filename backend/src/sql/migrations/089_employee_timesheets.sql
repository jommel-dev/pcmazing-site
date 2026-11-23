CREATE TABLE IF NOT EXISTS pcmazing_employee_timesheets (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  full_name VARCHAR(200) NOT NULL DEFAULT '',
  username VARCHAR(80) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
  days_present INT NOT NULL DEFAULT 0,
  days_completed INT NOT NULL DEFAULT 0,
  employee_note TEXT,
  review_note TEXT,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by_user_id BIGINT,
  reviewed_by_name VARCHAR(200),
  finalized_at TIMESTAMPTZ,
  finalized_by_user_id BIGINT,
  finalized_by_name VARCHAR(200),
  posted_on DATE,
  payslip_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_pcmazing_employee_timesheets_period UNIQUE (user_id, user_source, period_from, period_to)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_employee_timesheets_status
  ON pcmazing_employee_timesheets (status, period_to DESC);
