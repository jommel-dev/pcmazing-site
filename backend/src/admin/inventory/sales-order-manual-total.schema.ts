import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let manualTotalReady = false;

/** Ensures sales order manual total column exists (migration 087). */
export async function ensureSalesOrderManualTotalColumn(
  databaseService: DatabaseService,
): Promise<void> {
  if (manualTotalReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_orders'))) {
    manualTotalReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_orders
      ADD COLUMN IF NOT EXISTS manual_total_amount NUMERIC(12, 2) NULL;
  `);

  manualTotalReady = true;
}
