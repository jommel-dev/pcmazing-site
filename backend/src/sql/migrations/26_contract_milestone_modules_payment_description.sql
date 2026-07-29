-- Allow milestones to link multiple modules (comma-separated sort orders).
-- Add payment description for itemized payment schedule UI.

ALTER TABLE pcmazing_client_contract_milestones
  ALTER COLUMN connected_module_sort_order TYPE TEXT
  USING CASE
    WHEN connected_module_sort_order IS NULL THEN NULL
    ELSE connected_module_sort_order::text
  END;

ALTER TABLE pcmazing_client_contract_payment_schedules
  ADD COLUMN IF NOT EXISTS description TEXT;
