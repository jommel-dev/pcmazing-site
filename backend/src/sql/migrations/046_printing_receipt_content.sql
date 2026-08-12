ALTER TABLE pcmazing_printing_settings
  ADD COLUMN IF NOT EXISTS warranty_policy TEXT NOT NULL DEFAULT $warranty$
"PCmazing Warranty Policy"
Major PC Parts: 1-Year Warranty, 5-Day Replacement (Factory Defects Only)
PC Accessories: 5-Day Replacement, 1-Month Warranty (Factory Defects Only)
Original Receipt Required — NO RECEIPT, NO WARRANTY
Monitor dead pixels are NOT covered under replacement/warranty.
Physical, liquid, electrical, accidental, or customer-caused damage voids the warranty.
By purchasing this product, you acknowledge that you have read, understood, and accepted the terms and conditions of this warranty policy.
$warranty$,
  ADD COLUMN IF NOT EXISTS footer_note VARCHAR(500) NOT NULL DEFAULT 'This slip is not valid for input tax',
  ADD COLUMN IF NOT EXISTS thanks_message VARCHAR(500) NOT NULL DEFAULT 'Thanks for shopping with us!';

COMMENT ON COLUMN pcmazing_printing_settings.warranty_policy IS
  'Editable warranty policy block shown on sales receipts.';

COMMENT ON COLUMN pcmazing_printing_settings.footer_note IS
  'Footer note shown below the warranty block on receipts.';

COMMENT ON COLUMN pcmazing_printing_settings.thanks_message IS
  'Closing thank-you message shown on receipts.';
