CREATE TABLE IF NOT EXISTS pcmazing_services (
  id BIGSERIAL PRIMARY KEY,
  service_name VARCHAR(180) NOT NULL,
  person_in_charge_user_id BIGINT,
  person_in_charge_source VARCHAR(40) NOT NULL DEFAULT 'tblusers',
  service_type VARCHAR(120) NOT NULL,
  base_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  labor NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(60) NOT NULL DEFAULT 'active',
  image_url TEXT,
  notes TEXT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_services_source
    CHECK (person_in_charge_source IN ('tblusers', 'pcmazing_admin_users'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_services_status
  ON pcmazing_services (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_services_type
  ON pcmazing_services (service_type)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_service_parts (
  id BIGSERIAL PRIMARY KEY,
  service_id BIGINT NOT NULL REFERENCES pcmazing_services(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES tblmaterials(id),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_service
  ON pcmazing_service_parts (service_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_service_parts_material
  ON pcmazing_service_parts (material_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE pcmazing_services IS
  'Catalog of services offered in the admin inventory module.';

COMMENT ON TABLE pcmazing_service_parts IS
  'Join table linking service catalog entries to inventory materials used as parts.';
