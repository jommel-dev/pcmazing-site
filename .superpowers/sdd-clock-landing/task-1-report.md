# Task 1 Report: Shared post-login resolver + wire login + guest guard

## Status

**DONE**

## Summary

Implemented clock-gated portal landing per task brief and design spec. A shared `resolvePortalPostLoginRoute` centralizes: safe `returnUrl` first, then `/admin/time-clock` when `getPortalTimeClockStatus()` reports `canTimeIn === true`, else role home with errors falling through to role home.

## Changes

| File | Action |
|------|--------|
| `frontend/src/app/user/portal-post-login-route.ts` | Created — `isSafeAdminReturnUrl`, `resolvePortalPostLoginRoute` |
| `frontend/src/app/user/pages/portal-login-page.component.ts` | Wired async landing via `AdminApiService.getPortalTimeClockStatus()` in `redirectIfAuthenticated` and `submit` |
| `frontend/src/app/user/guards/portal-auth.guards.ts` | `portalGuestGuard` now async, uses same resolver and honors route `returnUrl` |
| `docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md` | Status → **Implemented** |

## Verification

- **Build:** `cd frontend; npx ng build --configuration=development` — exit 0 (~29s).
- **Manual acceptance (brief Step 6):** Skipped — no authenticated payroll test session in this run; logic matches spec and brief verbatim.

## Commit

- `a64c2ec` — Gate portal login landing on time-clock canTimeIn.

Only the four files above were staged; `env.generated.ts` and `.superpowers` ledger files were not committed.

## Self-review

- Resolver matches brief code exactly; single call site pattern for `fetchCanTimeIn` keeps login and guard aligned.
- `portalGuestGuard` uses `router.parseUrl(url)` so full paths like `/admin/time-clock` work (replacing prior `createUrlTree([getRoleHomeRoute])`).
- Status API failures caught inside resolver — login never blocked.
- No backend changes; reuses existing `AdminApiService.getPortalTimeClockStatus()`.
- No new `*.spec.ts` (repo has none for frontend per brief).

## Concerns

None.
