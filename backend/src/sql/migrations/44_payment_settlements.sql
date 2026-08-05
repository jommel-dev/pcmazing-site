-- Settlement ledger for partial/full payments against a payment schedule row.

CREATE TABLE IF NOT EXISTS pcmazing_client_contract_payment_settlements (
  id BIGSERIAL PRIMARY KEY,
  payment_schedule_id BIGINT NOT NULL
    REFERENCES pcmazing_client_contract_payment_schedules(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  settled_on DATE NOT NULL,
  payment_method VARCHAR(100) NOT NULL,
  payment_code VARCHAR(100),
  check_date DATE,
  remaining_balance NUMERIC(14, 2) NOT NULL CHECK (remaining_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_payment_settlements_schedule
  ON pcmazing_client_contract_payment_settlements(payment_schedule_id, settled_on DESC, id DESC);

COMMENT ON TABLE pcmazing_client_contract_payment_settlements IS
  'Append-only ledger of partial/full settlements against contract payment schedule rows.';

-- Backfill one full settlement for already-paid schedule rows that have no ledger yet.
INSERT INTO pcmazing_client_contract_payment_settlements (
  payment_schedule_id,
  amount,
  settled_on,
  payment_method,
  payment_code,
  check_date,
  remaining_balance,
  created_at
)
SELECT
  ps.id,
  ps.amount,
  COALESCE(ps.settled_at::date, ps.due_date, CURRENT_DATE),
  COALESCE(NULLIF(TRIM(ps.payment_method), ''), 'Cash'),
  ps.payment_code,
  ps.check_date,
  0,
  COALESCE(ps.settled_at, NOW())
FROM pcmazing_client_contract_payment_schedules ps
WHERE LOWER(COALESCE(ps.status, '')) = 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM pcmazing_client_contract_payment_settlements s
    WHERE s.payment_schedule_id = ps.id
  );
