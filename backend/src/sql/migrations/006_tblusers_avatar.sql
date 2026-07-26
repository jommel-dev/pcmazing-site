-- Ensure avatar column exists on tblusers (3BMA-compatible user table).

ALTER TABLE IF EXISTS tblusers
  ADD COLUMN IF NOT EXISTS avatar TEXT;
