# Per-Employee Weekly Work Location + WFH GPS Tag

**Date:** 2026-09-22  
**Status:** Implemented  
**Approach:** Weekly schedule on payroll profile + same clock-in flow with WFH GPS/label

## Goal

Let admins set each employee’s weekly Office / WFH / Off schedule (editable from Payroll and User Management), surface expected location on attendance, and on WFH days capture GPS plus an optional location label at clock-in—without changing the selfie + server-time punch flow.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Scope of first slice | Settings + display + attendance tagging + soft off-day warning |
| Clock-in difference | Same for Office and WFH (selfie + server time); WFH adds location tag |
| Location tag | Auto GPS + optional editable label |
| Admin UI | Both Payroll → Employees and User Management |
| Storage | Per-employee repeating Mon–Sun map on payroll profile |
| Default schedule | If unset: global work week → workdays `office`, rest `off` |
| Off-day punch | Soft: allow clock-in with warning / mismatch tag (no hard block) |

## Scope

### In scope

1. `weekly_location_schedule` on `pcmazing_user_payroll` (JSON map Mon–Sun → `office` | `wfh` | `off`).
2. Shared read/update via existing payroll profile APIs (used by User Management and Payroll Employees).
3. UI editors in User Management payroll section and Payroll → Employees.
4. Attendance columns for `work_location_type`, `location_lat`, `location_lng`, `location_label` (time-in; time-out optional if already structured for dual punches).
5. Time-clock: resolve today’s expected location; on WFH require/attempt GPS + optional label; store tags.
6. Admin attendance views show expected vs actual location tag.
7. Time-clock / employee-facing UI shows “Today: Office|WFH|Off”.

### Out of scope

- One-off calendar exceptions
- Geofencing / radius enforcement
- Different pay rates for WFH vs office
- Hard-blocking clock-in on Off days
- Changing global `work_week` semantics beyond using it as default seed

## Architecture

```
Admin (Payroll Employees / User Management)
        │
        ▼
PATCH payroll profile (weekly_location_schedule)
        │
        ▼
pcmazing_user_payroll.weekly_location_schedule

Time clock time-in/out
        │
        ├─ resolve expected location for Manila work_date
        ├─ selfie + server NOW() (unchanged)
        └─ if wfh → GPS + optional label → attendance row
```

### Components

| Unit | Responsibility |
|------|----------------|
| Migration / schema ensure | Add schedule JSON + attendance location columns |
| `PayrollService` profile get/update | Persist/validate weekly schedule |
| Time-clock punch paths | Resolve expected day type; store location fields on WFH |
| Payroll page Employees UI | Week-day picker per employee |
| User Management form | Same week-day picker in payroll section |
| Attendance list/detail UI | Show expected + actual tags |
| Time-clock frontend | Show today label; request geolocation + label when WFH |

## Data model

### `pcmazing_user_payroll.weekly_location_schedule` (JSONB, nullable)

Example:

```json
{
  "mon": "office",
  "tue": "office",
  "wed": "wfh",
  "thu": "office",
  "fri": "office",
  "sat": "off",
  "sun": "off"
}
```

Validation: all seven keys present when provided; each value ∈ `office` | `wfh` | `off`.

### `pcmazing_attendance` additions

- `work_location_type` VARCHAR — `office` | `wfh` | `off` | `unscheduled` (expected at punch time)
- `location_lat` NUMERIC (nullable)
- `location_lng` NUMERIC (nullable)
- `location_label` VARCHAR(200) (nullable)
- Optional: `location_mismatch` BOOLEAN if punched on `off` (or expected off) — **locked: set true when expected is `off`**

GPS/label primarily required on **time-in** when expected is `wfh`. If GPS permission denied, still allow punch but store type `wfh` with null coords and a note/flag that GPS was unavailable (soft).

## Default schedule resolution

1. If `weekly_location_schedule` is non-null and valid → use it.  
2. Else map global `work_week`:
   - `mon_fri` → Mon–Fri `office`, Sat–Sun `off`
   - `mon_sat` → Mon–Sat `office`, Sun `off`
   - `day_off_basis` → all days `office` except explicit day-offs stay outside this map (day-offs already handled separately); for unset schedule treat calendar workdays as `office`

## API

Extend existing payroll profile payload:

- `weeklyLocationSchedule: Record<DayKey, 'office'|'wfh'|'off'> | null`

Time-clock:

- Status/today endpoint returns `expectedLocation` for current Manila date.
- `POST time-in` / `time-out` accept optional `locationLat`, `locationLng`, `locationLabel` (multipart or JSON fields alongside selfie).
- Server sets `work_location_type` from schedule; ignores client-supplied type.

## UI

### Admin editors

Seven-day row: Mon … Sun, each a select (Office / WFH / Off). Save with payroll profile. Show compact chips on Employees table (e.g. “W: WFH”).

### Time clock

- Banner: “Today: Work from home” / “Office” / “Day off”.
- On WFH: request `navigator.geolocation`; show optional label input; submit with punch.
- On Off: warning toast/banner that today is scheduled off; punch still allowed.

### Attendance

Column or badge: expected + actual (e.g. `WFH · Home – Cabanatuan` or coords truncated).

## Testing / verification

1. Set employee Wed=WFH; on Wednesday Manila date, clock UI shows WFH and stores GPS/label.  
2. Office day punch has type office, null GPS.  
3. Empty schedule follows global mon_fri defaults.  
4. Edit schedule from User Management and Payroll Employees both persist.  
5. Off-day punch sets mismatch flag / warning but succeeds.  
6. GPS denied: punch succeeds with wfh type and null coords.

## Risks

- Browser GPS denial / inaccurate indoor location (accepted; soft).  
- Employees outside PH timezone: work date remains Asia/Manila (existing rule).  
- JSON schedule without history — mid-week edits apply immediately going forward.
