# Portal Time Clock (Session-Bound, No Public Search)

**Date:** 2026-09-23  
**Status:** Approved design — pending implementation  
**Approach:** Session-bound employee-workspace APIs + shared portal UI (dashboard compact + full page); remove public `/time-clock`

## Goal

Move clock-in / clock-out into each employee’s logged-in portal so they never type or search a username. Punch rules stay the same (selfie, Office/WFH pick, WFH GPS); identity comes from the portal JWT.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Public `/time-clock` | Remove; redirect to portal login with return URL to portal Time Clock |
| Public `/payroll/time-clock/*` | Remove or hard-disable (no username punches without login) |
| Placement | Both: compact on employee workspace dashboard + dedicated `/admin/time-clock` page |
| Punch rules | Unchanged: selfie required; Office/WFH required at time-in; WFH GPS/label; time-out selfie; Manila server time |
| Identity | JWT `req.user` only — never client-supplied username |
| Architecture | Approach 1 — new authenticated workspace time-clock endpoints reusing `PayrollService` punch pipeline |

## Scope

### In scope

1. Authenticated APIs under `/admin/employee-workspace/time-clock/*` (status, time-in, time-out; `now` optional or folded into status).
2. Shared portal time-clock component (compact + full modes); no username field.
3. Compact clock on the existing employee workspace (role home dashboards).
4. Full page at `/admin/time-clock` with nav for portal/employee roles that use the workspace.
5. Redirect public `/time-clock` → `/user/login` with return to `/admin/time-clock`.
6. Remove Time Clock tile from `/user/portal` hub.
7. Update payroll admin “copy time clock link” to the portal login / time-clock path.
8. Disable or delete public `TimeClockController` routes under `/payroll/time-clock`.

### Out of scope

- Kiosk / shared-device PIN or QR stations
- Skipping selfie when logged in
- Changing overtime, missed time-out adjustment, or payslip flows
- Admin punching on behalf of another employee
- Rewriting historical attendance rows

## Architecture

```
Portal login (JWT)
        │
        ├─ Role home / employee workspace
        │     └─ compact PortalTimeClockComponent
        │
        └─ /admin/time-clock (full page)
              └─ same component, full mode
                        │
                        ▼
GET/POST /admin/employee-workspace/time-clock/*
        │  actor = req.user (userId + source)
        ▼
PayrollService time-in / time-out / status (existing punch rules)
        │
        ▼
pcmazing_attendance (+ selfie files, work_location_type, WFH GPS)
```

Public path:

```
GET /time-clock  →  redirect → /user/login?returnUrl=/admin/time-clock
```

## API

All routes: `JwtAuthGuard`, same workspace `actor()` access check as dashboard (session user only).

| Method | Path | Body / notes |
|--------|------|----------------|
| `GET` | `/admin/employee-workspace/time-clock/status` | Today’s status for session user (no `username` query) |
| `GET` | `/admin/employee-workspace/time-clock/now` | Optional; may be omitted if status includes `serverNow` |
| `POST` | `/admin/employee-workspace/time-clock/time-in` | multipart: `selfie`, `workLocationType` (`office`\|`wfh`), optional WFH `locationLat` / `locationLng` / `locationLabel` |
| `POST` | `/admin/employee-workspace/time-clock/time-out` | multipart: `selfie` |

**Errors**

- `401` — not authenticated  
- `400` — missing selfie, missing/invalid Office|WFH pick, or existing business punch errors (already timed in, etc.)  
- Same workspace role access denial as dashboard if role is not allowed  

**Cleanup:** public `/payroll/time-clock/*` must not accept punches after this change.

## UI

### Shared component

- Shows logged-in display name, server Manila clock, today’s status / message  
- Office / WFH pick when `canTimeIn` (pre-select from `expectedLocation` when office/wfh; Off → soft warning, must choose)  
- Selfie capture; Time in / Time out actions  
- No username input or “Check” lookup  

### Compact mode

- Embedded at top of `SalesEmployeeDashboardComponent` (shared employee workspace on role homes)  
- After successful punch, refresh clock status and workspace “today” cards  

### Full page

- Route: `/admin/time-clock`  
- Nav entry for portal roles that use the employee workspace  
- Same component in full layout + brief help text  

### Hub / redirects / admin copy link

- Remove Time Clock app from portal hub apps list  
- `/time-clock` redirects to login with return URL  
- Payroll “copy public time clock link” becomes portal login → time-clock (or direct `/admin/time-clock` for already-logged-in staff testing — prefer login return URL for the shared link)

## Data flow

1. Employee signs in at MyPeoplePortal.  
2. Opens home workspace and/or Time Clock nav.  
3. Status loads for session user.  
4. If can time in: pick Office/WFH → selfie → POST time-in.  
5. If can time out: selfie → POST time-out.  
6. UI refreshes status; workspace today summary updates.

## Testing / verification

- Logged-in employee can clock without searching a username.  
- API rejects unauthenticated calls; cannot punch for another username.  
- Public `/time-clock` redirects; public time-clock API no longer punches.  
- Compact dashboard and full page both time-in/out with Office/WFH + selfie.  
- WFH still stores GPS/label when provided; Office does not require GPS.  
- Payroll copy-link points at the new portal entry path.

## Implementation notes

- Prefer thin controller methods that resolve username/identity from `actor` + existing user records, then call existing `PayrollService.timeIn` / `timeOut` / `getTimeClockStatus` (or slight overloads that accept userId/source).  
- Avoid duplicating selfie / location / pay-tag logic.  
- Frontend: one shared component; dashboard and page are thin wrappers.
