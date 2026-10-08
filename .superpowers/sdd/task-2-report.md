# Task 2 Report: Migration 074

## Status

Completed Migration 074 for payroll loans, period overrides, commission types and entries, manual deductions, persisted payslip ledger lines, late-deduction settings, and payslip remarks.

## Implementation

- Added `backend/src/sql/migrations/074_payroll_ledger_loans_commissions.sql`.
- Added `backend/scripts/apply-payroll-ledger-migration.mjs` with transactional execution, SHA-256 migration tracking, and post-apply schema verification.
- Synchronized the same DDL into the `ensurePayrollTables` path in `backend/src/admin/payroll/payroll.schema.ts`.
- Added the four payroll settings fields:
  - `shift_start_time`
  - `late_grace_minutes`
  - `late_deduction_fixed`
  - `late_deduction_per_minute`
- Added nullable `remarks` to `pcmazing_generated_payslips`.
- Added all six requested tables with foreign keys, checks, timestamps, period indexes, and lookup indexes.
- Commission entries, manual deductions, and loan overrides use nullable `payroll_run_id` plus required `date_from` / `date_to`, allowing pre-generation staging and later run attachment.

## Apply and Verification

Executed from `backend`:

```text
node scripts/apply-payroll-ledger-migration.mjs
```

Result:

```json
{
  "ok": true,
  "filename": "074_payroll_ledger_loans_commissions.sql",
  "tables": 6,
  "settings_columns": 4,
  "remarks_column": 1
}
```

The apply script was executed a second time with the same successful result, confirming the migration's idempotent apply path against the local `DATABASE_URL`.

Additional verification:

- `npm test -- --runInBand src/admin/payroll/payroll-ledger.util.spec.ts`: 1 suite passed, 12 tests passed.
- `npm run build`: passed.
- IDE diagnostics for the changed schema and apply script: no linter errors.
- Scoped `git diff --check` for the three implementation files: passed.

## Commit

- `a52282f feat(payroll): migration for loans commissions ledger remarks`

Only the three implementation files listed in the brief were included in the commit. Existing unrelated `.superpowers/sdd` working-tree changes were left untouched.

## Concerns

- This task is schema-only; service/API integration and mutation of loan balances remain for later tasks.
- `payroll_run_id` uses `ON DELETE SET NULL`, preserving staged period identity through `date_from` / `date_to` if a payroll run is deleted.
# Task 2 Report: Schema + profile API (`wfhSalary`)

## Status

**DONE_WITH_CONCERNS**

## Commits

| SHA | Subject |
|-----|---------|
| `fda62c6` | Add wfh_salary to payroll profile API. |

## Files created

- `backend/src/sql/migrations/071_office_wfh_daily_rates.sql` — `ADD COLUMN IF NOT EXISTS wfh_salary NUMERIC(12, 2)`

## Files modified

- `backend/src/admin/payroll/payroll.schema.ts` — same `ALTER` appended beside weekly location ensure columns
- `backend/src/admin/payroll/dto/payroll-profile-fields.dto.ts` — optional `wfhSalary` (mirrors `monthlySalary`)
- `backend/src/admin/payroll/payroll.service.ts` — `PayrollProfile` / `EMPTY_PAYROLL` / `PayrollEmployeeRecord`, SELECTs, `upsertProfile`, `mapProfile`, `listEmployees`
- `backend/src/admin/users/users.types.ts` — `AdminUserRecord.wfhSalary`
- `backend/src/admin/users/users.service.ts` — create/update upsert + `attachPayrollProfiles`

## Steps completed

1. Migration SQL + ensure ALTER
2. DTO field for `wfhSalary`
3. Service profile plumbing (get/upsert/list/map; no day-pay calculation changes)
4. Users attach on create/update/list profiles
5. Typecheck
6. Commit (brief file list only)

## Typecheck

Command:

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```

Result: exit 0 (no errors)

## Self-review

- `wfhSalary` / `wfh_salary` mirrored after `monthlySalary` / `monthly_salary`; no renames of existing monthly fields.
- `buildPayslipDaysAndTotals` / `buildPeriodRow` left unchanged (Task 3).
- Create/Update user DTOs inherit `wfhSalary` via `PayrollProfileFieldsDto`.
- Weekly-location fields already present in the same working-tree files were preserved, not removed.

## Concerns

- Shared files (`payroll.service.ts`, `payroll.schema.ts`, DTO, users attach) already contained uncommitted weekly-location work. Committing the brief’s file list also included that weekly-location plumbing in those files (not just `wfh_salary`).
- `backend/src/admin/payroll/work-location.util.ts` remains untracked; committed imports from that module typecheck locally only because the file exists on disk. A clean checkout of this commit alone would fail until that util (and related weekly-location WIP) is committed.
- `AdminUserPayrollProfile` was not updated with `wfhSalary` (brief only required `AdminUserRecord`); attach still returns it on `AdminUserRecord`.

## Test summary

Backend `tsc --noEmit -p tsconfig.build.json` passed (exit 0). No new unit tests in this task.
