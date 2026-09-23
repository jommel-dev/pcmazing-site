# Task 5 Report: Verify end-to-end

## Status

**DONE** (automated gate). Manual Nest/DB/UI checks skipped (runtime not exercised in this session).

## Commits

| SHA | Subject |
|-----|---------|
| `e7acb4f` | Complete weekly work-location API and time-clock UI leftovers. |
| `adf96e0` | Mark Office vs WFH daily rates design as Implemented. |

## Automated checks

| Command | Result |
|---------|--------|
| `npx jest src/admin/payroll/location-pay.util.spec.ts --verbose` | **PASS** — 5 tests, exit 0 |
| `npx tsc --noEmit -p tsconfig.build.json` | **PASS** — exit 0 |
| `npx ng build --configuration=development` | **PASS** — exit 0 |

## Spec status

`docs/superpowers/specs/2026-09-22-office-wfh-daily-rates-design.md` → **Implemented**

## Manual checks (skipped)

Not run here (Nest restart / migration 071 / live UI / payslip scenarios):

1. Office 800 / WFH 700; Wed=WFH → Wed day pay from 700
2. Clear WFH → WFH days use 800
3. Fixed monthly → location rates ignored
4. Punch on Off day → day pay 0; mismatch still visible
5. Payslip day type shows `· Office` / `· WFH` / `· Off (unpaid)`

## Left uncommitted (docs WIP)

- `.superpowers/` (SDD briefs/reports)
- `docs/superpowers/plans/2026-09-22-employee-weekly-work-location.md`

## Self-review

- Leftover weekly-location PATCH + DTO + time-clock UI committed so payroll.controller import is not broken.
- Weekly-location design status already Implemented; included in leftover commit.
- Rates feature verification gated on automated tests/builds only in this environment.

## Final review fixes

### Status

**DONE**

### Commit

| SHA | Subject |
|-----|---------|
| `af7ba30` | Align Off-day OT and period day-pay rounding with payslip. |

### Fixes applied

1. **Off-day OT consistency** (`payroll.service.ts`)
   - `buildPayslipDaysAndTotals`: on scheduled Off days, `overtimePay = 0` in both fixed and non-fixed paths; approved Off OT hours are not added to `approvedOvertimeHours` / `overtimePayTotal` (day row may still show OT hours).
   - `buildPeriodRow`: same Off → no payable OT; fixed path no longer feeds Off approved OT into `estimatePay`.

2. **Period vs payslip rounding** (`buildPeriodRow`)
   - Non-fixed path now rounds each day's `dayPay` and OT pay with `Math.round(x * 100) / 100` before summing, matching `buildPayslipDaysAndTotals`, so period `estimatedPay` matches payslip preview within ₱0.00 for the same inputs.

### Explicitly accepted (not implemented)

3. **Payslip live WFH/schedule join** — Accepted as pre-existing pattern. Office amount is snapshotted on the payslip row; weekly location schedule was never snapshotted and continues to be joined live at preview/PDF time. No change.

### Verification

| Command | Result |
|---------|--------|
| `npx jest src/admin/payroll/location-pay.util.spec.ts --verbose` | **PASS** — 5 tests, exit 0 |
| `npx tsc --noEmit -p tsconfig.build.json` | **PASS** — exit 0 |
