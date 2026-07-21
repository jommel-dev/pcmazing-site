-- PCmazing admin auth (fallback when tblusers from 3BMA import is not present)
-- password_hash stores SHA1 hex, same format as tblusers.password in 3BMA.

CREATE TABLE IF NOT EXISTS pcmazing_admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  email VARCHAR(255),
  full_name VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'admin',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_admin_users_username
  ON pcmazing_admin_users (username);

-- Fallback admin account (password: admin123)
INSERT INTO pcmazing_admin_users (username, full_name, password_hash, role)
VALUES (
  'admin',
  'System Administrator',
  'f865b53623b121fd34ee5426c792e5c33af8c227',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
