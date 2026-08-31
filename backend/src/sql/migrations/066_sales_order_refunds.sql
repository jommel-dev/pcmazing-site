ALTER TABLE pcmazing_sales_orders
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refunded_by BIGINT;

ALTER TABLE pcmazing_sales_order_items
  ADD COLUMN IF NOT EXISTS refunded_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_sales_orders.refund_reason IS
  'Explanation for item refunds on this sales order.';

COMMENT ON COLUMN pcmazing_sales_orders.refund_amount IS
  'Cumulative amount refunded to the customer for returned items.';

COMMENT ON COLUMN pcmazing_sales_order_items.refunded_quantity IS
  'Quantity of this line item returned and restocked.';
