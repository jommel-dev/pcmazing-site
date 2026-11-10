import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let salesItemWarrantyReady = false;
let jobPartWarrantyReady = false;

/** Ensures warranty columns exist on sales order items (migration 086). */
export async function ensureSalesOrderItemWarrantyColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (salesItemWarrantyReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_order_items'))) {
    salesItemWarrantyReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_order_items
      ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
      ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);
  `);

  salesItemWarrantyReady = true;
}

/** Ensures warranty columns exist on job order parts (migration 086). */
export async function ensureJobOrderPartWarrantyColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (jobPartWarrantyReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_service_parts'))) {
    jobPartWarrantyReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_service_parts
      ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
      ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);
  `);

  jobPartWarrantyReady = true;
}
