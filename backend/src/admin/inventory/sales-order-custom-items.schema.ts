import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let customItemsReady = false;

/** Ensures custom sales-order item columns exist (migration 084). */
export async function ensureSalesOrderCustomItemsSchema(
  databaseService: DatabaseService,
): Promise<void> {
  if (customItemsReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_order_items'))) {
    customItemsReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_order_items
      ALTER COLUMN material_id DROP NOT NULL;
  `);

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_order_items
      ADD COLUMN IF NOT EXISTS custom_item_name VARCHAR(180);
  `);

  await databaseService.query(`
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
  `);

  customItemsReady = true;
}
