-- Optional manual receipt total on sales orders (same idea as job orders).

ALTER TABLE pcmazing_sales_orders
  ADD COLUMN IF NOT EXISTS manual_total_amount NUMERIC(12, 2) NULL;
