# Task 2 Report: Pay from punched location type

## Status
**DONE**

## Summary
Period and payslip day pay now use punched `work_location_type` (`office` | `wfh`) via `pickSalaryAmountForLocation`. Null or `off` on the punch → unpaid (units/OT gated). Schedule `resolveExpectedLocation` is no longer used for rates or unpaid gates. Fixed monthly no longer zeros units merely because the schedule is Off.

## Changes
### `backend/src/admin/payroll/payroll.service.ts`
- Punch SELECTs for period preview, payslip preview, and payslip detail now include `work_location_type`.
- `buildPayslipDaysAndTotals` / `buildPeriodRow` punch row types include `work_location_type: string | null`.
- Day pay / OT unpaid gates use `normalizeStoredLocationType(row.work_location_type)`; label suffix uses `locationPayLabelSuffix(punchedType ?? 'off')`.

## Verification
- `cd backend; npx tsc --noEmit -p tsconfig.build.json` → **exit 0**

## Commit
- `Use punched work location for Office vs WFH day pay.`
- File: `payroll.service.ts` only.

## Concerns / follow-ups
- Legacy punches with null/`off` stored type remain unpaid until re-punched with office/wfh.
- `weeklyLocationSchedule` is still passed into `buildPayslipDaysAndTotals` but unused for day pay (schedule remains for UI/status elsewhere).
- Frontend time-clock pick UI still out of scope.
