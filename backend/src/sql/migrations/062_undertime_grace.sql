-- Owner-agreed undertime: leave up to N minutes early and still count as a paid full day.

ALTER TABLE pcmazing_payroll_settings
  ADD COLUMN IF NOT EXISTS undertime_grace_minutes SMALLINT NOT NULL DEFAULT 30;

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS undertime_category VARCHAR(30);

COMMENT ON COLUMN pcmazing_payroll_settings.undertime_grace_minutes IS
  'Minutes before 9h that still count as a full paid day. Default 30.';
COMMENT ON COLUMN pcmazing_attendance.undertime_category IS
  'emergency | appointment | event | other. Why the employee left early.';
