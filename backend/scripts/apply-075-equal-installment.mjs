import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const filename = '075_payroll_equal_installment_amount.sql';
const sql = readFileSync(resolve(root, 'src/sql/migrations', filename), 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

await client.connect();
await client.query('BEGIN');
try {
  await client.query(sql);
  await client.query(
    `INSERT INTO _pcmazing_migrations (filename, checksum, source)
     VALUES ($1, $2, 'manual')
     ON CONFLICT (filename) DO UPDATE
       SET checksum = EXCLUDED.checksum, applied_at = NOW(), source = EXCLUDED.source`,
    [filename, checksum],
  );
  await client.query('COMMIT');
  console.log(JSON.stringify({ ok: true, filename }));
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
