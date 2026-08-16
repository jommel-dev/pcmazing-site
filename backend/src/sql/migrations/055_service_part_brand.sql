ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS brand_name VARCHAR(120);

COMMENT ON COLUMN pcmazing_service_parts.brand_name IS
  'Brand shown on the job-order part line. Snapshotted from inventory or typed for new parts.';
