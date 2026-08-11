CREATE TABLE IF NOT EXISTS pcmazing_printing_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name VARCHAR(180) NOT NULL DEFAULT 'PCmazing',
  store_address VARCHAR(500) NOT NULL DEFAULT '',
  store_phone VARCHAR(60) NOT NULL DEFAULT '',
  store_code VARCHAR(30) NOT NULL DEFAULT '1',
  workstation_no VARCHAR(30) NOT NULL DEFAULT '1',
  paper_size VARCHAR(20) NOT NULL DEFAULT 'A4',
  margin_top_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_right_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_bottom_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  margin_left_mm NUMERIC(6, 2) NOT NULL DEFAULT 0,
  default_template_id INTEGER,
  font_family VARCHAR(120) NOT NULL DEFAULT 'Times New Roman',
  show_page_numbers BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pcmazing_printing_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS pcmazing_printing_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  document_type VARCHAR(60) NOT NULL DEFAULT 'sales_receipt',
  paper_width_mm NUMERIC(6, 2) NOT NULL DEFAULT 210,
  paper_height_mm NUMERIC(6, 2) NOT NULL DEFAULT 297,
  layout_json JSONB NOT NULL DEFAULT '{"elements":[]}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_printing_templates_name
  ON pcmazing_printing_templates (LOWER(TRIM(name)))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_printing_templates_document_type
  ON pcmazing_printing_templates (document_type)
  WHERE deleted_at IS NULL;

ALTER TABLE pcmazing_printing_settings
  DROP CONSTRAINT IF EXISTS pcmazing_printing_settings_default_template_id_fkey;

ALTER TABLE pcmazing_printing_settings
  ADD CONSTRAINT pcmazing_printing_settings_default_template_id_fkey
  FOREIGN KEY (default_template_id)
  REFERENCES pcmazing_printing_templates (id)
  ON DELETE SET NULL;

COMMENT ON TABLE pcmazing_printing_settings IS
  'Global printing defaults for receipts and printable documents.';

COMMENT ON TABLE pcmazing_printing_templates IS
  'Draggable print layout templates stored as JSON element trees.';
