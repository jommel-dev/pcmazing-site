CREATE TABLE IF NOT EXISTS pcmazing_sales_orders (
  id BIGSERIAL PRIMARY KEY,
  reference_no VARCHAR(30),
  customer_name VARCHAR(180) NOT NULL,
  customer_phone VARCHAR(60),
  notes TEXT,
  custom_discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_void BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at TIMESTAMPTZ,
  voided_by BIGINT,
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_reference_no
  ON pcmazing_sales_orders (reference_no)
  WHERE reference_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_sale_date
  ON pcmazing_sales_orders (sale_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_orders_void
  ON pcmazing_sales_orders (is_void)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_sales_order_items (
  id BIGSERIAL PRIMARY KEY,
  sales_order_id BIGINT NOT NULL REFERENCES pcmazing_sales_orders(id) ON DELETE CASCADE,
  material_id BIGINT NOT NULL REFERENCES tblmaterials(id),
  quantity NUMERIC(12, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_type VARCHAR(10) NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_pcmazing_sales_order_items_discount_type
    CHECK (discount_type IN ('none', 'senior', 'pwd'))
);

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_order_items_order
  ON pcmazing_sales_order_items (sales_order_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pcmazing_sales_order_items_material
  ON pcmazing_sales_order_items (material_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE pcmazing_sales_orders IS
  'Retail sales orders that deduct inventory on save.';

COMMENT ON TABLE pcmazing_sales_order_items IS
  'Line items sold on a sales order.';
