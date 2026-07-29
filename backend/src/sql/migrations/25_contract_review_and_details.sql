-- Contract under review status, module details, and milestone/payment linkage.

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
    'contract_under_review',
    'contract_signed',
    'closed_lost'
  ));

ALTER TABLE pcmazing_client_contracts
  ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS features TEXT;

ALTER TABLE pcmazing_client_contract_modules
  ADD COLUMN IF NOT EXISTS process_flow TEXT;

ALTER TABLE pcmazing_client_contract_milestones
  ADD COLUMN IF NOT EXISTS connected_module_sort_order INT;
