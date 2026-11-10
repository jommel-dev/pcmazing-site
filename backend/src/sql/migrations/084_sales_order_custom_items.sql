-- Allow sales order lines without an inventory material (manual / ad-hoc items).

ALTER TABLE pcmazing_sales_order_items
  ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE pcmazing_sales_order_items
  ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(180);

-- Each line must reference inventory or carry a custom name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_pcmazing_sales_order_items_material_or_custom'
  ) THEN
    ALTER TABLE pcmazing_sales_order_items
      ADD CONSTRAINT chk_pcmazing_sales_order_items_material_or_custom
      CHECK (
        material_id IS NOT NULL
        OR NULLIF(TRIM(custom_item_name), '') IS NOT NULL
      );
  END IF;
END $$;
