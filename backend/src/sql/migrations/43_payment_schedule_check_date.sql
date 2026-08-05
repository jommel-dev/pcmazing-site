-- Optional check date when settling a payment by check.

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS check_date DATE;

COMMENT ON COLUMN pcmazing_client_contract_payment_schedules.check_date IS
  'Check date when payment_method is Check; payment_code holds the check number.';
