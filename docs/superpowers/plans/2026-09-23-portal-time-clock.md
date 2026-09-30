# Portal Time Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move clock-in/out into the logged-in employee portal (session identity, no username search); remove the public `/time-clock` flow.

**Architecture:** Add JWT-guarded `/admin/employee-workspace/time-clock/*` endpoints that resolve the actor from `req.user` and call `PayrollService` punch helpers. Shared Angular `PortalTimeClockComponent` (compact + full) on the employee workspace and `/admin/time-clock`. Public route redirects to portal login; public API removed.

**Tech Stack:** NestJS employee-workspace + PayrollService; Angular admin shell + existing selfie/camera patterns from `time-clock-page`.

**Spec:** `docs/superpowers/specs/2026-09-23-portal-time-clock-design.md`

## Global Constraints

- Identity from JWT only — never accept client `username` for punches.
- Punch rules unchanged: selfie required; time-in requires `workLocationType` `office`|`wfh`; WFH GPS/label; Manila server time; no time-out picker.
- Public `/time-clock` → login with return to `/admin/time-clock`; public `/payroll/time-clock/*` removed/disabled.
- Compact on employee workspace + full `/admin/time-clock` page + nav.
- PowerShell: use `;` not `&&`.
- Prefer thin wrappers over duplicating punch/selfie logic.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/admin/payroll/payroll.service.ts` | Session-user status / timeIn / timeOut by `userId`+`source` |
| `backend/src/admin/employee-workspace/employee-workspace.controller.ts` | Authenticated time-clock HTTP routes |
| `backend/src/admin/employee-workspace/employee-workspace.service.ts` | Broaden workspace access for portal roles; optional thin delegates |
| `backend/src/admin/admin.module.ts` | Unregister `TimeClockController` |
| `backend/src/admin/payroll/time-clock.controller.ts` | Delete or leave unused (prefer delete after unregister) |
| `frontend/.../admin-api.service.ts` | Portal time-clock HTTP client (auth headers) |
| `frontend/.../portal-time-clock/portal-time-clock.component.ts` | Shared clock UI (compact/full), no username |
| `frontend/.../pages/time-clock/portal-time-clock-page.component.ts` | Full-page wrapper |
| `frontend/.../sales-employee-dashboard.*` | Embed compact clock; refresh today after punch |
| `frontend/.../admin.routes.ts`, `admin-modules.data.ts`, `admin-roles.ts` | Route + nav module `time_clock` |
| `frontend/.../app.routes.ts`, `portal-hub-page.*`, `portal-login-page.*` | Redirect public clock; hub tile; returnUrl |
| `frontend/.../payroll-page.component.ts` | Copy-link → portal login return URL |
| `docs/superpowers/specs/2026-09-23-portal-time-clock-design.md` | Mark Implemented |

---

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

In `employee-workspace.service.ts`, replace `assertSalesWorkspaceAccess` body so portal roles (not only sales) can use the workspace — required for marketing/developers who already see the workspace UI:

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

In `employee-workspace.controller.ts`, inject `PayrollService` (already available via workspace service — either call through `workspaceService` thin wrappers or inject `PayrollService` directly). Prefer thin wrappers on `EmployeeWorkspaceService` to keep controller consistent:

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

### Task 2: Frontend portal time-clock API client

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`
- Optionally deprecate usage of `frontend/src/app/core/services/time-clock-api.service.ts` (leave file until public page removed, or point methods at new URLs — prefer new methods on `AdminApiService` only)

**Interfaces:**
- Consumes: Task 1 HTTP routes + `AdminAuthService` headers via existing `headers()`
- Produces:
  - `getPortalTimeClockStatus()`
  - `portalTimeIn(selfie, workLocationType, location?)`
  - `portalTimeOut(selfie)`
  - Reuse / export `TimeClockStatus` type (import from core service or duplicate minimal interface in admin-api)

- [ ] **Step 1: Add types + methods to AdminApiService**

```typescript
getPortalTimeClockStatus() {
  return this.http.get<{ success: boolean; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/status`,
    { headers: this.headers() },
  );
}

