-- Job order manual total override + activity audit log.

ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS manual_total_amount NUMERIC(12, 2) NULL;

CREATE TABLE IF NOT EXISTS pcmazing_job_order_audit_log (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL,
  reference_no VARCHAR(80),
  action_type VARCHAR(40) NOT NULL,
  actor_admin_id BIGINT,
  actor_admin_username VARCHAR(80),
  actor_admin_name VARCHAR(200),
  reason TEXT,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_job_order_audit_log_created
  ON pcmazing_job_order_audit_log (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_pcmazing_job_order_audit_log_service
  ON pcmazing_job_order_audit_log (service_id, created_at DESC);
