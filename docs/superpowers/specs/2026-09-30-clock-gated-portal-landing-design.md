# Clock-Gated Portal Landing

**Date:** 2026-09-30  
**Status:** Implemented  
**Approach:** Post-login resolve via portal time-clock status (`canTimeIn`)

## Goal

After portal login, payroll time-clock–enabled employees who still need to clock in land on Time Clock first. Once they are clocked in (or have completed the day), login lands on their normal role home (e.g. Sales Dashboard).

## Decisions locked

| Topic | Choice |
|-------|--------|
| Who | Every user enabled for payroll time clock (API `canTimeIn` / status gate) |
| Not clocked in | Land on `/admin/time-clock` |
| Clocked in or day completed | Land on role home (`getRoleHomeRoute`) |
| Deep link `returnUrl` | Honor safe `/admin/…` return URL first |
| Status / network failure | Fall back to role home (do not block login) |
| Architecture | Approach 1 — async post-login resolve in portal login (no backend change) |

## Behavior

1. Safe `returnUrl` query param (`/admin/…`, same-origin relative) wins — unchanged from today.
2. Otherwise, after a successful portal login (session saved):
   - Call `GET /admin/employee-workspace/time-clock/status` (existing portal client).
   - If `canTimeIn === true` → navigate to `/admin/time-clock`.
   - Else → navigate to `getRoleHomeRoute(role)`.
3. Same rule when an already-authenticated user hits the portal login page with no `returnUrl` (`redirectIfAuthenticated`).
4. Users not enabled for payroll time clock, or any status fetch error → role home.

## Where

| File | Change |
|------|--------|
| `frontend/src/app/user/pages/portal-login-page.component.ts` | Make post-login route resolve async; fetch status when no return URL; branch on `canTimeIn` |
| `frontend/.../admin-api.service.ts` | Reuse existing `getPortalTimeClockStatus()` — no new endpoints |

No backend, punch-rule, nav, or compact-dashboard-clock changes.

## Out of scope

- Changing punch / selfie / Office-WFH / GPS rules
- Redirect after punch from Time Clock to dashboard (optional later)
- Admin (non-portal) login landing
- Forcing Time Clock over deep links

## Acceptance

1. Payroll-enabled employee, not clocked in, login with no `returnUrl` → `/admin/time-clock`.
2. Same employee after time-in, logout, login again → role home (e.g. `/admin/sales-dashboard` for sales).
3. Day completed (`canTimeIn` false) → role home.
4. Login with `?returnUrl=/admin/time-clock` (or other safe admin path) → that URL.
5. User without payroll time clock → role home; login never stuck on status error.
