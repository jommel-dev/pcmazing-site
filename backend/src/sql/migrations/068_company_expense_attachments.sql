CREATE TABLE IF NOT EXISTS pcmazing_company_expense_attachments (
  id BIGSERIAL PRIMARY KEY,
  expense_id BIGINT NOT NULL REFERENCES pcmazing_company_expenses(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  kind VARCHAR(20) NOT NULL DEFAULT 'file',
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_company_expense_attachments_kind_check
    CHECK (kind IN ('receipt', 'file'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expense_attachments_expense
  ON pcmazing_company_expense_attachments (expense_id, created_at DESC, id DESC);

ALTER TABLE pcmazing_company_expenses
  ALTER COLUMN category TYPE VARCHAR(80);
