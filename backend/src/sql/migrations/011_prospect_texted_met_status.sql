-- Follow-up method statuses: text -> texted, meet -> met
ALTER TABLE pcmazing_client_prospects
  DROP CONSTRAINT IF EXISTS pcmazing_client_prospects_status_check;

ALTER TABLE pcmazing_client_prospects
  ADD CONSTRAINT pcmazing_client_prospects_status_check
  CHECK (status IN (
    'available',
    'picked_up',
    'called',
    'texted',
    'emailed',
    'met',
    'no_response',
    'meeting_set',
    'closed_won',
    'closed_lost'
  ));
