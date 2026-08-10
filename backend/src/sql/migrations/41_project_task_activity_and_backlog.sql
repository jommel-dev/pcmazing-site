-- Reintroduce Backlog as a workflow column and add append-only task activity history.

ALTER TABLE pcmazing_project_tasks
  DROP CONSTRAINT IF EXISTS pcmazing_project_tasks_status_check;

UPDATE pcmazing_project_tasks
SET status = 'todo'
WHERE status = 'epics'
   OR status NOT IN ('backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done');

ALTER TABLE pcmazing_project_tasks
  ALTER COLUMN status SET DEFAULT 'todo';

ALTER TABLE pcmazing_project_tasks
  ADD CONSTRAINT pcmazing_project_tasks_status_check
  CHECK (status IN ('backlog', 'todo', 'in_progress', 'in_review', 'testing', 'done'));

-- Append-only activity log. Task snapshots survive deletion (no FK cascade from tasks).
CREATE TABLE IF NOT EXISTS pcmazing_project_task_activity_log (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  phase_id BIGINT,
  task_id BIGINT,
  task_title VARCHAR(200) NOT NULL,
  epic_id BIGINT,
  epic_title VARCHAR(200),
  action_type VARCHAR(80) NOT NULL,
  actor_user_id BIGINT,
  actor_user_source VARCHAR(40),
  actor_name VARCHAR(200),
  from_status VARCHAR(30),
  to_status VARCHAR(30),
  details TEXT,
  meta_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_task_activity_action_check
    CHECK (action_type IN (
      'created',
      'edited',
      'moved',
      'deleted',
      'comment_added',
      'attachment_added',
      'attachment_deleted'
    )),
  CONSTRAINT pcmazing_project_task_activity_actor_source_check
    CHECK (
      actor_user_source IS NULL
      OR actor_user_source IN ('pcmazing_admin_users', 'tblusers')
    )
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_project
  ON pcmazing_project_task_activity_log(project_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_phase
  ON pcmazing_project_task_activity_log(project_id, phase_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_task
  ON pcmazing_project_task_activity_log(task_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_task_activity_created
  ON pcmazing_project_task_activity_log(created_at DESC, id DESC);

COMMENT ON TABLE pcmazing_project_task_activity_log IS
  'Append-only Kanban task history; snapshots retain title/epic/actor after task deletion.';
