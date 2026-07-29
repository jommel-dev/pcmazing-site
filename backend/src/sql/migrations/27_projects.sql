-- Projects created from signed contracts, with PM and developer team members.

CREATE TABLE IF NOT EXISTS pcmazing_projects (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE RESTRICT,
  name VARCHAR(150) NOT NULL,
  project_type VARCHAR(100),
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  project_manager_user_id BIGINT NOT NULL,
  project_manager_user_source VARCHAR(40) NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_projects_status_check
    CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT pcmazing_projects_pm_source_check
    CHECK (project_manager_user_source IN ('pcmazing_admin_users', 'tblusers'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_projects_status
  ON pcmazing_projects(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_projects_pm
  ON pcmazing_projects(project_manager_user_id, project_manager_user_source);

CREATE TABLE IF NOT EXISTS pcmazing_project_members (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL,
  user_source VARCHAR(40) NOT NULL,
  member_role VARCHAR(50) NOT NULL DEFAULT 'developer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_members_source_check
    CHECK (user_source IN ('pcmazing_admin_users', 'tblusers')),
  CONSTRAINT pcmazing_project_members_unique
    UNIQUE (project_id, user_id, user_source)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_members_project
  ON pcmazing_project_members(project_id, id);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_members_user
  ON pcmazing_project_members(user_id, user_source);
