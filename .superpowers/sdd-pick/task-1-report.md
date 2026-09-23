# Task 1 Report: Backend time-in accepts pick + stores it

## Status
**DONE**

## Summary
Time-in now requires an explicit `office` | `wfh` pick (controller + service), stores it on attendance via updated `resolvePunchLocation`, and always reports `locationMismatch: false`. Schedule still drives Off soft-message / `expectedLocation`; payslip math untouched. Frontend not changed.

## Changes
### `backend/src/admin/payroll/payroll.service.ts`
- `timeIn(username, selfie, workLocationType: 'office' | 'wfh', location?)` — validates pick; rejects anything else with `BadRequestException('Choose Office or Work from home before time in.')`.
- `resolvePunchLocation(picked, location?)` — uses pick (not schedule) for `workLocationType`; stores GPS/label only when `picked === 'wfh'`; `locationMismatch` always `false`.
- `getTimeClockStatus` / `emptyTimeClockLocationFields`: `locationMismatch: false` always; Off-day soft message kept when `expectedLocation === 'off'`.
- INSERT columns unchanged.

### `backend/src/admin/payroll/time-clock.controller.ts`
- Accepts `@Body('workLocationType')`; same pick validation before calling service.
- Empty status (no username): `locationMismatch: false`.

## Verification
- `cd backend; npx tsc --noEmit -p tsconfig.build.json` → **exit 0**

## Commit
- `Accept Office/WFH pick on time-in and store on attendance.`
- Files: `payroll.service.ts`, `time-clock.controller.ts` only.

## Concerns / follow-ups
- Existing clients that POST time-in without `workLocationType` will get 400 until frontend (later task) sends the pick.
- Status API now always returns `locationMismatch: false` (including for rows that may have stored `true` from older Off-mismatch behavior); DB column may still hold historical values until re-punched.
- Pay math / period rates still use schedule expectation (Task 2).
