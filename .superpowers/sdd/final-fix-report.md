# Whole-Branch Payroll Review Fix Report

## Changes

- Late deductions now exclude configured rest days and plotted employee day-off dates across period summaries, previews, generation, and regeneration.
- Payroll settings reject out-of-range `HH:MM` shift start values before they reach PostgreSQL.
- Admin period rows and previews warn when deductions exceed gross pay and net is floored at ₱0.
- Existing payslips show **Regenerate needed** when the stored `estimated_pay` differs from the live assembled net.
- Existing payslips reuse their stored loan-deduction total in period summaries, preventing later loan balance or status changes from causing false **Regenerate needed** flags while commissions, late deductions, and manual deductions remain live.
- Payslip preview ledger assembly is non-locking.
- The payroll design spec now documents frozen equal-installment amounts; custom and skipped periods extend the schedule until the balance is paid.

## Verification

- `npm test -- --runInBand src/admin/payroll` (backend): 13 suites, 53 tests passed.
- `npm run build` (backend): passed.
- `npm run build` (frontend): passed with pre-existing CSS budget warnings.
- IDE diagnostics for all edited TypeScript and template files: no errors.
