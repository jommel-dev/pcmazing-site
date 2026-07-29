import { config } from 'dotenv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
config({ path: resolve(root, '.env') });

const filename = '017_inventory_services.sql';
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

  console.log('Connecting to database...');
  await client.connect();

  const probe = await client.query(`
    SELECT
      current_database() AS db,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'tblmaterials'
      ) AS has_materials,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pcmazing_services'
      ) AS has_services,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_pcmazing_migrations'
      ) AS has_migrations
  `);

  const state = probe.rows[0];
  console.log('DB:', state.db);
  console.log('tblmaterials:', state.has_materials);
  console.log('pcmazing_services:', state.has_services);
  console.log('_pcmazing_migrations:', state.has_migrations);

  if (!state.has_materials) {
    throw new Error('tblmaterials is missing. Cannot create service parts FK.');
  }

  // Match material id type so the FK is valid across integer/bigint schemas.
  const idTypeResult = await client.query(`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tblmaterials'
      AND column_name = 'id'
    LIMIT 1
  `);
  const materialIdType = idTypeResult.rows[0]?.data_type;
  const materialIdSqlType =
    materialIdType === 'integer' || materialIdType === 'int' || materialIdType === 'int4'
      ? 'INTEGER'
      : 'BIGINT';

  console.log('tblmaterials.id type:', materialIdType, '-> using', materialIdSqlType);

  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pcmazing_services (
        id BIGSERIAL PRIMARY KEY,
        service_name VARCHAR(180) NOT NULL,
        person_in_charge_user_id BIGINT,
        person_in_charge_source VARCHAR(40) NOT NULL DEFAULT 'tblusers',
        service_type VARCHAR(120) NOT NULL,
        base_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
        labor NUMERIC(12, 2) NOT NULL DEFAULT 0,
        status VARCHAR(60) NOT NULL DEFAULT 'active',
        image_url TEXT,
        notes TEXT,
        created_by BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ,
        CONSTRAINT chk_pcmazing_services_source
          CHECK (person_in_charge_source IN ('tblusers', 'pcmazing_admin_users'))
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pcmazing_services_status
        ON pcmazing_services (status)
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pcmazing_services_type
        ON pcmazing_services (service_type)
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pcmazing_service_parts (
        id BIGSERIAL PRIMARY KEY,
        service_id BIGINT NOT NULL REFERENCES pcmazing_services(id) ON DELETE CASCADE,
        material_id ${materialIdSqlType} NOT NULL REFERENCES tblmaterials(id),
        quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_service
        ON pcmazing_service_parts (service_id)
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_material
        ON pcmazing_service_parts (material_id)
        WHERE deleted_at IS NULL
    `);

    await client.query(`
      COMMENT ON TABLE pcmazing_services IS
        'Catalog of services offered in the admin inventory module.'
    `);

    await client.query(`
      COMMENT ON TABLE pcmazing_service_parts IS
        'Join table linking service catalog entries to inventory materials used as parts.'
    `);

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
    console.log('Migration applied successfully:', filename);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }

  const verify = await client.query(`
    SELECT
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pcmazing_services'
      ) AS has_services,
      EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pcmazing_service_parts'
      ) AS has_parts,
      (
        SELECT COUNT(*)::text FROM _pcmazing_migrations WHERE filename = $1
      ) AS migration_rows
  `, [filename]);

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
