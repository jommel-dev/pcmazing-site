# Task 5 Report: Compact clock on employee workspace + verify

**Complete.** Compact portal clock embedded on employee workspace; punch reloads dashboard; design marked Implemented.

## Changes
- `sales-employee-dashboard`: import `PortalTimeClockComponent`; `<app-portal-time-clock mode="compact" (punched)="onTimeClockPunched()" />` after banners / before KPI cards; `onTimeClockPunched()` → `load()`.
- Spec `2026-09-23-portal-time-clock-design.md`: Status → **Implemented**.

## Commit
`Embed compact portal time clock on employee workspace.` (`39c32ba`)

## Verification
- `npx ng build --configuration=development` — Pass
- Unauth `GET /admin/employee-workspace/time-clock/status` — **401**
- `GET /payroll/time-clock/status` — **404**
- **Not click-tested:** portal login UI, Office+selfie punch, full `/admin/time-clock` timeout, `/time-clock` returnUrl flow, hub tile, payroll copy-link (no browser session).

---

## Final review fixes (2026-09-23)

**Status:** Done

### Fixes
1. **Dashboard punch remount** — `load({ quiet: true })` skips top-level `loading` when dashboard data already exists; `onTimeClockPunched()` uses quiet refresh so the compact clock is not remounted.
2. **Dead public client** — `TimeClockApiService` HTTP methods now throw (public `/payroll/time-clock/*` removed); types kept for portal/`AdminApiService` use.
3. **PWA comment** — Dropped stale “Time Clock” hub-app mention in `pwa-install.service.ts`.

### Verification
- `cd frontend; npx ng build --configuration=development` — **Pass** (22.3s)

### Commit
`Fix portal time-clock dashboard remount and dead public client.`
