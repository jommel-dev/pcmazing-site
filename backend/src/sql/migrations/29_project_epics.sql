-- Contract milestones become project Epics; tasks belong to an epic/phase.

CREATE TABLE IF NOT EXISTS pcmazing_project_epics (
  id BIGSERIAL PRIMARY KEY,
  project_id BIGINT NOT NULL REFERENCES pcmazing_projects(id) ON DELETE CASCADE,
  contract_milestone_id BIGINT REFERENCES pcmazing_client_contract_milestones(id) ON DELETE SET NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pcmazing_project_epics_status_check
    CHECK (status IN ('planned', 'active', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_project_epics_milestone
  ON pcmazing_project_epics(project_id, contract_milestone_id)
  WHERE contract_milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_project
  ON pcmazing_project_epics(project_id, sort_order, id);

ALTER TABLE pcmazing_projects
  ADD COLUMN IF NOT EXISTS current_epic_id BIGINT REFERENCES pcmazing_project_epics(id) ON DELETE SET NULL;

ALTER TABLE pcmazing_project_tasks
  ADD COLUMN IF NOT EXISTS epic_id BIGINT REFERENCES pcmazing_project_epics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_tasks_epic
  ON pcmazing_project_tasks(epic_id, status, sort_order, id);
