ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS service_type_id BIGINT REFERENCES pcmazing_service_types(id);

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_service_type
  ON pcmazing_service_parts (service_type_id)
  WHERE deleted_at IS NULL AND service_type_id IS NOT NULL;

ALTER TABLE pcmazing_services
  ALTER COLUMN service_type TYPE VARCHAR(500);

COMMENT ON COLUMN pcmazing_service_parts.service_type_id IS
  'Catalog service selected on a job order. A job can include multiple services.';
