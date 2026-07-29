-- Epics are Kanban cards; board_status mirrors task column statuses.

ALTER TABLE pcmazing_project_epics
  ADD COLUMN IF NOT EXISTS board_status VARCHAR(30) NOT NULL DEFAULT 'todo';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pcmazing_project_epics_board_status_check'
  ) THEN
    ALTER TABLE pcmazing_project_epics
      ADD CONSTRAINT pcmazing_project_epics_board_status_check
      CHECK (board_status IN ('backlog', 'todo', 'in_progress', 'in_review', 'done'));
  END IF;
END $$;

UPDATE pcmazing_project_epics
SET board_status = 'todo'
WHERE board_status IS NULL
   OR board_status NOT IN ('backlog', 'todo', 'in_progress', 'in_review', 'done');

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_board
  ON pcmazing_project_epics(phase_id, board_status, sort_order, id);
