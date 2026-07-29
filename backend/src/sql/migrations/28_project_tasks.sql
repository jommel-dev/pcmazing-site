-- Project task board (Kanban) columns and cards.

CREATE TABLE IF NOT EXISTS pcmazing_project_tasks (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'todo',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  sort_order INT NOT NULL DEFAULT 0,
  assignee_user_id BIGINT,
  assignee_user_source VARCHAR(40),
  due_date DATE,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_tasks_status_check
    CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done')),
  CONSTRAINT pcmazing_project_tasks_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  CONSTRAINT pcmazing_project_tasks_assignee_source_check
    CHECK (
      assignee_user_source IS NULL
      OR assignee_user_source IN ('pcmazing_admin_users', 'tblusers')
    )
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_board
  ON pcmazing_project_tasks(project_id, status, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_assignee
  ON pcmazing_project_tasks(assignee_user_id, assignee_user_source);
