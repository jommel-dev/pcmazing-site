import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let manualTotalReady = false;

/** Ensures manual total column + audit log exist (migration 083). */
export async function ensureJobOrderManualTotalSchema(
  databaseService: DatabaseService,
): Promise<void> {
  if (manualTotalReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_services'))) {
    manualTotalReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_services
      ADD COLUMN IF NOT EXISTS manual_total_amount NUMERIC(12, 2) NULL;
  `);

  await databaseService.query(`
    CREATE TABLE IF NOT EXISTS pcmazing_job_order_audit_log (
      id BIGSERIAL PRIMARY KEY,
      service_id BIGINT NOT NULL,
      reference_no VARCHAR(80),
      action_type VARCHAR(40) NOT NULL,
      actor_admin_id BIGINT,
      actor_admin_username VARCHAR(80),
      actor_admin_name VARCHAR(200),
      reason TEXT,
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await databaseService.query(`
    CREATE INDEX IF NOT EXISTS idx_pcmazing_job_order_audit_log_created
      ON pcmazing_job_order_audit_log (created_at DESC, id DESC);
  `);

  await databaseService.query(`
    CREATE INDEX IF NOT EXISTS idx_pcmazing_job_order_audit_log_service
      ON pcmazing_job_order_audit_log (service_id, created_at DESC);
  `);

  manualTotalReady = true;
}
