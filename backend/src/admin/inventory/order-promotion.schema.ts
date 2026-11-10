import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let salesPromotionReady = false;
let jobPromotionReady = false;

/** Ensures promotion column exists on sales orders (migration 085). */
export async function ensureSalesOrderPromotionColumn(
  databaseService: DatabaseService,
): Promise<void> {
  if (salesPromotionReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_orders'))) {
    salesPromotionReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_orders
      ADD COLUMN IF NOT EXISTS promotion VARCHAR(180);
  `);

  salesPromotionReady = true;
}

/** Ensures promotion column exists on job orders / services (migration 085). */
export async function ensureJobOrderPromotionColumn(
  databaseService: DatabaseService,
): Promise<void> {
  if (jobPromotionReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_services'))) {
    jobPromotionReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_services
      ADD COLUMN IF NOT EXISTS promotion VARCHAR(180);
  `);

  jobPromotionReady = true;
}
