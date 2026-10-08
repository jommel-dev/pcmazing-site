# Task 7 Report — Payslip ledger, remarks, and loan balance

## Status

Implemented.

## Changes

- Added focused `payroll-payslip-ledger.util.ts` assembly for commission, manual deduction, per-day late, and loan lines using the existing Asia/Manila and loan/net helpers.
- Generate now computes net pay, upserts each payslip without overwriting remarks, replaces its ledger snapshot transactionally, and updates `estimated_pay`.
- Loan balances change only during generate. Regeneration first reverses the prior payslip's loan ledger amounts, preventing duplicate deductions, then applies the replacement snapshot and marks zero-balance loans paid.
- Preview returns the same lines and base/overtime/net breakdown without writes.
- Employee payslip detail returns lines, remarks, base pay, overtime pay, net pay, and the full breakdown; employee-workspace already forwards this mapper.
- Added `PATCH /admin/payroll/payslips/:id/remarks` protected by `payroll.edit`.
- Extended the PDF payload/renderer with optional remarks support. Query-controlled inclusion remains for Task 9.

## Structure

`payroll.service.ts` was already large, so pure ledger assembly was placed in a focused helper module. Database loading and transactional persistence remain in the service.

## Verification

- `npm test -- --runInBand` — 19 suites, 88 tests passed.
- `npm run build` — passed.
- ESLint on all changed payroll files — passed.
- `git diff --check` on Task 7 files — passed (only Windows line-ending notices).

## Concerns

- Payslip base/overtime detail remains derived from attendance/profile data, matching the existing detail design; only ledger lines and net pay are persisted snapshots.

## Review Fix — 2026-10-08

- Employee payslip detail now selects and returns `p.remarks`, and forwards it into the PDF payload.
- Each payslip upsert, prior loan-deduction reversal, ledger replacement, replacement loan deduction, and final net-pay update now use one database transaction.
- Regeneration locks the payslip row with `SELECT ... FOR UPDATE` before reading prior loan ledger lines, serializing concurrent replacements and preventing duplicate loan credits.
- Remarks validation now requires the `remarks` key while continuing to allow an explicit `null`.
- Added regression coverage for remarks selection/validation and transaction/lock ordering.

### Review Fix Verification

- `npm test -- --runInBand admin/payroll` — 11 suites, 45 tests passed.
- `npm run build` — passed.
- ESLint on the five changed payroll TypeScript files — passed.
- Cursor diagnostics on the five changed payroll TypeScript files — no errors.
