# Task 3 Report: Shared PortalTimeClockComponent

## Status

**Complete.** Shared `PortalTimeClockComponent` ports public time-clock punch UX (selfie, Office/WFH, WFH GPS, Manila server clock) onto session-bound `AdminApiService` portal methods — no username search.

## Changes

**Created:**
- `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts`
- `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html`

**Behavior:**
- `@Input() mode: 'compact' | 'full'` (signal `input()`); denser padding / shorter help in compact.
- `@Output() punched` (`output()`) after successful time-in / time-out.
- On init: `getPortalTimeClockStatus()` only; pre-selects `pickedLocation` from `expectedLocation` when `office`|`wfh`.
- Submit: `portalTimeIn` / `portalTimeOut` (no username).
- Display name: status → `AdminAuthService.getStoredUser()` fallback.
- Off-schedule soft warning copy matches public page.
- Server clock offset from `status.serverNow`; 60s re-sync via status GET (offset only, does not reset selfie/UI).

**Not wired yet:** dashboard embed / `/admin/time-clock` page (Task 4+).

## Commit

```
Add shared portal time-clock component without username search.
```

(Only `frontend/src/app/admin/components/portal-time-clock/**` staged.)

## Verification

| Check | Result |
|-------|--------|
| `npx ng build --configuration=development` | Pass |
| Unit tests | Not run |
| Runtime punch E2E | Not run (component not mounted yet) |

## Concerns / follow-ups

- Component is unused until Task 4 mounts it (compact on dashboard, full on route).
- Periodic clock sync hits status endpoint (no portal `/now` client method yet).
- Punch-error path reloads status with `preserveMessages` so API error text stays visible.

## Brief checklist

- [x] Step 1: Create component (port + portal APIs, mode, punched)
- [x] Step 2: Smoke build
- [x] Step 3: Commit with specified message
