-- Track when a contract payment schedule row was settled (status = paid).

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;

COMMENT ON COLUMN pcmazing_client_contract_payment_schedules.settled_at IS
  'When the payment was marked settled/paid from Project View.';
