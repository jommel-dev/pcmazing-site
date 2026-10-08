-- Equal-installment loans retain principal/count as a stable per-period amount.
ALTER TABLE pcmazing_payroll_loans
  DROP CONSTRAINT IF EXISTS ck_pcmazing_payroll_loans_term;

UPDATE pcmazing_payroll_loans
SET fixed_installment_amount = ROUND(principal / installment_count, 2)
WHERE term_style = 'equal_installments'
  AND fixed_installment_amount IS NULL;

ALTER TABLE pcmazing_payroll_loans
  ADD CONSTRAINT ck_pcmazing_payroll_loans_term
  CHECK (
    (term_style = 'equal_installments'
      AND installment_count IS NOT NULL
      AND fixed_installment_amount IS NOT NULL)
    OR
    (term_style = 'fixed_per_cutoff'
      AND installment_count IS NULL
      AND fixed_installment_amount IS NOT NULL)
  );
