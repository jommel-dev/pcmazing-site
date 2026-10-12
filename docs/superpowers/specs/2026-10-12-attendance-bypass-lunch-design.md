# Attendance admin bypass + lunch break design

**Date:** 2026-10-12  
**Status:** Approved for planning  
**Scope:** Admin bypass punches from Payroll → Attendance (no selfie; use admin profile photo); lunch out/in with confirm from 11:00 Manila; overbreak monitoring (max 1 hour lunch).

## Goal

Admins can fill forgotten employee time-in / lunch / time-out punches from the Attendance dashboard without a selfie, attributing the slot photo to the acting admin. Employees and admins get a lunch vs end-of-day confirm when punching out from 11:00 onwards, with lunch duration and overbreak visible for monitoring.

## Current state

- One `pcmazing_attendance` row per employee per Manila `work_date` with a single `time_in` / `time_out` pair and required selfies on employee punches.
- Admin Attendance is view + OT/adjustment review only — no punch-on-behalf.
- No lunch fields; worked hours = continuous elapsed from time in to time out; full day ≈ 9h wall-clock.
- Missed time-out is employee request + admin approve (separate from bypass).

## Decisions

| Topic | Choice |
| --- | --- |
| Architecture | Extend daily attendance row (Approach 1) — not a punch-events table |
| Lunch UX | Auto-suggest with confirm: **Going to lunch?** vs **End of day** when punch-out at/after **11:00 Manila** |
| Lunch surfaces | Employee Time Clock **and** admin Attendance bypass |
| Bypass time | Default server **now**; optional custom datetime override |
| Bypass overwrite | **Fill missing only** — never replace an existing timestamp |
| Overbreak | Flag / show minutes on Attendance (and status); **no pay change** |
| Worked hours | Keep **gross** elapsed (final time out − time in); lunch/overbreak are separate display fields |
| Bypass photo | Acting admin `profile_image_url`; block bypass if admin has no photo |
| Permission | `payroll.edit` for bypass |

## Data model

Extend `pcmazing_attendance` (migration + schema ensure):

| Column | Purpose |
| --- | --- |
| `lunch_out`, `lunch_in` | `TIMESTAMPTZ` nullable |
| `lunch_out_selfie_url`, `lunch_in_selfie_url` | Employee selfie or admin profile image URL |
| `time_in_bypassed_by_admin_id` | Nullable admin user id |
| `lunch_out_bypassed_by_admin_id` | Nullable |
| `lunch_in_bypassed_by_admin_id` | Nullable |
| `time_out_bypassed_by_admin_id` | Nullable |

**Derived on read (not required as stored columns):**

- `lunchMinutes` = minutes between `lunch_out` and `lunch_in` when both set; while on lunch (out set, in null), may expose live elapsed for UI
- `overbreakMinutes` = `max(0, lunchMinutes - 60)`
- `isOverbreak` = `overbreakMinutes > 0`
- Worked hours remain `computeHours(time_in, time_out)` (gross)

## Punch state machine

Same Manila work day, fill-missing only:

1. **Time in** — only if `time_in` is null  
2. **Punch out** while timed in, `lunch_out` null, `time_out` null:  
   - If Manila local time before 11:00 → end of day only (`time_out`)  
   - If 11:00 or later → client must send intent `lunch` \| `end_of_day`; server rejects if missing  
3. **Lunch in** — only if `lunch_out` set and `lunch_in` null (employee selfie or admin bypass)  
4. **Final time out** — only if timed in, not awaiting lunch in (i.e. no open lunch), and `time_out` null  

One lunch cycle per day. No second lunch after lunch in.

**Ordering for custom bypass `at`:** must fall on the row’s `work_date` (Manila) and be consistent with existing punches (e.g. lunch out after time in; lunch in after lunch out; time out after last work segment start).

## APIs

### Employee workspace (selfie required; unchanged photo rules)

- Extend time-clock **status** with lunch fields, on-lunch, overbreak, and whether punch-out requires lunch confirm.
- Extend **time-out** to accept `intent`: `lunch` \| `end_of_day` when confirm is required.
- After lunch out, next **time-in**-style punch completes **lunch in** (dedicated endpoint or overloaded time-in while on lunch — implementation chooses one clear path; behavior is lunch in with selfie).
- Final time out after lunch in uses existing time-out without lunch intent.

### Admin payroll (`payroll.edit`)

- `POST /admin/payroll/attendance/bypass`  
  Body: `{ userId, userSource, workDate, action: 'time_in' \| 'lunch_out' \| 'lunch_in' \| 'time_out', at?: string }`  
  - No multipart selfie  
  - Copies acting admin’s `profile_image_url` into the slot’s selfie URL  
  - Sets corresponding `*_bypassed_by_admin_id`  
  - Rejects if slot filled, order invalid, `at` invalid, or admin has no profile photo  

- Extend **list attendance** (and overview if needed) with lunch timestamps, selfie URLs, bypass admin ids, lunch/overbreak derived fields.

## UI

### Employee Time Clock

- On punch-out when status says confirm required: modal **Going to lunch?** / **End of day**  
- While on lunch: primary action is lunch in (selfie)  
- Show lunch duration / overbreak hint when relevant  

### Payroll → Attendance

- Columns / detail: Time in, Lunch out, Lunch in, Time out, Hours, Lunch duration, Overbreak badge  
- Thumbnails: slot selfie (admin photo when bypassed)  
- Row actions for each **missing** legal next slot: Bypass…  
- Bypass dialog: action summary, optional custom time, preview that admin photo will be used  

## Edge cases

- No lunch that day → lunch null; no overbreak UI noise  
- Open lunch (out without in) → on lunch; live elapsed vs 60 min for monitoring  
- Missed time-out **adjustment** unchanged; only when final `time_out` still null; does not clear lunch  
- Legacy rows with only time in/out → behave as today  
- Bypass never overwrites employee (or prior) punches  

## Out of scope

- Punch-events table / multiple lunches  
- Changing full-day hours or pay formulas  
- Deducting overbreak from pay  
- Overwriting existing punches  
- Admin bypass without a profile photo (must set photo first)  
- Changing OT or adjustment workflows beyond coexistence with lunch fields  

## Verification

1. Employee ≥11:00 punch-out → Lunch vs End of day; lunch path shows duration and overbreak when over 60 min.  
2. Admin bypass fills missing time-in/out (and lunch slots) with admin photo; optional custom time respected.  
3. Bypass cannot overwrite an existing punch.  
4. Day with no lunch → no lunch/overbreak badge.  
5. Normal ~9h wall-clock day still pays as today (gross hours unchanged).  
