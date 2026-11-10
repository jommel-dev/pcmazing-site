-- Optional per-line warranty on sales order items and job order parts.

ALTER TABLE pcmazing_sales_order_items
  ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);

ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);
