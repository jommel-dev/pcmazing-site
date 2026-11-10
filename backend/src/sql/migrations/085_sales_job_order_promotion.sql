-- Optional promotion label for sales orders and job orders (shown on receipts).

ALTER TABLE pcmazing_sales_orders
  ADD COLUMN IF NOT EXISTS promotion VARCHAR(180);

ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS promotion VARCHAR(180);
