-- =============================================================================
-- pgAdmin script: Kanban backlog + task activity history
-- Database: pcmazing_staging (or your target DB)
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS where possible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) MIGRATION (same as migrations/41_project_task_activity_and_backlog.sql)
--    Adds Backlog status + pcmazing_project_task_activity_log
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 2) VERIFY schema
-- -----------------------------------------------------------------------------

SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'pcmazing_project_tasks'::regclass
  AND contype = 'c'
  AND conname = 'pcmazing_project_tasks_status_check';

SELECT to_regclass('public.pcmazing_project_task_activity_log') AS activity_table;

-- -----------------------------------------------------------------------------
-- 3) QUERIES used by the API (Task Details → History)
--    Replace :project_id / :task_id / :phase_id with real values in pgAdmin
-- -----------------------------------------------------------------------------

-- 3a) History for ONE task (Task Details drawer — project_id + task_id only)
-- Example: project_id = 1, task_id = 55
SELECT
  id,
  project_id,
  phase_id,
  task_id,
  task_title,
  epic_id,
  epic_title,
  action_type,
  actor_user_id,
  actor_user_source,
  actor_name,
  from_status,
  to_status,
  details,
  meta_json,
  created_at
FROM pcmazing_project_task_activity_log
WHERE project_id = 1          -- << change
  AND task_id = 55            -- << change
ORDER BY created_at DESC, id DESC
LIMIT 25 OFFSET 0;

-- Count for that task
SELECT COUNT(*)::bigint AS total
FROM pcmazing_project_task_activity_log
WHERE project_id = 1          -- << change
  AND task_id = 55;           -- << change

-- 3b) History for a PHASE (Board → History tab — project_id + phase_id)
SELECT
  id,
  project_id,
  phase_id,
  task_id,
  task_title,
  action_type,
  actor_name,
  from_status,
  to_status,
  details,
  created_at
FROM pcmazing_project_task_activity_log
WHERE project_id = 1          -- << change
  AND phase_id = 10           -- << change
ORDER BY created_at DESC, id DESC
LIMIT 25 OFFSET 0;

-- -----------------------------------------------------------------------------
-- 4) Handy lookups
-- -----------------------------------------------------------------------------

-- Recent activity across all projects
SELECT
  id,
  project_id,
  phase_id,
  task_id,
  task_title,
  action_type,
  actor_name,
  from_status,
  to_status,
  created_at
FROM pcmazing_project_task_activity_log
ORDER BY created_at DESC, id DESC
LIMIT 50;

-- Task status distribution (Backlog / To Do / … / Done)
SELECT status, COUNT(*) AS task_count
FROM pcmazing_project_tasks
GROUP BY status
ORDER BY status;

-- Attachments for one task
SELECT id, task_id, file_name, mime_type, kind, file_url, created_at
FROM pcmazing_project_task_attachments
WHERE task_id = 55            -- << change
ORDER BY created_at DESC;
