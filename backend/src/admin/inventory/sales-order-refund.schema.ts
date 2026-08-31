import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let refundColumnsReady = false;

/** Ensures refund columns exist (migration 066) before sales-order refund queries run. */
export async function ensureSalesOrderRefundColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (refundColumnsReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_orders'))) {
    refundColumnsReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_orders
      ADD COLUMN IF NOT EXISTS refund_reason TEXT,
      ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refunded_by BIGINT;
  `);

  if (await tableExists(databaseService, 'pcmazing_sales_order_items')) {
    await databaseService.query(`
      ALTER TABLE pcmazing_sales_order_items
        ADD COLUMN IF NOT EXISTS refunded_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;
    `);
  }

  refundColumnsReady = true;
}
