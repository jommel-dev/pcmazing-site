ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS labor NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_service_parts.labor IS
  'Labor amount for a service part line (used especially for custom items/services).';
