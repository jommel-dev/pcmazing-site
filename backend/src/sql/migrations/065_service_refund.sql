ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2);

COMMENT ON COLUMN pcmazing_services.refund_reason IS
  'Required explanation when a job order is marked Refunded.';

COMMENT ON COLUMN pcmazing_services.refund_amount IS
  'Amount refunded to the customer when status is Refunded.';
