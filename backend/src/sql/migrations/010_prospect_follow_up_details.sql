-- Structured follow-up fields on client responses
ALTER TABLE pcmazing_client_responses
  ADD COLUMN IF NOT EXISTS follow_up_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE pcmazing_client_responses
  DROP CONSTRAINT IF EXISTS pcmazing_client_responses_response_type_check;

ALTER TABLE pcmazing_client_responses
  ADD CONSTRAINT pcmazing_client_responses_response_type_check
  CHECK (response_type IN ('call', 'email', 'sms', 'meeting', 'follow_up', 'other'));

COMMENT ON COLUMN pcmazing_client_responses.follow_up_method IS
  'text, call, email, or meet';