portalTimeIn(
  selfie: Blob,
  workLocationType: 'office' | 'wfh',
  location?: { locationLat?: number | null; locationLng?: number | null; locationLabel?: string | null } | null,
) {
  const formData = new FormData();
  formData.append('selfie', selfie, 'time-in-selfie.jpg');
  formData.append('workLocationType', workLocationType);
  // append location fields same as TimeClockApiService.appendLocation
  return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-in`,
    formData,
    { headers: this.headers() },
  );
}

portalTimeOut(selfie: Blob) {
  const formData = new FormData();
  formData.append('selfie', selfie, 'time-out-selfie.jpg');
  return this.http.post<{ success: boolean; message: string; data: TimeClockStatus }>(
    `${APP_CONFIG.apiUrl}/admin/employee-workspace/time-clock/time-out`,
    formData,
    { headers: this.headers() },
  );
}
```

Import `TimeClockStatus` from `../../../core/services/time-clock-api.service` (or move shared types to a small `time-clock.types.ts` if import path is awkward).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/admin/services/admin-api.service.ts
git commit -m "Add authenticated portal time-clock API client methods."
```

---

### Task 3: Shared PortalTimeClockComponent (compact + full)

**Files:**
- Create: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts`
- Create: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html` (optional if inline template preferred — follow sibling components; use separate HTML if large)

**Interfaces:**
- Consumes: `AdminApiService.getPortalTimeClockStatus` / `portalTimeIn` / `portalTimeOut`; `AdminAuthService.getStoredUser()` for display name fallback
- Produces: `@Input() mode: 'compact' | 'full'`; `@Output() punched` EventEmitter after successful in/out (dashboard listens to reload)

- [ ] **Step 1: Create component**

Port camera / selfie / Office-WFH / GPS behavior from `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts`, with these changes:

- No `username` signal or Check/lookup UI
- On init: `getPortalTimeClockStatus()` only
- Submit: `portalTimeIn` / `portalTimeOut` (no username)
- Pre-select `pickedLocation` from `status.expectedLocation` when `office`|`wfh`
- Off schedule: soft warning banner (copy from public page)
- `mode` input: compact = denser padding / shorter help; full = current public-page density
- Emit `punched` after success

Keep server clock offset display pattern from the public page.

- [ ] **Step 2: Smoke build**

Run: `cd frontend; npx ng build --configuration=development`  
Expected: success (or at least component compiles; fix template errors)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/components/portal-time-clock
git commit -m "Add shared portal time-clock component without username search."
```

---

### Task 4: Full page, nav, login returnUrl, remove public entry points

**Files:**
- Create: `frontend/src/app/admin/pages/time-clock/portal-time-clock-page.component.ts`
- Modify: `frontend/src/app/admin/admin.routes.ts`
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts`
- Modify: `frontend/src/app/admin/rbac/admin-roles.ts` (`AdminModuleKey` + `getAllowedModuleKeys`)
- Modify: `frontend/src/app/app.routes.ts`
- Modify: `frontend/src/app/user/pages/portal-hub-page.component.ts` (+ html if needed)
- Modify: `frontend/src/app/user/pages/portal-login-page.component.ts`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`
- Delete or gut: `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts` (+ html) after redirect replaces it

- [ ] **Step 1: Full page wrapper**

```typescript
@Component({
  selector: 'app-portal-time-clock-page',
  imports: [PortalTimeClockComponent],
  template: `
    <div class="mx-auto max-w-lg space-y-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Time Clock</h2>
        <p class="mt-1 text-sm text-slate-500">Clock in and out with a selfie. Your account is already signed in.</p>
      </div>
      <app-portal-time-clock mode="full" />
    </div>
  `,
})
export class PortalTimeClockPageComponent {}
```

- [ ] **Step 2: Route + module + RBAC**

- Add module item `time_clock` → `/admin/time-clock` in `ADMIN_MODULES` (and MyPortal / System Management section as fits existing nav grouping — place near profile / role home).
- Extend `AdminModuleKey` with `'time_clock'`.
- Add `'time_clock'` to allowed sets for marketing, sales, operations, developers/PMs (everyone who uses employee workspace / portal login roles). Super admin gets `all`.
- Register route under admin children with `canActivate: [adminRoleGuard]`, `data: { module: 'time_clock' }`.

- [ ] **Step 3: Public redirect + hub + login returnUrl**

Replace `app.routes.ts` time-clock route with a tiny redirect component or guard:

```typescript
{
  path: 'time-clock',
  redirectTo: '/user/login',
  pathMatch: 'full',
}
```

Angular `redirectTo` cannot append query easily — use a one-line component:

```typescript
@Component({
  standalone: true,
  template: '',
})
export class TimeClockRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  ngOnInit() {
    void this.router.navigate(['/user/login'], {
      queryParams: { returnUrl: '/admin/time-clock' },
    });
  }
}
```

Portal login: after successful login, if `returnUrl` query is a safe relative path starting with `/admin/`, navigate there instead of `getRoleHomeRoute`.

Hub: remove the `time-clock` app entry from `portal-hub-page.component.ts` `apps` array.

Payroll page: change `timeClockUrl` to  
`${publicSiteUrl}/user/login?returnUrl=${encodeURIComponent('/admin/time-clock')}`  
and update copy from “public time clock” to “portal time clock” / “employee time clock link”.

- [ ] **Step 4: Remove old public page files** if unused; delete imports.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin frontend/src/app/app.routes.ts frontend/src/app/user frontend/src/app/website/pages/time-clock
git commit -m "Add portal Time Clock page; redirect public clock to login."
```

---

### Task 5: Compact clock on employee workspace + verify

**Files:**
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts`
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html`
- Modify: `docs/superpowers/specs/2026-09-23-portal-time-clock-design.md` (Status → Implemented)

- [ ] **Step 1: Embed compact clock**

At top of dashboard template (before KPI cards / after error banners):

```html
<app-portal-time-clock mode="compact" (punched)="onTimeClockPunched()" />
```

Import component; add:

```typescript
async onTimeClockPunched(): Promise<void> {
  await this.loadDashboard(); // existing reload method name — use whatever loads getEmployeeWorkspaceDashboard
}
```

- [ ] **Step 2: Manual verification checklist**

1. Portal login as payroll-enabled employee → role home shows compact clock; status without username search.  
2. Time in with Office + selfie; today cards update.  
3. Open `/admin/time-clock` full page; time out with selfie.  
4. Unauthenticated `GET /admin/employee-workspace/time-clock/status` → 401.  
5. `GET /payroll/time-clock/status` → 404.  
6. Visit `/time-clock` → login with returnUrl; after login land on Time Clock.  
7. Hub no longer shows Time Clock tile.  
8. Payroll copy-link opens login→time-clock path.

- [ ] **Step 3: Mark spec Implemented + commit**

```bash
git add frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html docs/superpowers/specs/2026-09-23-portal-time-clock-design.md
git commit -m "Embed compact portal time clock on employee workspace."
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Session APIs under employee-workspace | 1 |
| Shared compact + full UI | 3, 4, 5 |
| Remove public page + hub tile | 4 |
| Disable public API | 1 |
| Payroll copy-link update | 4 |
| Same punch rules | 1, 3 |
| Login returnUrl | 4 |
| Workspace access for portal roles | 1 |

No TBD placeholders. Method names consistent across tasks (`getTimeClockStatusForUser`, `portalTimeIn`, `PortalTimeClockComponent`).
