-- Company payroll calendar: work week + single-row settings

CREATE TABLE IF NOT EXISTS pcmazing_payroll_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  work_week VARCHAR(20) NOT NULL DEFAULT 'mon_fri',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pcmazing_payroll_settings (id, work_week)
VALUES (1, 'mon_fri')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE pcmazing_payroll_settings IS
  'Single-row company payroll calendar. work_week: mon_fri | mon_sat | day_off_basis.';
