ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS wfh_salary NUMERIC(12, 2);
