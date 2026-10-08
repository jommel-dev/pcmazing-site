import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const filename = '074_payroll_ledger_loans_commissions.sql';
const sqlPath = resolve(root, 'src/sql/migrations', filename);
const sql = readFileSync(sqlPath, 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  await client.connect();
  await client.query('BEGIN');

  try {
    await client.query(sql);
    await client.query(`
      CREATE TABLE IF NOT EXISTS _pcmazing_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        checksum VARCHAR(64) NOT NULL,
        source VARCHAR(32) NOT NULL DEFAULT 'bundled'
      )
    `);

    await client.query(
      `
      INSERT INTO _pcmazing_migrations (filename, checksum, source)
      VALUES ($1, $2, 'manual')
      ON CONFLICT (filename) DO UPDATE
        SET checksum = EXCLUDED.checksum,
            applied_at = NOW(),
            source = EXCLUDED.source
      `,
      [filename, checksum],
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const verify = await client.query(`
    SELECT
      (SELECT COUNT(*)::int
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (
           'pcmazing_payroll_loans',
           'pcmazing_payroll_loan_period_overrides',
           'pcmazing_payroll_commission_types',
           'pcmazing_payroll_commission_entries',
           'pcmazing_payroll_manual_deductions',
           'pcmazing_payroll_payslip_ledger'
         )) AS tables,
      (SELECT COUNT(*)::int
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pcmazing_payroll_settings'
         AND column_name IN (
           'shift_start_time',
           'late_grace_minutes',
           'late_deduction_fixed',
           'late_deduction_per_minute'
         )) AS settings_columns,
      (SELECT COUNT(*)::int
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'pcmazing_generated_payslips'
         AND column_name = 'remarks') AS remarks_column
  `);
  console.log(JSON.stringify({ ok: true, filename, ...verify.rows[0] }, null, 2));
  await client.end();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await client.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
