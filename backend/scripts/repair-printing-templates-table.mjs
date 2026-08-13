import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
});

async function templatesQueryWorks() {
  await client.query(`
    SELECT id, name
    FROM pcmazing_printing_templates
    WHERE deleted_at IS NULL
    LIMIT 1
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in backend/.env');
  }

  await client.connect();

  try {
    await templatesQueryWorks();
    console.log('Printing templates table is healthy. No repair needed.');
    return;
  } catch (error) {
    console.warn('Templates table query failed:', error.message);
    console.warn('Attempting repair by recreating pcmazing_printing_templates...');
  }

  await client.query('BEGIN');

  try {
    await client.query(`
      ALTER TABLE pcmazing_printing_settings
        DROP CONSTRAINT IF EXISTS pcmazing_printing_settings_default_template_id_fkey
    `);

    await client.query(`
      UPDATE pcmazing_printing_settings
      SET default_template_id = NULL
      WHERE id = 1
    `);

    await client.query(`
      ALTER TABLE IF EXISTS pcmazing_printing_templates
        RENAME TO pcmazing_printing_templates_corrupt
    `);

    await client.query(`
      CREATE TABLE pcmazing_printing_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(180) NOT NULL,
        document_type VARCHAR(60) NOT NULL DEFAULT 'sales_receipt',
        paper_width_mm NUMERIC(6, 2) NOT NULL DEFAULT 210,
        paper_height_mm NUMERIC(6, 2) NOT NULL DEFAULT 297,
        layout_json JSONB NOT NULL DEFAULT '{"elements":[]}'::jsonb,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX uq_pcmazing_printing_templates_name
        ON pcmazing_printing_templates (LOWER(TRIM(name)))
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE INDEX idx_pcmazing_printing_templates_document_type
        ON pcmazing_printing_templates (document_type)
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      ALTER TABLE pcmazing_printing_settings
        ADD CONSTRAINT pcmazing_printing_settings_default_template_id_fkey
        FOREIGN KEY (default_template_id)
        REFERENCES pcmazing_printing_templates (id)
        ON DELETE SET NULL
    `);

    const seedFilename = '044_job_order_receipt_template.sql';
    const seedSql = readFileSync(
      resolve(root, 'src/sql/migrations', seedFilename),
      'utf8',
    );
    await client.query(seedSql);

    const seedChecksum = createHash('sha256').update(seedSql).digest('hex');
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
      [seedFilename, seedChecksum],
    );

    await client.query('COMMIT');

    const verify = await client.query(`
      SELECT id, name, is_default
      FROM pcmazing_printing_templates
      WHERE deleted_at IS NULL
      ORDER BY id
    `);

    console.log('Repair complete.');
    console.log('Templates:', verify.rows);
    console.log(
      'Note: the old corrupted table was renamed to pcmazing_printing_templates_corrupt and left in place.',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Repair failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await client.end();
    } catch {
      // ignore
    }
  });
