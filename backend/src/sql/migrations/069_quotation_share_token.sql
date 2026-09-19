ALTER TABLE pcmazing_quotations
  ADD COLUMN IF NOT EXISTS share_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS share_token_created_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcmazing_quotations_share_token
  ON pcmazing_quotations (share_token)
  WHERE share_token IS NOT NULL AND deleted_at IS NULL;
