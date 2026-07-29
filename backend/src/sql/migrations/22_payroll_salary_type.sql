-- Salary schedule type for payroll profiles

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS salary_type VARCHAR(30) NOT NULL DEFAULT 'monthly';

COMMENT ON COLUMN pcmazing_user_payroll.salary_type IS
  'weekly | semi_monthly | monthly | cutoff';
