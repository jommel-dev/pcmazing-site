# Attendance admin punch edit + audit log design

**Date:** 2026-10-17  
**Status:** Approved for planning  
**Scope:** Admins can correct existing attendance punches (time in, lunch out, lunch in, time out) from HIRS → Attendance; every change is audited; UI shows a row indicator and a dedicated Attendance logs list.

## Goal

Admins with payroll edit permission can fix wrong employee punch times without going through Bypass (which only fills missing slots). Every edit requires a reason and is permanently logged so we know which admin changed which employee’s punches, from what value to what, and why.

## Current state

- One `pcmazing_attendance` row per employee per Manila `work_date` with `time_in`, `lunch_out`, `lunch_in`, `time_out`.
- **Bypass** (`POST /admin/payroll/attendance/bypass`, `payroll.edit`) fills **missing** punches only; stamps `*_bypassed_by_admin_id`; uses admin profile photo as selfie.
- Time-out correction today is mostly employee request → admin approve (`adjustments`), not free-form edit of any field.
- No durable admin punch-edit history table for attendance; Bypass audit is row columns only.
- HIRS Attendance tab shows punches + Bypass actions; no Edit control and no logs tab.

## Decisions

| Topic | Choice |
| --- | --- |
| Architecture | **Edit + dedicated audit log** (Approach 1) — keep Bypass for fill-missing |
| Editable fields | All four: `time_in`, `lunch_out`, `lunch_in`, `time_out` |
| Clear / blank | **Not allowed** — change only; field must keep a valid timestamp |
| Reason | **Required** on every edit (min 8 characters after trim) |
| Permission | `payroll.edit` |
| Logging surfaces | **Both**: row indicator (last edit) + HIRS **Attendance logs** tab |
| Scope of one request | One attendance row; one or more fields in a single save; one reason for the batch |
| Bypass | Unchanged (still fill-missing only; no reason required there) |
| Selfie / photo | Edit does **not** require admin photo and does **not** overwrite selfie URLs |
| Payslip lock | Out of scope for v1 — edits allowed even if a payslip exists for the period (same as Bypass today) |

## Data model

### New table: `pcmazing_attendance_audit_log`

