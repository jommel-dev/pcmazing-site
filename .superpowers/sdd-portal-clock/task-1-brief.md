### Task 1: Backend session-bound time clock + broaden workspace access

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts`
- Modify: `backend/src/admin/employee-workspace/employee-workspace.service.ts`
- Modify: `backend/src/admin/employee-workspace/employee-workspace.controller.ts`
- Modify: `backend/src/admin/admin.module.ts`
- Delete: `backend/src/admin/payroll/time-clock.controller.ts` (after unregister)
- Test: `cd backend; npx tsc --noEmit -p tsconfig.build.json`

**Interfaces:**
- Consumes: existing `getTimeClockStatus(username)`, `timeIn`, `timeOut`, `findActiveUserByUsername`, `resolveUserIdentity`
- Produces:
  - `PayrollService.getTimeClockStatusForUser(userId: number, source: 'tblusers' \| 'pcmazing_admin_users'): Promise<TimeClockStatus>`
  - `PayrollService.timeInForUser(userId, source, selfie, workLocationType, location?): Promise<TimeClockStatus>`
  - `PayrollService.timeOutForUser(userId, source, selfie): Promise<TimeClockStatus>`
  - HTTP: `GET/POST /admin/employee-workspace/time-clock/{status,time-in,time-out}`

- [ ] **Step 1: Broaden workspace access for portal employees**

In `employee-workspace.service.ts`, replace `assertSalesWorkspaceAccess` body so portal roles (not only sales) can use the workspace â€” required for marketing/developers who already see the workspace UI:

```typescript
import { canUsePortalLogin, isSuperAdmin } from '../rbac/admin-roles.util';

assertSalesWorkspaceAccess(role?: string | null): void {
  if (isSuperAdmin(role) || canUsePortalLogin(role)) {
    return;
  }
  throw new ForbiddenException('Employee workspace is not available for this role.');
}
```

(Keep the method name to avoid churn at all call sites.)

- [ ] **Step 2: Add PayrollService helpers by userId+source**

Near `getTimeClockStatus` / `timeIn` / `timeOut`, add:

```typescript
async getTimeClockStatusForUser(
  userId: number,
  source: 'tblusers' | 'pcmazing_admin_users',
): Promise<TimeClockStatus> {
  const identity = await this.resolveUserIdentity(userId, source);
  if (!identity) {
    const clock = await this.getServerClock();
    const settings = await this.getSettings();
    return {
      username: '',
      fullName: '',
      employeeCode: null,
      workDate: clock.workDate,
      timeIn: null,
      timeOut: null,
      canTimeIn: false,
      canTimeOut: false,
      status: 'not_found',
      message: 'Account not found.',
      serverNow: clock.serverNow,
      undertimeGraceMinutes: settings.undertimeGraceMinutes,
      ...this.emptyTimeClockLocationFields(clock.workDate, settings.workWeek),
    };
  }
  return this.getTimeClockStatus(identity.username);
}

async timeInForUser(
  userId: number,
  source: 'tblusers' | 'pcmazing_admin_users',
  selfie: Express.Multer.File,
  workLocationType: 'office' | 'wfh',
  location?: TimeClockLocationInput | null,
): Promise<TimeClockStatus> {
  const identity = await this.resolveUserIdentity(userId, source);
  if (!identity) {
    throw new NotFoundException('Account not found.');
  }
  return this.timeIn(identity.username, selfie, workLocationType, location);
}

async timeOutForUser(
  userId: number,
  source: 'tblusers' | 'pcmazing_admin_users',
  selfie: Express.Multer.File,
): Promise<TimeClockStatus> {
  const identity = await this.resolveUserIdentity(userId, source);
  if (!identity) {
    throw new NotFoundException('Account not found.');
  }
  return this.timeOut(identity.username, selfie);
}
```

Confirm `resolveUserIdentity` returns `{ username, fullName, isActive }` (or equivalent). Adjust property names to match the private method.

- [ ] **Step 3: Wire controller routes**

In `employee-workspace.controller.ts`, inject `PayrollService` (already available via workspace service â€” either call through `workspaceService` thin wrappers or inject `PayrollService` directly). Prefer thin wrappers on `EmployeeWorkspaceService` to keep controller consistent:

```typescript
// employee-workspace.service.ts
async getTimeClockStatus(userId: number, source: UserSource) {
  await this.ensureReady();
  return this.payrollService.getTimeClockStatusForUser(userId, source);
}
async timeIn(...) { ... }
async timeOut(...) { ... }
```

Controller (same `actor(req)` + FileInterceptor pattern as public controller for selfie):

```typescript
@Get('time-clock/status')
async timeClockStatus(@Req() req: Request & { user?: AdminJwtPayload }) {
  const { userId, source } = this.actor(req);
  const data = await this.workspaceService.getTimeClockStatus(userId, source);
  return { success: true, data };
}

@Post('time-clock/time-in')
@UseInterceptors(FileInterceptor('selfie', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
async timeClockTimeIn(
  @Req() req: Request & { user?: AdminJwtPayload },
  @Body('workLocationType') workLocationType?: string,
  @Body('locationLat') locationLat?: string,
  @Body('locationLng') locationLng?: string,
  @Body('locationLabel') locationLabel?: string,
  @UploadedFile() selfie?: Express.Multer.File,
) {
  const { userId, source } = this.actor(req);
  if (!selfie) {
    throw new BadRequestException('Selfie photo is required before time in.');
  }
  const picked = (workLocationType ?? '').trim().toLowerCase();
  if (picked !== 'office' && picked !== 'wfh') {
    throw new BadRequestException('Choose Office or Work from home before time in.');
  }
  const data = await this.workspaceService.timeIn(userId, source, selfie, picked, {
    locationLat, locationLng, locationLabel,
  });
  return { success: true, message: 'Time in recorded.', data };
}

@Post('time-clock/time-out')
@UseInterceptors(FileInterceptor('selfie', { storage: memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } }))
async timeClockTimeOut(
  @Req() req: Request & { user?: AdminJwtPayload },
  @UploadedFile() selfie?: Express.Multer.File,
) {
  const { userId, source } = this.actor(req);
  if (!selfie) {
    throw new BadRequestException('Selfie photo is required before time out.');
  }
  const data = await this.workspaceService.timeOut(userId, source, selfie);
  return { success: true, message: 'Time out recorded.', data };
}
```

Parse lat/lng the same way as `TimeClockController.parseLocation` (copy private helper into workspace service or controller).

- [ ] **Step 4: Remove public time-clock API**

- Remove `TimeClockController` from `admin.module.ts` `controllers` array and imports.
- Delete `backend/src/admin/payroll/time-clock.controller.ts`.

- [ ] **Step 5: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts backend/src/admin/employee-workspace backend/src/admin/admin.module.ts
git add -u backend/src/admin/payroll/time-clock.controller.ts
git commit -m "Add session-bound portal time-clock API; remove public punches."
```

---
