CREATE TABLE IF NOT EXISTS pcmazing_employee_memos (
  id SERIAL PRIMARY KEY,
  memo_no VARCHAR(40) NOT NULL UNIQUE,
  employee_user_id INTEGER NOT NULL,
  memo_type VARCHAR(40) NOT NULL,
  subject VARCHAR(300) NOT NULL,
  incident_date DATE NULL,
  statement_of_facts TEXT NOT NULL,
  policy_violated TEXT NULL,
  directive TEXT NULL,
  reply_by_date DATE NULL,
  issued_by_user_id INTEGER NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_memos_employee_ack
  ON pcmazing_employee_memos (employee_user_id, acknowledged_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_memos_issued_at
  ON pcmazing_employee_memos (issued_at DESC)
  WHERE deleted_at IS NULL;
