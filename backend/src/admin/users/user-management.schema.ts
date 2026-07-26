import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

const ENSURE_USER_MANAGEMENT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS pcmazing_admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  profile_image_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_admin_users_username
  ON pcmazing_admin_users (username);

INSERT INTO pcmazing_admin_users (username, full_name, password_hash, role)
VALUES (
  'admin',
  'System Administrator',
  'f865b53623b121fd34ee5426c792e5c33af8c227',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
`;

export async function ensureUserManagementTable(databaseService: DatabaseService): Promise<void> {
  if (!(await tableExists(databaseService, 'pcmazing_admin_users'))) {
    await databaseService.query(ENSURE_USER_MANAGEMENT_TABLE_SQL);
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_admin_users
      ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR(500);
  `);
}
