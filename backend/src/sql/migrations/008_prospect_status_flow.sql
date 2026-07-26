-- Extend prospect status values for consultation progress flow
ALTER TABLE pcmazing_client_prospects
  DROP CONSTRAINT IF EXISTS pcmazing_client_prospects_status_check;

ALTER TABLE pcmazing_client_prospects
  ADD CONSTRAINT pcmazing_client_prospects_status_check
  CHECK (status IN (
    'available',
    'picked_up',
    'called',
    'emailed',
    'no_response',
    'meeting_set',
    'closed_won',
    'closed_lost'
  ));
