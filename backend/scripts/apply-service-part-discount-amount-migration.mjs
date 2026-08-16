import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const filename = '049_service_part_discount_amount.sql';
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
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'pcmazing_service_parts'
        AND column_name = 'discount_amount'
    ) AS has_discount_amount
  `);

  console.log('Migration applied successfully:', filename);
  console.log('Verify:', verify.rows[0]);
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      // ignore
    }
  });
