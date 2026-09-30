# Task 4 Report: Full page, nav, login returnUrl, remove public entry points

**Complete.** Portal Time Clock lives at `/admin/time-clock` with `time_clock` RBAC; public `/time-clock` redirects to login with `returnUrl`.

## Changes
- Page: `portal-time-clock-page.component.ts` wraps `PortalTimeClockComponent` (`mode="full"`).
- Module + RBAC: `time_clock` in `ADMIN_MODULES`, `AdminModuleKey`, portal role allow-lists; **My Portal** nav section.
- `/time-clock` → `TimeClockRedirectComponent` → `/user/login?returnUrl=/admin/time-clock`.
- Portal login honors safe `/admin/` `returnUrl`; hub Time Clock tile removed.
- Payroll copy link → portal login + returnUrl; copy updated; old public page deleted.

## Commit
`Add portal Time Clock page; redirect public clock to login.` (`c0e2199`)

## Verification
`npx ng build --configuration=development` — Pass
