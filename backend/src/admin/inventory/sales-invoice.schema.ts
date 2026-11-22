import { DatabaseService } from '../../database/database.service';
import { tableExists } from '../common/admin-table.util';

let invoiceReady = false;

/** Ensures Sales Invoice columns exist (migration 089). */
export async function ensureSalesInvoiceColumns(
  databaseService: DatabaseService,
): Promise<void> {
  if (invoiceReady) {
    return;
  }

  if (!(await tableExists(databaseService, 'pcmazing_sales_orders'))) {
    invoiceReady = true;
    return;
  }

  await databaseService.query(`
    ALTER TABLE pcmazing_sales_orders
      ADD COLUMN IF NOT EXISTS customer_address TEXT,
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(64),
      ADD COLUMN IF NOT EXISTS business_style VARCHAR(255),
      ADD COLUMN IF NOT EXISTS ship_to_address TEXT,
      ADD COLUMN IF NOT EXISTS sales_type VARCHAR(20) NOT NULL DEFAULT 'cash',
      ADD COLUMN IF NOT EXISTS customer_po_no VARCHAR(120),
      ADD COLUMN IF NOT EXISTS salesperson VARCHAR(120),
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(120),
      ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(120),
      ADD COLUMN IF NOT EXISTS withholding_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0;
  `);

  if (await tableExists(databaseService, 'pcmazing_sales_order_items')) {
    await databaseService.query(`
      ALTER TABLE pcmazing_sales_order_items
        ADD COLUMN IF NOT EXISTS serial_no VARCHAR(120),
        ADD COLUMN IF NOT EXISTS unit VARCHAR(40) NOT NULL DEFAULT 'PCS';
    `);
  }

  invoiceReady = true;
}
