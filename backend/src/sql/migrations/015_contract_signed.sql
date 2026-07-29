-- Add post-win contract tracking and itemized contract detail tables
ALTER TABLE pcmazing_client_prospects
  DROP CONSTRAINT IF EXISTS pcmazing_client_prospects_status_check;

ALTER TABLE pcmazing_client_prospects
  ADD CONSTRAINT pcmazing_client_prospects_status_check
  CHECK (status IN (
    'available',
    'picked_up',
    'called',
    'texted',
    'emailed',
    'met',
    'no_response',
    'meeting_set',
    'closed_won',
    'contract_signed',
    'closed_lost'
  ));

CREATE TABLE IF NOT EXISTS pcmazing_client_contracts (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL UNIQUE REFERENCES pcmazing_client_prospects(id) ON DELETE CASCADE,
  system_name VARCHAR(150) NOT NULL,
  system_type VARCHAR(100) NOT NULL,
  signed_at DATE,
  created_by_user_id BIGINT,
  updated_by_user_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contracts_prospect
  ON pcmazing_client_contracts(prospect_id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_modules (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  module_name VARCHAR(150) NOT NULL,
  description TEXT,
  quantity NUMERIC(12, 2),
  amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_modules_contract
  ON pcmazing_client_contract_modules(contract_id, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_milestones (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_milestones_contract
  ON pcmazing_client_contract_milestones(contract_id, sort_order, id);

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_payment_schedules (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES pcmazing_client_contracts(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  label VARCHAR(150) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_client_contract_payment_schedules_contract
  ON pcmazing_client_contract_payment_schedules(contract_id, sort_order, id);

COMMENT ON TABLE pcmazing_client_contracts IS
  'Signed contracts created from closed-won marketing prospects.';

COMMENT ON TABLE pcmazing_client_contract_modules IS
  'Itemized modules under a signed client contract.';

COMMENT ON TABLE pcmazing_client_contract_milestones IS
  'Itemized milestones under a signed client contract.';

COMMENT ON TABLE pcmazing_client_contract_payment_schedules IS
  'Itemized payment schedule rows under a signed client contract.';
