-- Client type, currency, and deal pricing for prospects
ALTER TABLE pcmazing_client_prospects
  ADD COLUMN IF NOT EXISTS client_type VARCHAR(20) NOT NULL DEFAULT 'local'
    CHECK (client_type IN ('local', 'international')),
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'PHP',
  ADD COLUMN IF NOT EXISTS proposed_price_deal NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS estimated_price_deal_php NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS exchange_rate_used NUMERIC(18, 8),
  ADD COLUMN IF NOT EXISTS exchange_rate_date DATE;

COMMENT ON COLUMN pcmazing_client_prospects.client_type IS 'Local or international client classification.';
COMMENT ON COLUMN pcmazing_client_prospects.currency IS 'ISO 4217 currency code for proposed deal price.';
COMMENT ON COLUMN pcmazing_client_prospects.proposed_price_deal IS 'Proposed deal amount in the selected currency.';
COMMENT ON COLUMN pcmazing_client_prospects.estimated_price_deal_php IS 'PHP equivalent when currency is not PHP.';
