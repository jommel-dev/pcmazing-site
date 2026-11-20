import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let intakeReady = false;

/** Ensures Job Order Form intake columns exist (migration 088). */
export async function ensureJobOrderIntakeColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (intakeReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_services'))) {
    intakeReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_services
      ADD COLUMN IF NOT EXISTS service_arrangement VARCHAR(20),
      ADD COLUMN IF NOT EXISTS device_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS device_type_other VARCHAR(120),
      ADD COLUMN IF NOT EXISTS device_cpu VARCHAR(120),
      ADD COLUMN IF NOT EXISTS device_ram VARCHAR(120),
      ADD COLUMN IF NOT EXISTS device_storage VARCHAR(120),
      ADD COLUMN IF NOT EXISTS device_display VARCHAR(120),
      ADD COLUMN IF NOT EXISTS included_accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS included_accessories_other VARCHAR(255),
      ADD COLUMN IF NOT EXISTS unit_condition VARCHAR(20),
      ADD COLUMN IF NOT EXISTS unit_condition_other VARCHAR(120),
      ADD COLUMN IF NOT EXISTS customer_reported_issue TEXT,
      ADD COLUMN IF NOT EXISTS technician_diagnosis TEXT,
      ADD COLUMN IF NOT EXISTS service_requested TEXT,
      ADD COLUMN IF NOT EXISTS expected_completion VARCHAR(120),
      ADD COLUMN IF NOT EXISTS consent_software_install BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS consent_data_backup_ack BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS released_by VARCHAR(120);
  `);

  intakeReady = true;
}
