# Task 2 Report: Frontend portal time-clock API client

## Status

**Complete.** Authenticated portal time-clock HTTP client methods are on `AdminApiService`, aligned with Task 1 backend routes.

## Changes

**File:** `frontend/src/app/admin/services/admin-api.service.ts`

- Imported `TimeClockStatus` and `TimeClockLocationPayload` from `../../core/services/time-clock-api.service`.
- Re-exported `TimeClockStatus` for admin/portal consumers (`export type { TimeClockStatus } ...`).
- Added:
  - `getPortalTimeClockStatus()` — GET `/admin/employee-workspace/time-clock/status` with `headers()`.
  - `portalTimeIn(selfie, workLocationType, location?)` — multipart POST time-in; WFH location fields via private `appendPortalTimeClockLocation` (same rules as `TimeClockApiService.appendLocation`).
  - `portalTimeOut(selfie)` — multipart POST time-out.
- Placed methods alongside other `employee-workspace` APIs (after `getEmployeeWorkspaceDashboard`).

**Not changed:** `time-clock-api.service.ts` (public payroll routes) — left as-is per brief until public page migration.

## Commit

```
Add authenticated portal time-clock API client methods.
```

(Only `admin-api.service.ts` staged.)

## Verification

| Check | Result |
|-------|--------|
| `npm run build` (frontend) | Pass (existing CSS budget warnings only) |
| IDE lints on modified file | No issues |
| Unit tests | Not run (`ng test` not executed) |

## Design notes

- All three calls use `this.headers()` / `AdminAuthService` auth, matching other employee-workspace endpoints.
- `portalTimeOut` does not send location fields (matches brief; public `timeOut` still supports optional location on core service).
- Response types mirror core `TimeClockApiService` for status/time-in/time-out payloads.

## Concerns / follow-ups

- **Task 3+ UI** should inject `AdminApiService` instead of `TimeClockApiService` for portal clock flows.
- Consider deduplicating `appendPortalTimeClockLocation` into a shared util if more callers appear.
- Optional: add thin unit tests with `HttpClientTestingModule` when portal clock component lands.

## Brief checklist

- [x] Step 1: Types + methods on `AdminApiService`
- [x] Step 2: Commit with specified message
