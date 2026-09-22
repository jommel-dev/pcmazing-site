# Time-Clock Office / WFH Pick (Overrides Schedule for Punch + Pay)

**Date:** 2026-09-22  
**Status:** Implemented  
**Approach:** Employee picks Office or WFH at time-in; store on attendance; pay from punch type

## Goal

Even when a weekly schedule exists, let the employee choose **Office** or **WFH** on the time clock before time-in. That choice is stored on the punch and drives Office vs WFH daily rates. The schedule remains the default pre-selection and admin planning tool.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Pick controls | Tagging **and** pay |
| Off scheduled days | Picker still shown; soft warning; paid at picked rate this slice; approval later |
| Default selection | Pre-select from schedule when Office/WFH; Off → no pre-select (must choose) |
| Mismatch flag | Do **not** set `locationMismatch` for Off or schedule≠pick |
| Storage | Existing `work_location_type` on attendance |
| Time-out | No picker |

## Scope

### In scope

1. Time-clock UI: Office / WFH control before Time In (required).  
2. `POST time-in` accepts required `workLocationType` (`office` \| `wfh`).  
3. Server stores client pick (not schedule) on `work_location_type`.  
4. WFH pick → existing GPS + optional label; Office pick → no GPS.  
5. Period / payslip day pay uses punched `work_location_type` via existing Office/WFH rate helpers.  
6. Soft Off banner when schedule is Off; no mismatch flag for this feature.

### Out of scope

- Off-day pay approval workflow  
- New/separate `actual_location_type` column  
- Setting `locationMismatch` for schedule divergences  
- Rewriting historical punches when schedule edits  

## Architecture

```
Time clock status → expectedLocation (schedule) for banner + default pick
        │
Employee selects Office | WFH
        │
POST time-in (selfie + workLocationType + optional GPS/label if WFH)
        │
pcmazing_attendance.work_location_type = pick
        │
Period / payslip → pickSalaryAmountForLocation(punchType, office, wfh)
```

## API

### Status (unchanged fields + usage)

- `expectedLocation`: still from weekly schedule (UI default + Off banner).

### Time-in

Multipart fields (in addition to `username`, `selfie`):

- `workLocationType` — required — `office` | `wfh`  
- Existing: `locationLat`, `locationLng`, `locationLabel` when WFH  

Server rejects missing/invalid `workLocationType`. Ignores client attempts to send `off`.

## Pay rules (change from schedule-driven)

For each punched day (when fixed monthly is not set):

1. Read `work_location_type` from attendance (`office` \| `wfh`).  
2. If missing/null → treat as unpaid for that day (should not happen for new punches).  
3. Apply `pickSalaryAmountForLocation` with that type (WFH blank → Office rate).  
4. Off **schedule** no longer forces unpaid if they punched with Office/WFH.

Fixed monthly: unchanged (ignores location rates).

## UI

- Banner: “Today: …” from schedule.  
- Control: Office / WFH radios or segmented control before Time In.  
- Off day: warning + empty selection until user picks.  
- Choosing WFH reveals GPS/label UI (same as today’s WFH path).  
- Time Out: no location picker.

## Testing / verification

1. Schedule Office, pick WFH → WFH stored, GPS path, WFH rate on payslip.  
2. Schedule WFH, keep default → WFH rate.  
3. Schedule Off → must pick; soft warning; paid at pick; `locationMismatch` false.  
4. Time In without pick on Off day → blocked client-side and rejected server-side.  
5. Office pick → no GPS required.

## Risks

- Employees may always pick the higher rate; mitigated later by Off approval / audit, not this slice.  
- Legacy punches with schedule-derived `off` or null types need safe unpaid fallback in pay math.  
- Live schedule still used only for defaults/banner, not for historical pay after punch.

## Related

- Weekly schedule: `docs/superpowers/specs/2026-09-22-employee-weekly-work-location-design.md`  
- Dual rates: `docs/superpowers/specs/2026-09-22-office-wfh-daily-rates-design.md` (pay source shifts from schedule → punch for this feature)
