CREATE TABLE IF NOT EXISTS pcmazing_quotations (
  id BIGSERIAL PRIMARY KEY,
  quote_no VARCHAR(30),
  quote_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_name VARCHAR(180) NOT NULL,
  customer_address TEXT,
  customer_contact_number VARCHAR(60),
  customer_email VARCHAR(180),
  remarks TEXT,
  custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  validity_days INTEGER NOT NULL DEFAULT 7,
  expires_at TIMESTAMPTZ,
  converted_sales_id BIGINT,
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_quotations_status
    CHECK (status IN ('draft', 'finalized', 'expired', 'converted')),
  CONSTRAINT chk_pcmazing_quotations_validity_days
    CHECK (validity_days >= 1 AND validity_days <= 365)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_quotations_quote_no
  ON pcmazing_quotations (quote_no)
  WHERE quote_no IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotations_quote_date
  ON pcmazing_quotations (quote_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotations_status
  ON pcmazing_quotations (status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_quotation_items (
  id BIGSERIAL PRIMARY KEY,
  quotation_id BIGINT NOT NULL REFERENCES pcmazing_quotations(id) ON DELETE CASCADE,
  material_id BIGINT REFERENCES tblmaterials(id),
  description VARCHAR(500) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'none',
  line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_quotation_items_discount_type
    CHECK (discount_type IN ('none', 'senior', 'pwd')),
  CONSTRAINT chk_pcmazing_quotation_items_quantity
    CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotation_items_quotation
  ON pcmazing_quotation_items (quotation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_quotation_items_material
  ON pcmazing_quotation_items (material_id)
  WHERE deleted_at IS NULL AND material_id IS NOT NULL;

COMMENT ON TABLE pcmazing_quotations IS
  'Customer quotations. Offers only — does not deduct inventory.';

COMMENT ON TABLE pcmazing_quotation_items IS
  'Quotation lines: inventory materials or custom/free-text items.';
