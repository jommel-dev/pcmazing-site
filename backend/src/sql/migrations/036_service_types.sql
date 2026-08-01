CREATE TABLE IF NOT EXISTS pcmazing_service_types (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_service_types_name_active
  ON pcmazing_service_types (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_types_active
  ON pcmazing_service_types (is_active)
  WHERE deleted_at IS NULL;

INSERT INTO pcmazing_service_types (name)
SELECT DISTINCT TRIM(s.service_type)
FROM pcmazing_services s
WHERE s.deleted_at IS NULL
  AND NULLIF(TRIM(s.service_type), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pcmazing_service_types t
    WHERE t.deleted_at IS NULL
      AND LOWER(TRIM(t.name)) = LOWER(TRIM(s.service_type))
  );

COMMENT ON TABLE pcmazing_service_types IS
  'Catalog of service types selectable on Job Order forms.';
