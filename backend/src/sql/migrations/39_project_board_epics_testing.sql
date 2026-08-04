-- Add Epics and Testing task board stages for project tasks and epic cards.

ALTER TABLE pcmazing_project_tasks
  DROP CONSTRAINT IF EXISTS pcmazing_project_tasks_status_check;

ALTER TABLE pcmazing_project_tasks
  ADD CONSTRAINT pcmazing_project_tasks_status_check
  CHECK (status IN ('epics', 'todo', 'in_progress', 'in_review', 'testing', 'done'));

UPDATE pcmazing_project_tasks
SET status = 'epics'
WHERE status = 'backlog';

ALTER TABLE pcmazing_project_epics
  DROP CONSTRAINT IF EXISTS pcmazing_project_epics_board_status_check;

ALTER TABLE pcmazing_project_epics
  ADD CONSTRAINT pcmazing_project_epics_board_status_check
  CHECK (board_status IN ('epics', 'todo', 'in_progress', 'in_review', 'testing', 'done'));

UPDATE pcmazing_project_epics
SET board_status = 'epics'
WHERE board_status IS NULL
   OR board_status = 'backlog'
   OR board_status NOT IN ('epics', 'todo', 'in_progress', 'in_review', 'testing', 'done');
