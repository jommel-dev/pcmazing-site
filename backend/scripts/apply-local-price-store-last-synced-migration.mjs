import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const filename = '078_local_price_store_last_synced.sql';
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
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'pcmazing_local_price_stores'
      AND column_name = 'last_synced_at'
  `);

  if (verify.rows.length === 0) {
    throw new Error('last_synced_at column was not found after migration.');
  }

  console.log(`Applied ${filename}; last_synced_at is present.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => undefined);
  });
