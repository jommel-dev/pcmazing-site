-- Task activity: comments and evidence files/screenshots.

CREATE TABLE IF NOT EXISTS pcmazing_project_task_comments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES pcmazing_project_tasks(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_comments_task
  ON pcmazing_project_task_comments(task_id, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS pcmazing_project_task_attachments (
  id BIGSERIAL PRIMARY KEY,
  task_id BIGINT NOT NULL REFERENCES pcmazing_project_tasks(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  kind VARCHAR(20) NOT NULL DEFAULT 'file',
  created_by_user_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_task_attachments_kind_check
    CHECK (kind IN ('screenshot', 'file'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_attachments_task
  ON pcmazing_project_task_attachments(task_id, created_at DESC, id DESC);
