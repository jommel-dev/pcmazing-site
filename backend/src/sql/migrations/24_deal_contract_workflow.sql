-- Enhanced deal contract workflow: normalized systems table, extended child entities,
-- status audit logging, and client contract signing invitations.

-- Standalone systems table (one system profile per deal/prospect).
CREATE TABLE IF NOT EXISTS pcmazing_deal_systems (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  system_name VARCHAR(150) NOT NULL,
  system_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_systems_prospect
  ON pcmazing_deal_systems(prospect_id);

-- Extend contract header with signing lifecycle.
ALTER TABLE pcmazing_client_contracts
  ADD COLUMN IF NOT EXISTS signing_status VARCHAR(30) NOT NULL DEFAULT 'draft';

ALTER TABLE pcmazing_client_contracts
  DROP CONSTRAINT IF EXISTS pcmazing_client_contracts_signing_status_check;

ALTER TABLE pcmazing_client_contracts
  ADD CONSTRAINT pcmazing_client_contracts_signing_status_check
  CHECK (signing_status IN ('draft', 'pending_signature', 'signed'));

-- Extend modules with itemized tracking fields and direct deal FK.
ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE;

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS module_code VARCHAR(50);

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT;

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS delivery_timeline VARCHAR(200);

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS responsible_team VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_modules_prospect
  ON pcmazing_client_contract_modules(prospect_id, sort_order, id);

-- Extend milestones with sequential schedule fields and direct deal FK.
ALTER TABLE pcmazing_client_contract_milestones
  ADD COLUMN IF NOT EXISTS prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE;

ALTER TABLE pcmazing_client_contract_milestones
  ADD COLUMN IF NOT EXISTS milestone_code VARCHAR(50);

ALTER TABLE pcmazing_client_contract_milestones
  ADD COLUMN IF NOT EXISTS dependencies TEXT;

ALTER TABLE pcmazing_client_contract_milestones
  ADD COLUMN IF NOT EXISTS success_criteria TEXT;

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_milestones_prospect
  ON pcmazing_client_contract_milestones(prospect_id, sort_order, id);

-- Extend payment schedules with milestone linkage and payment status.
ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS prospect_id BIGINT REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE;

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS payment_code VARCHAR(50);

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS milestone_id BIGINT REFERENCES pcmazing_client_contract_milestones(id) ON DELETE SET NULL;

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';

ALTER TABLE pcmazing_client_contract_payment_schedules
  DROP CONSTRAINT IF EXISTS pcmazing_client_contract_payment_schedules_status_check;

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD CONSTRAINT pcmazing_client_contract_payment_schedules_status_check
  CHECK (status IN ('pending', 'paid', 'overdue'));

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_prospect
  ON pcmazing_client_contract_payment_schedules(prospect_id, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_milestone
  ON pcmazing_client_contract_payment_schedules(milestone_id);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_status
  ON pcmazing_client_contract_payment_schedules(status);

-- Status transition audit log.
CREATE TABLE IF NOT EXISTS pcmazing_deal_status_audit_log (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  previous_status VARCHAR(30) NOT NULL,
  new_status VARCHAR(30) NOT NULL,
  changed_by_user_id BIGINT,
  changed_by_process VARCHAR(100) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_status_audit_prospect
  ON pcmazing_deal_status_audit_log(prospect_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_status_audit_status
  ON pcmazing_deal_status_audit_log(new_status, created_at DESC);

-- Client contract signing invitations (token-based verification).
CREATE TABLE IF NOT EXISTS pcmazing_deal_contract_signing (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  signing_token VARCHAR(64) NOT NULL UNIQUE,
  client_signer_name VARCHAR(200),
  client_signer_email VARCHAR(200),
  signature_verified_at TIMESTAMPTZ,
  signature_ip VARCHAR(45),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_contract_signing_token
  ON pcmazing_deal_contract_signing(signing_token);

CREATE INDEX IF NOT EXISTS idx_pcmazing_deal_contract_signing_contract
  ON pcmazing_deal_contract_signing(contract_id);

-- Backfill deal systems and child prospect_id values from existing contracts.
INSERT INTO pcmazing_deal_systems (prospect_id, system_name, system_type)
SELECT c.prospect_id, c.system_name, c.system_type
FROM pcmazing_client_contracts c
ON CONFLICT (prospect_id) DO UPDATE
SET system_name = EXCLUDED.system_name,
    system_type = EXCLUDED.system_type,
    updated_at = NOW();

UPDATE pcmazing_client_contract_modules m
SET prospect_id = c.prospect_id
FROM pcmazing_client_contracts c
WHERE m.contract_id = c.id
  AND m.prospect_id IS NULL;

UPDATE pcmazing_client_contract_milestones ms
SET prospect_id = c.prospect_id
FROM pcmazing_client_contracts c
WHERE ms.contract_id = c.id
  AND ms.prospect_id IS NULL;

UPDATE pcmazing_client_contract_payment_schedules ps
SET prospect_id = c.prospect_id
FROM pcmazing_client_contracts c
WHERE ps.contract_id = c.id
  AND ps.prospect_id IS NULL;

UPDATE pcmazing_client_contracts
SET signing_status = 'signed'
WHERE signed_at IS NOT NULL
  AND signing_status = 'draft';

-- Logical views for the requested entity names (systems, modules, milestones, payment_schedules).
CREATE OR REPLACE VIEW systems AS
SELECT
  s.id,
  s.prospect_id AS deal_id,
  s.system_name,
  s.system_type,
  s.created_at,
  s.updated_at
FROM pcmazing_deal_systems s;

CREATE OR REPLACE VIEW modules AS
SELECT
  m.id,
  m.prospect_id AS deal_id,
  m.contract_id,
  m.module_code AS module_id,
  m.module_name,
  m.description,
  m.scope_of_work,
  m.delivery_timeline,
  m.responsible_team,
  m.sort_order,
  m.created_at
FROM pcmazing_client_contract_modules m;

CREATE OR REPLACE VIEW milestones AS
SELECT
  ms.id,
  ms.prospect_id AS deal_id,
  ms.contract_id,
  ms.milestone_code AS milestone_id,
  ms.title AS milestone_name,
  ms.description,
  ms.due_date AS target_completion_date,
  ms.dependencies,
  ms.success_criteria,
  ms.sort_order,
  ms.created_at
FROM pcmazing_client_contract_milestones ms;

CREATE OR REPLACE VIEW payment_schedules AS
SELECT
  ps.id,
  ps.prospect_id AS deal_id,
  ps.contract_id,
  ps.payment_code AS payment_id,
  ps.milestone_id AS associated_milestone_id,
  ps.label,
  ps.amount AS payment_amount,
  ps.due_date,
  ps.payment_method,
  ps.status,
  ps.notes,
  ps.sort_order,
  ps.created_at
FROM pcmazing_client_contract_payment_schedules ps;

COMMENT ON TABLE pcmazing_deal_systems IS
  'Standalone system profile (name and type) linked to a deal/prospect record.';

COMMENT ON TABLE pcmazing_deal_status_audit_log IS
  'Audit trail for deal/prospect status transitions including actor and timestamp.';

COMMENT ON TABLE pcmazing_deal_contract_signing IS
  'Client contract signing invitations and signature verification records.';
