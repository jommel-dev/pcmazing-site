-- Phases = contract milestones. Epics = modules linked inside each milestone.
-- Tasks belong under an epic (module).

CREATE TABLE IF NOT EXISTS pcmazing_project_phases (
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
  CONSTRAINT pcmazing_project_phases_status_check
    CHECK (status IN ('planned', 'active', 'completed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_project_phases_milestone
  ON pcmazing_project_phases(project_id, contract_milestone_id)
  WHERE contract_milestone_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_phases_project
  ON pcmazing_project_phases(project_id, sort_order, id);

ALTER TABLE pcmazing_projects
  ADD COLUMN IF NOT EXISTS current_phase_id BIGINT REFERENCES pcmazing_project_phases(id) ON DELETE SET NULL;

ALTER TABLE pcmazing_project_epics
  ADD COLUMN IF NOT EXISTS phase_id BIGINT REFERENCES pcmazing_project_phases(id) ON DELETE CASCADE;

ALTER TABLE pcmazing_project_epics
  ADD COLUMN IF NOT EXISTS contract_module_id BIGINT REFERENCES pcmazing_client_contract_modules(id) ON DELETE SET NULL;

-- One milestone can have many module epics; uniqueness moves to (phase, module).
DROP INDEX IF EXISTS idx_pcmazing_project_epics_milestone;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_project_epics_module
  ON pcmazing_project_epics(phase_id, contract_module_id)
  WHERE contract_module_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_project_epics_phase
  ON pcmazing_project_epics(phase_id, sort_order, id);

-- Rebuild hierarchy from contract data for existing projects that still store milestones as epics.
DO $$
BEGIN
  -- Clear old milestone-as-epic rows so app can reseed modules under phases.
  UPDATE pcmazing_project_tasks SET epic_id = NULL WHERE epic_id IS NOT NULL;
  UPDATE pcmazing_projects SET current_epic_id = NULL, current_phase_id = NULL;
  DELETE FROM pcmazing_project_epics;
END $$;
