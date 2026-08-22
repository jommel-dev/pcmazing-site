-- Fixed monthly salary (skips daily computation) and payout method for employees

ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS fixed_monthly_salary NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS qr_image_url VARCHAR(500);

COMMENT ON COLUMN pcmazing_user_payroll.fixed_monthly_salary IS
  'When set, period pay uses this monthly amount (prorated by days) instead of daily attendance units.';

COMMENT ON COLUMN pcmazing_user_payroll.payout_method IS
  'cash | online';
