ALTER TABLE pcmazing_local_price_stores
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
