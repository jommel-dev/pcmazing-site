CREATE TABLE IF NOT EXISTS pcmazing_service_status_history (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES pcmazing_services(id) ON DELETE CASCADE,
  from_status VARCHAR(60),
  to_status VARCHAR(60) NOT NULL,
  reason TEXT,
  changed_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_status_history_service
  ON pcmazing_service_status_history (service_id, created_at DESC);

COMMENT ON TABLE pcmazing_service_status_history IS
  'Audit trail of job order status changes.';
