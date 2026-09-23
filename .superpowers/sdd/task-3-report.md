# Task 3 Report: Period + payslip day pay uses location rates

## Status

**DONE**

## Commits

| SHA | Subject |
|-----|---------|
| `283e0c4` | Apply Office vs WFH rates in period and payslip day pay. |

## Files modified

- `backend/src/admin/payroll/payroll.service.ts` — location-aware day pay in `buildPayslipDaysAndTotals` / `buildPeriodRow`; callers pass `wfhSalary` + `weeklyLocationSchedule`; payslip detail loads those from `pcmazing_user_payroll`

## Steps completed

1. Updated `buildPayslipDaysAndTotals` to resolve expected location per day, pick Office/WFH amount, zero pay on Off, append location label suffixes; non-fixed totals from sum of `dayPay` + OT
2. Passed `wfhSalary` / `weeklyLocationSchedule` from preview payslip builder and `getEmployeePayslipDetail`
3. Updated `buildPeriodRow` to accept `workWeek` and compute estimated pay per punch with location rates
4. Typecheck
5. Commit (only `payroll.service.ts`)

## Typecheck

Command:

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```

Result: exit 0 (no errors)

## Self-review

- Scheduled location drives rate via `resolveExpectedLocation` + `pickSalaryAmountForLocation`; punch GPS unused.
- Fixed monthly still uses `estimatePay` / scheduled fixed path; location amounts ignored; Off days contribute 0 paid units; location suffix still shown on punched days.
- Non-fixed `basePay` / `estimatedPay` sum per-day `dayPay` (+ OT), not single-amount `estimatePay`.
- Both callers of `buildPayslipDaysAndTotals` and the `buildPeriodRow` caller updated.

## Concerns

- Stored payslip `salary_amount` remains the office amount at generation time; WFH rate and schedule for PDF/detail rebuild come from live `pcmazing_user_payroll` (profile changes after generation can change day breakdown).
- `describePayBasis` still describes office `salaryAmount` only (no dual-rate summary text).

## Test summary

Backend `tsc --noEmit -p tsconfig.build.json` passed (exit 0). No new unit tests in this task.