Modeled after `pcmazing_project_task_activity_log` (actor + action + details + meta).

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `BIGSERIAL` PK | |
| `attendance_id` | `BIGINT NOT NULL` | FK-ish to `pcmazing_attendance.id` (no hard FK if other tables avoid it; document intent) |
| `user_id` | `BIGINT NOT NULL` | Employee |
| `user_source` | `VARCHAR(40) NOT NULL` | Employee source |
| `username` | `VARCHAR(80) NOT NULL` | Snapshot for display |
| `employee_full_name` | `VARCHAR(200)` | Snapshot for display |
| `work_date` | `DATE NOT NULL` | Manila work day |
| `action_type` | `VARCHAR(40) NOT NULL` | `admin_edit_punch` |
| `actor_admin_id` | `BIGINT NOT NULL` | Admin who edited |
| `actor_admin_username` | `VARCHAR(80)` | Snapshot |
| `actor_admin_name` | `VARCHAR(200)` | Snapshot |
| `reason` | `TEXT NOT NULL` | Required note |
| `meta_json` | `JSONB NOT NULL` | See below |
| `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | |

**Indexes:** `(created_at DESC, id DESC)`, `(attendance_id, created_at DESC)`, `(work_date, created_at DESC)`, `(actor_admin_id, created_at DESC)`.

**`meta_json` shape (one log row per save):**

```json
{
  "changes": [
    { "field": "time_in", "oldValue": "2026-10-17T01:00:00.000Z", "newValue": "2026-10-17T01:05:00.000Z" },
    { "field": "time_out", "oldValue": "2026-10-17T10:00:00.000Z", "newValue": "2026-10-17T10:30:00.000Z" }
  ]
}
```

Field keys: `time_in` | `lunch_out` | `lunch_in` | `time_out`. Values are ISO-8601 UTC strings (or null only in `oldValue` when previously unset — but edit of unset fields is out of scope for Edit; use Bypass).

### Optional denormalized hint on attendance (read convenience)

Not required if list query joins last log. Prefer **computed on list**:

- `lastEditedAt`, `lastEditedByAdminName` from latest `admin_edit_punch` log for that `attendance_id`.

Avoid new columns on `pcmazing_attendance` unless join cost is a problem; start with subquery/join on Attendance list.

## Validation rules

1. Attendance row must exist; employee must be payroll-enabled (same as Bypass).
2. At least one of `timeIn`, `lunchOut`, `lunchIn`, `timeOut` provided and **different** from current stored value.
3. Edit only when the target column is **already non-null**. To fill a null slot, use Bypass.
4. Cannot set a field to null / empty.
5. `reason` required, trimmed length ≥ 8.
6. All timestamps must fall on the row’s Manila `work_date` (same date rule as Bypass custom `at`).
7. Ordering after merge of provided values into current row:
   - `time_in` ≤ `lunch_out` ≤ `lunch_in` ≤ `time_out` when each pair exists
   - If no lunch: `time_in` ≤ `time_out`
   - Open lunch (lunch out set, lunch in null) remains allowed; cannot set `time_out` while lunch is still open unless also setting `lunch_in` in the same request to close it (or leave lunch open and omit time out change).
8. On successful `time_out` change: call existing `syncOvertimeAfterTimeOut`; clear pending adjustment the same way Bypass does for time out.
9. Do not modify selfie URL columns or `*_bypassed_by_admin_id` columns on edit.

## APIs

### Edit punch

`PATCH /admin/payroll/attendance/:id`  
`@RequirePermissions('payroll.edit')`

Body:

```ts
{
  timeIn?: string;      // ISO timestamptz
  lunchOut?: string;
  lunchIn?: string;
  timeOut?: string;
  reason: string;
}
```

Response: same `AttendanceRecord` shape as list/bypass (including lunch/overbreak/`nextBypassActions` + last-edit fields).

Actor: JWT admin id + username/name resolved for audit snapshot.

### List audit logs

`GET /admin/payroll/attendance/logs?page&limit&workDate&q&actorAdminId`  
`@RequirePermissions('payroll.view')`

- Default sort: `created_at DESC`
- Filters: optional `workDate`, search `q` (employee name/username/code), optional `actorAdminId`
- Returns paginated rows with employee display fields, actor display fields, reason, `changes` from `meta_json`, `created_at`

### Optional: logs for one attendance row

`GET /admin/payroll/attendance/:id/logs`  
`@RequirePermissions('payroll.view')`  
Used if Edit modal shows recent history for that day (nice-to-have; Attendance logs tab is required).

## Frontend (HIRS)

### Attendance tab

- Add **Edit** control per row when at least one punch is set (icon + tooltip, consistent with other HIRS icon actions).
- Modal: datetime-local (or existing time picker pattern from Bypass) for each **currently set** field; disabled/hidden for null fields with helper “Use Bypass to fill missing punches.”
- Required reason textarea.
- Save → PATCH → refresh list; toast/error on failure.
- Row indicator: small “Edited” badge or muted text under punches when `lastEditedAt` present — tooltip: `Edited by {name} · {relative or local time}`.

### New tab: Attendance logs

- Sidebar tab next to Attendance (label: **Attendance logs**).
- Filters: work date (optional), search box, pagination.
- Columns: When, Admin, Employee, Work date, Changes (field: old → new), Reason.
- Permission: visible with `payroll.view` (same as Attendance); edits still need `payroll.edit` on Attendance tab.

### Bypass

Unchanged UX and API.

## Permissions

| Action | Permission |
| --- | --- |
| View Attendance / Attendance logs | `payroll.view` |
| Edit punches | `payroll.edit` |
| Bypass (unchanged) | `payroll.edit` |

## Out of scope (v1)

- Clearing punches to null
- Editing selfie images
- Blocking edits when payslip already generated
- Employee-facing notification of admin edits
- Editing historical rows outside Attendance date picker (still reachable by picking that `workDate`)
- Merging Bypass into Edit

## Test plan

- Edit time in only with valid reason → DB updated; one audit row; list shows new time + last editor.
- Edit multiple fields in one save → one audit row with multiple `changes`.
- Reject edit of null field (must Bypass).
- Reject clear / empty timestamp.
- Reject reason under 8 chars.
- Reject out-of-order punches.
- Reject time on wrong Manila calendar day.
- Changing time out clears pending adjustment and resyncs OT (same as Bypass).
- Attendance logs lists the edit; filters by work date and search work.
- User with only `payroll.view` can see logs but cannot PATCH.
- Bypass still cannot overwrite existing punches.
