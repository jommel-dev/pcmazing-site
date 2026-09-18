import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let refundColumnsReady = false;

/** Ensures refund columns exist (migration 065) before job-order refund queries run. */
export async function ensureJobOrderRefundColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (refundColumnsReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_services'))) {
    refundColumnsReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_services
      ADD COLUMN IF NOT EXISTS refund_reason TEXT,
      ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2);
  `);

  refundColumnsReady = true;
}
