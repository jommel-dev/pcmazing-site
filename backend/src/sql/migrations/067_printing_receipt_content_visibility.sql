ALTER TABLE pcmazing_printing_settings
  ADD COLUMN IF NOT EXISTS show_warranty_policy BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_footer_note BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS show_thanks_message BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN pcmazing_printing_settings.show_warranty_policy IS
  'When false, warranty policy is omitted from receipt printouts.';

COMMENT ON COLUMN pcmazing_printing_settings.show_footer_note IS
  'When false, footer note is omitted from receipt printouts.';

COMMENT ON COLUMN pcmazing_printing_settings.show_thanks_message IS
  'When false, thank-you message is omitted from receipt printouts.';
n