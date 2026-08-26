-- Company operational expenses calendar (Sales Operations)

CREATE TABLE IF NOT EXISTS pcmazing_company_expenses (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'salary',
  vendor VARCHAR(160),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_date
  ON pcmazing_company_expenses (expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_category
  ON pcmazing_company_expenses (category, expense_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE pcmazing_company_expenses IS
  'Scheduled and recorded company operational expenses for the expenses calendar.';
COMMENT ON COLUMN pcmazing_company_expenses.category IS
  'salary | rent | electric_bill | water_bill | internet_bill | taxes | maintenance';
COMMENT ON COLUMN pcmazing_company_expenses.status IS
  'planned | paid';
COMMENT ON COLUMN pcmazing_company_expenses.payment_method IS
  'cash | bank | gcash | card | other';
