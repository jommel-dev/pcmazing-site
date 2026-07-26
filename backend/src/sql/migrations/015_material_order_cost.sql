-- Separate purchase/order cost from internal unit cost on materials
ALTER TABLE tblmaterials
  ADD COLUMN IF NOT EXISTS order_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN tblmaterials.order_cost IS
  'Expected cost when ordering or purchasing this product.';
