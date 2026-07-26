-- Track follow-up attempts per pickup cycle (max 3 before loss or return to pool)
ALTER TABLE pcmazing_client_prospects
  ADD COLUMN IF NOT EXISTS follow_up_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN pcmazing_client_prospects.follow_up_count IS
  'Follow-up attempts (called/emailed/no response) in the current pickup cycle. Resets on pickup or return to available.';
