# Task 1 Report: Backend session-bound time clock + broaden workspace access

## Status
**DONE**

## Summary
Portal employees punch via JWT-bound workspace routes only. Public `/payroll/time-clock/*` is removed. Workspace access widened to all portal-login roles (not sales-only). Punch rules unchanged: selfie, office|wfh pick, WFH GPS parse, Manila server time via existing `PayrollService.timeIn` / `timeOut`.

## Changes
### `backend/src/admin/payroll/payroll.service.ts`
- Added `getTimeClockStatusForUser(userId, source)` → `resolveUserIdentity` then `getTimeClockStatus(identity.username)`; missing identity returns `status: 'not_found'` / `message: 'Account not found.'` with empty location fields.
- Added `timeInForUser` / `timeOutForUser` — resolve identity or `NotFoundException('Account not found.')`, then delegate to username-based `timeIn` / `timeOut`.
- Confirmed `resolveUserIdentity` returns `{ username, fullName, isActive } | null` (used `identity.username` as specified).

### `backend/src/admin/employee-workspace/employee-workspace.service.ts`
- `assertSalesWorkspaceAccess`: allows `isSuperAdmin` or `canUsePortalLogin`; else Forbidden with new message (method name kept).
- Thin wrappers: `getTimeClockStatus`, `timeIn`, `timeOut` → payroll ForUser helpers after `ensureReady()`.
- Copied `parseLocation` from deleted public controller; `timeIn` parses lat/lng/label before calling payroll.

### `backend/src/admin/employee-workspace/employee-workspace.controller.ts`
- `GET time-clock/status`, `POST time-clock/time-in`, `POST time-clock/time-out` under `@Controller('admin/employee-workspace')` + `JwtAuthGuard`.
- Identity from `actor(req)` only (no client username). Same FileInterceptor selfie limits (2MB) and office|wfh validation as former public controller.

### `backend/src/admin/admin.module.ts`
- Unregistered `TimeClockController` import + controllers entry.

### Deleted
- `backend/src/admin/payroll/time-clock.controller.ts`

## Verification
- `cd backend; npx tsc --noEmit -p tsconfig.build.json` → **exit 0**

## Commit
- `811149c` — Add session-bound portal time-clock API; remove public punches.
- Files: `payroll.service.ts`, `employee-workspace.service.ts`, `employee-workspace.controller.ts`, `admin.module.ts`, deleted `time-clock.controller.ts`.

## Self-review
- Identity: JWT `userId` + `source` only on new routes; username never accepted from client.
- Punch path reuses existing `timeIn`/`timeOut` (selfie, pick, WFH GPS, NOW()).
- Public module registration removed; controller file deleted.
- Access gate matches brief (`canUsePortalLogin` covers marketing/developers/sales/ops/PM + admin login roles).

## Concerns / follow-ups
- Existing Angular public time-clock client still calls `/payroll/time-clock/*` (broken until later portal UI tasks rewire it).
- Username-based `getTimeClockStatus` / `timeIn` / `timeOut` remain as internal implementation; only the public HTTP surface was removed.
