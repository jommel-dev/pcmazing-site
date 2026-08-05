-- Add the dedicated Epics board and Testing task workflow stage.

ALTER TABLE pcmazing_project_tasks
  DROP CONSTRAINT IF EXISTS pcmazing_project_tasks_status_check;

UPDATE pcmazing_project_tasks
SET status = 'todo'
WHERE status = 'backlog'
   OR status = 'epics'
   OR status NOT IN ('todo', 'in_progress', 'in_review', 'testing', 'done');

ALTER TABLE pcmazing_project_tasks
  ALTER COLUMN status SET DEFAULT 'todo';

ALTER TABLE pcmazing_project_tasks
  ADD CONSTRAINT pcmazing_project_tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'in_review', 'testing', 'done'));

ALTER TABLE pcmazing_project_epics
  DROP CONSTRAINT IF EXISTS pcmazing_project_epics_board_status_check;

UPDATE pcmazing_project_epics
SET board_status = 'epics'
WHERE board_status IS DISTINCT FROM 'epics';

ALTER TABLE pcmazing_project_epics
  ALTER COLUMN board_status SET DEFAULT 'epics';

ALTER TABLE pcmazing_project_epics
  ADD CONSTRAINT pcmazing_project_epics_board_status_check
  CHECK (board_status = 'epics');
