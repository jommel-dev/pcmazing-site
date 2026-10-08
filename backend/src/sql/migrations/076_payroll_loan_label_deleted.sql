-- Loan display label + soft-delete status for Employee tools UX.

ALTER TABLE pcmazing_payroll_loans
  ADD COLUMN IF NOT EXISTS label VARCHAR(120);

UPDATE pcmazing_payroll_loans
SET label = 'Loan #' || id::text
WHERE label IS NULL OR BTRIM(label) = '';

ALTER TABLE pcmazing_payroll_loans
  ALTER COLUMN label SET NOT NULL;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'pcmazing_payroll_loans'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ~* 'status'
  LOOP
    EXECUTE format('ALTER TABLE pcmazing_payroll_loans DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;

ALTER TABLE pcmazing_payroll_loans
  DROP CONSTRAINT IF EXISTS ck_pcmazing_payroll_loans_status;

ALTER TABLE pcmazing_payroll_loans
  ADD CONSTRAINT ck_pcmazing_payroll_loans_status
  CHECK (status IN ('active', 'paid', 'cancelled', 'deleted'));
