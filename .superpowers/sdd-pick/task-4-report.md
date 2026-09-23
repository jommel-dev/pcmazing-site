# Task 4 Report: Verify time-clock Office/WFH pick

## Status
**DONE**

## Automated
| Check | Result |
|-------|--------|
| `cd backend; npx tsc --noEmit -p tsconfig.build.json` | **exit 0** |
| `cd frontend; npx ng build --configuration=development` | **exit 0** (bundle ~5.63 MB, ~18s) |

## Spec status
- `docs/superpowers/specs/2026-09-22-time-clock-location-pick-design.md` → **Status: Implemented**
- Commit: `020dddd` — `Mark time-clock Office/WFH pick design as Implemented.`

## Manual Nest / UI
### Quick check (done)
- Nest `npm run start:dev` already running; log shows **Nest application successfully started** on port 3001.
- `GET http://localhost:3001/payroll/time-clock/now` → `{"success":true,"data":{"serverNow":"...","workDate":"2026-09-22"}}`.
- `TimeClockController` `@Post('time-in')` accepts `workLocationType` in code.

### Skipped (needs authenticated employee + schedule fixtures)
1. Schedule Office → picker defaults Office; pick WFH → GPS; payslip WFH rate.
2. Schedule WFH → default WFH.
3. Schedule Off → empty pick; warning; must choose; paid; mismatch false.
4. Time In without pick on Off → blocked.

No browser login/credentials or schedule seed available in this session for those four scenarios.

## Concerns / follow-ups
- Manual punch/pay matrix still recommended before production use.

## Final review fixes

### Done
1. **`expectedLocation` after punch** (`getTimeClockStatus`): always from `resolveExpectedLocation(profile.weeklyLocationSchedule, workWeek, workDate)`. No longer overwritten by attendance `work_location_type`. Punch still supplies `locationLabel` / lat / lng; `locationMismatch` stays `false`.
2. **Dead inputs removed**: dropped unused `weeklyLocationSchedule` from `buildPayslipDaysAndTotals` (and both callers); dropped unused `workWeek` from `buildPeriodRow` signature/caller. `tsc --noEmit -p tsconfig.build.json` exit 0.

### Deferred
3. **Unit tests** for post-punch `expectedLocation` stay schedule-based: deferred — would need a service-level extract/refactor; `resolveExpectedLocation` already covered by existing util usage.
