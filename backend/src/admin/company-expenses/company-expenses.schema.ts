import { DatabaseService } from '../../database/database.service';

let ensureReady = false;
let ensureInFlight: Promise<void> | null = null;

export async function ensureCompanyExpenseTables(
  databaseService: DatabaseService,
): Promise<void> {
  if (ensureReady) {
    return;
  }
  if (!ensureInFlight) {
    ensureInFlight = (async () => {
      await databaseService.query(`
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
        )
      `);
      await databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_date
          ON pcmazing_company_expenses (expense_date DESC)
          WHERE deleted_at IS NULL
      `);
      await databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expenses_category
          ON pcmazing_company_expenses (category, expense_date DESC)
          WHERE deleted_at IS NULL
      `);
      await databaseService.query(`
        ALTER TABLE pcmazing_company_expenses
          ALTER COLUMN category SET DEFAULT 'salary'
      `);
      await databaseService.query(`
        ALTER TABLE pcmazing_company_expenses
          ALTER COLUMN category TYPE VARCHAR(80)
      `);
      await databaseService.query(`
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
        )
      `);
      await databaseService.query(`
        CREATE INDEX IF NOT EXISTS idx_pcmazing_company_expense_attachments_expense
          ON pcmazing_company_expense_attachments (expense_id, created_at DESC, id DESC)
      `);
      ensureReady = true;
    })().finally(() => {
      ensureInFlight = null;
    });
  }
  await ensureInFlight;
}
