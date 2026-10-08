# Settings RBAC, Printing Hub, and Time Clock Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activate Settings with DB-backed fine-grained roles/permissions, host Printing Generator under Settings, wire User Management to those roles, and hide Time Clock unless the user is payroll-enabled — without regressing seeded role access.

**Architecture:** Code-owned permission catalog; `pcmazing_roles` + `pcmazing_role_permissions`; auth/`/me` returns `roleId`, `permissionKeys`, `payrollEnabled`; Nest `@RequirePermissions` + async DB lookup (Super Admin bypass); Angular nav/routes filter by keys; Settings shell with left sub-nav (Roles & access, Printing).

**Tech Stack:** NestJS, PostgreSQL migrations, Angular admin, Jest colocated specs, existing admin UI patterns.

**Spec:** `docs/superpowers/specs/2026-10-08-settings-rbac-and-time-clock-visibility-design.md`

## Global Constraints

- Permission keys: `{area}.{action}` snake_case, module areas align to `AdminModuleKey` (e.g. `quotation.view`, `settings.roles.manage`).
- Super Admin is `is_system=true`, locked, all permissions (`*` or full catalog); never edit/deactivate/soft-delete.
- Seed other business roles to match today’s `getAllowedModuleKeys` / `@Roles` behavior; Admin additionally gets Settings + Printing + User Management manage keys (day-one manager of Settings).
- Deactivate ≠ soft delete; soft delete blocked while users assigned.
- Time Clock nav/route requires `time_clock.view` **and** `payrollEnabled === true`.
- `RBAC_ENABLED=false` → backend permission/role guards allow-all (recovery); document in `.env.example`.
- PowerShell: use `;` not `&&`.
- No unrelated visual redesign; reuse Printing Generator page component.
- Prefer thin helpers + existing patterns over new frameworks.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/sql/migrations/073_settings_rbac_roles.sql` | Tables, `role_id` on users, seed roles/permissions, backfill |
| `backend/src/admin/rbac/permission-catalog.ts` | Curated permission groups + keys |
| `backend/src/admin/rbac/permission.util.ts` | `hasPermission`, slugify, normalize |
| `backend/src/admin/rbac/permissions.decorator.ts` | `@RequirePermissions(...)` |
| `backend/src/admin/rbac/permissions.guard.ts` | Async key check vs DB |
| `backend/src/admin/rbac/roles-admin.service.ts` | Role CRUD + matrix replace |
| `backend/src/admin/rbac/roles-admin.controller.ts` | Settings Roles API |
| `backend/src/admin/rbac/rbac.service.ts` | Expand: list assignable roles, resolve keys for user |
| `backend/src/admin/auth/auth.service.ts` | Attach `roleId`, `permissionKeys`, `payrollEnabled` |
| `backend/src/admin/auth/guards/jwt-auth.guard.ts` | JWT carries `roleId` |
| Controllers using `@Roles` | Switch to `@RequirePermissions` |
| `frontend/.../rbac/admin-permissions.ts` | `hasPermission`, module↔view key map |
| `frontend/.../services/admin-auth.service.ts` | Extended `AdminAuthUser` |
| `frontend/.../pages/settings/*` | Settings shell + roles page |
| `frontend/.../admin.routes.ts`, `admin-modules.data.ts` | Routes/nav/redirects |
| `frontend/.../layout/admin-layout.component.ts` | Nav filter by permissions + payroll |
| `frontend/.../user-management/*` | Roles from API |
| Spec status → Implemented when done | |

---

### Task 1: Permission catalog + pure helpers (TDD)

**Files:**
- Create: `backend/src/admin/rbac/permission-catalog.ts`
- Create: `backend/src/admin/rbac/permission.util.ts`
- Create: `backend/src/admin/rbac/permission.util.spec.ts`

**Interfaces:**
- Produces:
  - `export type PermissionKey = string`
  - `export type PermissionGroup = { id: string; label: string; permissions: { key: PermissionKey; label: string }[] }`
  - `export const PERMISSION_CATALOG: PermissionGroup[]`
  - `export function allPermissionKeys(): string[]`
  - `export function isKnownPermissionKey(key: string): boolean`
  - `export function hasPermission(keys: string[] | 'all', required: string | string[]): boolean`
  - `export function slugifyRoleName(name: string): string`

- [ ] **Step 1: Write failing tests**

```typescript
// permission.util.spec.ts
import { hasPermission, slugifyRoleName, isKnownPermissionKey } from './permission.util';
import { PERMISSION_CATALOG, allPermissionKeys } from './permission-catalog';

describe('permission.util', () => {
  it('slugifyRoleName', () => {
    expect(slugifyRoleName('Sales Manager')).toBe('sales_manager');
  });
  it('hasPermission all wildcard', () => {
    expect(hasPermission('all', 'quotation.view')).toBe(true);
    expect(hasPermission(['*'], 'quotation.create')).toBe(true);
  });
  it('hasPermission requires every key when array', () => {
    expect(hasPermission(['quotation.view'], ['quotation.view', 'quotation.create'])).toBe(false);
    expect(hasPermission(['quotation.view', 'quotation.create'], ['quotation.view'])).toBe(true);
  });
  it('catalog includes module view keys', () => {
    const keys = allPermissionKeys();
    expect(keys).toContain('settings.view');
    expect(keys).toContain('settings.roles.manage');
    expect(keys).toContain('time_clock.view');
    expect(keys).toContain('printing_generator.view');
    expect(isKnownPermissionKey('not.a.real.key')).toBe(false);
  });
  it('catalog is non-empty grouped', () => {
    expect(PERMISSION_CATALOG.length).toBeGreaterThan(5);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd backend; npx jest src/admin/rbac/permission.util.spec.ts --no-cache
```

Expected: FAIL (modules missing)

- [ ] **Step 3: Implement catalog + util**

Catalog must include at least one `{moduleKey}.view` for every `AdminModuleKey` in `frontend/src/app/admin/rbac/admin-roles.ts`, plus action keys used by migrated controllers:

- `user_management.view`, `user_management.create`, `user_management.edit`, `user_management.deactivate`
- `payroll.view`, `payroll.run`, `payroll.edit`
- `printing_generator.view`, `printing_generator.templates.edit`
- `company_expenses.view`, `company_expenses.create`, `company_expenses.edit`, `company_expenses.delete`
- `sales_dashboard.view` (and other dashboard `.view` keys)
- `settings.view`, `settings.roles.manage`
- CRUD-style keys for quotation, inventory, sales_order, job_order, etc. (`.view`/`.create`/`.edit`/`.delete` where the module has those ops)

```typescript
// permission.util.ts (core)
export function hasPermission(keys: string[] | 'all', required: string | string[]): boolean {
  if (keys === 'all' || (Array.isArray(keys) && keys.includes('*'))) return true;
  const need = Array.isArray(required) ? required : [required];
  const set = new Set(keys);
  return need.every((k) => set.has(k));
}

export function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
```

- [ ] **Step 4: Run — expect PASS**

```powershell
cd backend; npx jest src/admin/rbac/permission.util.spec.ts --no-cache
```

- [ ] **Step 5: Commit**

```powershell
git add backend/src/admin/rbac/permission-catalog.ts backend/src/admin/rbac/permission.util.ts backend/src/admin/rbac/permission.util.spec.ts
git commit -m "feat(rbac): add permission catalog and helpers"
```

---

### Task 2: Migration — tables, seed roles/permissions, backfill `role_id`

**Files:**
- Create: `backend/src/sql/migrations/073_settings_rbac_roles.sql`

**Interfaces:**
- Produces tables `pcmazing_roles`, `pcmazing_role_permissions`; column `pcmazing_admin_users.role_id`
- Seed role names exactly: `Super Admin`, `Admin`, `Manager`, `Assistant Manager`, `Marketing Lead`, `Marketing`, `Sales Manager`, `Assistant Sales Manager`, `Developer`, `Project Manager`

- [ ] **Step 1: Write migration SQL**

```sql
-- 073_settings_rbac_roles.sql

CREATE TABLE IF NOT EXISTS pcmazing_roles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pcmazing_roles_slug_alive
  ON pcmazing_roles (slug) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS pcmazing_role_permissions (
  role_id BIGINT NOT NULL REFERENCES pcmazing_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE pcmazing_admin_users
  ADD COLUMN IF NOT EXISTS role_id BIGINT NULL REFERENCES pcmazing_roles(id);

-- Seed roles (idempotent by slug)
INSERT INTO pcmazing_roles (name, slug, is_system, is_active)
VALUES
  ('Super Admin', 'super_admin', TRUE, TRUE),
  ('Admin', 'admin', FALSE, TRUE),
  ('Manager', 'manager', FALSE, TRUE),
  ('Assistant Manager', 'assistant_manager', FALSE, TRUE),
  ('Marketing Lead', 'marketing_lead', FALSE, TRUE),
  ('Marketing', 'marketing', FALSE, TRUE),
  ('Sales Manager', 'sales_manager', FALSE, TRUE),
  ('Assistant Sales Manager', 'assistant_sales_manager', FALSE, TRUE),
  ('Developer', 'developer', FALSE, TRUE),
  ('Project Manager', 'project_manager', FALSE, TRUE)
ON CONFLICT DO NOTHING;
-- If ON CONFLICT unsupported without constraint name, use WHERE NOT EXISTS inserts per slug instead.
```

Then insert permissions:

| Role slug | Permission set |
|-----------|----------------|
| `super_admin` | none required in DB (runtime `*`); optional full catalog insert OK |
| `admin` | `settings.view`, `settings.roles.manage`, all `printing_generator.*`, all `user_management.*`, all `payroll.*`, plus `profile.view` |
| `manager`, `assistant_manager`, `sales_manager`, `assistant_sales_manager` | Match ops/sales module `.view` (+ create/edit where those roles use APIs today): `sales_dashboard`, `contact_inquiries`, `customer_reviews`, `sales_order`, `job_order`, `quotation`, `local_price_lists`, `inventory`, `company_expenses`, `profile`, `time_clock` + expense/dashboard action keys used by `@Roles('admin','sales')` |
| `marketing_lead` | `marketing_dashboard.view`, `lead_generation.view` (+ edit as needed), `organization_team.view`, `profile.view`, `time_clock.view` |
| `marketing` | `marketing_dashboard.view`, `lead_generation.view`, `profile.view`, `time_clock.view` |
| `developer`, `project_manager` | `developers_dashboard.view`, `projects.view`, `kanban.view`, `profile.view`, `time_clock.view` (+ project edit keys if APIs need them) |

Backfill:

```sql
UPDATE pcmazing_admin_users u
SET role_id = r.id
FROM pcmazing_roles r
WHERE u.role_id IS NULL
  AND r.deleted_at IS NULL
  AND lower(regexp_replace(trim(u.role), '[\s_-]+', '', 'g'))
    = lower(regexp_replace(trim(r.name), '[\s_-]+', '', 'g'));
```

- [ ] **Step 2: Apply migration** using the project’s usual migrate path (see `docs/deployment.md` / existing migrate script). Confirm tables exist.

- [ ] **Step 3: Commit**

```powershell
git add backend/src/sql/migrations/073_settings_rbac_roles.sql
git commit -m "feat(rbac): add roles tables and seed migration"
```

---

### Task 3: Backend roles admin API (CRUD + matrix)

**Files:**
- Create: `backend/src/admin/rbac/roles-admin.service.ts`
- Create: `backend/src/admin/rbac/roles-admin.controller.ts`
- Create: `backend/src/admin/rbac/dto/role.dto.ts`
- Modify: `backend/src/admin/rbac/rbac.module.ts` (register providers/controllers)
- Modify: `backend/src/admin/rbac/rbac.service.ts` — `listAssignableRoleNames()`, `getPermissionKeysForRoleId(roleId)`, keep `isEnabled()`
- Test: `backend/src/admin/rbac/roles-admin.service.spec.ts` (unit with mocked `DatabaseService` **or** pure extract of validation helpers if DB mock is heavy — prefer testing `assertCanMutateRole` helper)

**Interfaces:**
- Produces HTTP (all JWT + `settings.roles.manage` once guard exists; until Task 5 use `@Roles('admin')` temporarily then swap):
  - `GET /admin/roles` → list roles `{ id, name, slug, isSystem, isActive, deletedAt, permissionKeys[] }` (exclude soft-deleted by default; `?includeDeleted=1` for Super Admin optional — V1 omit deleted)
  - `GET /admin/roles/catalog` → `PERMISSION_CATALOG`
  - `POST /admin/roles` body `{ name, permissionKeys: string[] }`
  - `PATCH /admin/roles/:id` body `{ name?, isActive?, permissionKeys? }`
  - `POST /admin/roles/:id/soft-delete` → 400 if assignees > 0
- Produces service rules:
  - System role: reject name/permission/isActive/soft-delete changes with `BadRequestException` or `ForbiddenException`
  - Unknown permission key → `BadRequestException`
  - Soft delete: `UPDATE ... SET deleted_at = NOW()` after `SELECT COUNT(*) FROM pcmazing_admin_users WHERE role_id = $1` is 0 (also count legacy tblusers by role name if still in use)

- [ ] **Step 1: Implement DTOs + service methods** with the rules above (validate keys via `isKnownPermissionKey`).

- [ ] **Step 2: Wire controller + module**

- [ ] **Step 3: Manual smoke** (with Nest running): list catalog, create role, patch permissions, deactivate, soft-delete empty role.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/admin/rbac
git commit -m "feat(rbac): roles admin API for Settings"
```

---

### Task 4: Auth payload — `roleId`, `permissionKeys`, `payrollEnabled`

**Files:**
- Modify: `backend/src/admin/auth/auth.service.ts` — extend `AdminAuthUser`
- Modify: `backend/src/admin/auth/guards/jwt-auth.guard.ts` — `AdminJwtPayload` adds `roleId: number | null`
- Modify: `backend/src/admin/rbac/rbac.service.ts` — resolve permissions
- Modify: `frontend/src/app/admin/services/admin-auth.service.ts` — mirror fields

**Interfaces:**
- Produces:

```typescript
export interface AdminAuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roleId: number | null;
  permissionKeys: string[]; // Super Admin: ['*']
  payrollEnabled: boolean;
  profileImageUrl?: string | null;
  source: 'pcmazing_admin_users' | 'tblusers';
}
```

- JWT payload: `{ sub, username, role, roleId, source }` (not full permission list — guard loads from DB)

- [ ] **Step 1: Implement `RbacService.resolveAuthAccess(roleName, roleId)`**

```typescript
async resolveAuthAccess(roleName: string, roleId: number | null): Promise<{ permissionKeys: string[] }> {
  if (isSuperAdmin(roleName)) {
    return { permissionKeys: ['*'] };
  }
  if (roleId == null) {
    return { permissionKeys: ['profile.view'] };
  }
  const keys = await this.getPermissionKeysForRoleId(roleId);
  return { permissionKeys: keys.length ? keys : ['profile.view'] };
}
```

- [ ] **Step 2: Load `payrollEnabled`** from `pcmazing_user_payroll` (same lookup User Management uses) in `getProfile` / login mapping; default `false`.

- [ ] **Step 3: Attach fields on every `AdminAuthUser` construction path** (pcmazing + legacy).

- [ ] **Step 4: Update frontend `AdminAuthUser`** and ensure login/`getProfile` store the new fields (no crash if older server omits — default `permissionKeys: []`, `payrollEnabled: false`, `roleId: null`).

- [ ] **Step 5: Commit**

```powershell
git add backend/src/admin/auth backend/src/admin/rbac/rbac.service.ts frontend/src/app/admin/services/admin-auth.service.ts
git commit -m "feat(auth): expose roleId, permissions, payrollEnabled"
```

---

### Task 5: `PermissionsGuard` + migrate `@Roles` call sites

**Files:**
- Create: `backend/src/admin/rbac/permissions.decorator.ts`
- Create: `backend/src/admin/rbac/permissions.guard.ts`
- Modify: controllers listed by grep `@Roles(`:
  - `backend/src/admin/users/users.controller.ts`
  - `backend/src/admin/payroll/payroll.controller.ts`
  - `backend/src/admin/printing/printing-settings.controller.ts`
  - `backend/src/admin/printing/printing-templates.controller.ts`
  - `backend/src/admin/company-expenses/company-expenses.controller.ts`
  - `backend/src/admin/dashboard/dashboard.controller.ts`
  - `backend/src/admin/rbac/roles-admin.controller.ts`
- Keep `RolesGuard` working for any remaining `@Roles` during migration; prefer finishing all known call sites in this task.

**Interfaces:**
- Produces:

```typescript
// permissions.decorator.ts
export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...keys: string[]) => SetMetadata(PERMISSIONS_KEY, keys);

// permissions.guard.ts — async CanActivate
// if !rbacService.isEnabled() → true
// if no metadata → true
// if isSuperAdmin(user.role) → true
// load keys by user.roleId; hasPermission(keys, required) or 403
```

Mapping guide:

| Old | New |
|-----|-----|
| `@Roles('admin')` on users | `@RequirePermissions('user_management.view')` on reads; tighter keys on mutate |
| `@Roles('admin')` on payroll | `@RequirePermissions('payroll.view')` / `payroll.run` / `payroll.edit` per handler |
| `@Roles('admin')` on printing | `@RequirePermissions('printing_generator.view')` or `printing_generator.templates.edit` |
| `@Roles('admin','sales')` on expenses/dashboard | `@RequirePermissions('company_expenses.view')` etc. / `sales_dashboard.view` |
| Roles admin API | `@RequirePermissions('settings.roles.manage')` |

- [ ] **Step 1: Implement decorator + guard; register in `RbacModule`; export for other modules.**

- [ ] **Step 2: Migrate each controller** — replace `@Roles` with `@RequirePermissions`; use `@UseGuards(JwtAuthGuard, PermissionsGuard)`.

- [ ] **Step 3: Ensure seeded sales/ops roles include expense/dashboard keys** (fix migration seed if 403 on smoke).

- [ ] **Step 4: Commit**

```powershell
git add backend/src/admin
git commit -m "feat(rbac): PermissionsGuard and migrate role gates"
```

---

### Task 6: Frontend permission helpers + nav + Time Clock visibility

**Files:**
- Create: `frontend/src/app/admin/rbac/admin-permissions.ts`
- Create: `frontend/src/app/admin/rbac/admin-permissions.spec.ts` (if frontend jest/vitest exists; otherwise skip unit and rely on manual — check `frontend/package.json` for test runner; if none, skip spec file)
- Modify: `frontend/src/app/admin/rbac/admin-roles.ts` — keep role heuristics for login entry routes; add `getAllowedModuleKeysFromPermissions(keys: string[]): Set<AdminModuleKey> | 'all'`
- Modify: `frontend/src/app/admin/layout/admin-layout.component.ts` — filter nav using permissions + payroll
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts` — `filterNavSectionsForRole` accept permissions path **or** new `filterNavSectionsForAccess(...)`
- Modify: route guards that call `canAccessModule` (e.g. `adminRoleGuard`) to use permissions from auth service
- Modify: `frontend/src/app/admin/pages/time-clock/*` or guard on `time-clock` route

**Interfaces:**
- Produces:

```typescript
export function hasPermission(keys: string[] | null | undefined, required: string | string[]): boolean {
  if (!keys?.length) return false;
  if (keys.includes('*')) return true;
  const need = Array.isArray(required) ? required : [required];
  return need.every((k) => keys.includes(k));
}

export function modulesFromPermissions(keys: string[] | null | undefined): Set<AdminModuleKey> | 'all' {
  if (keys?.includes('*')) return 'all';
  const set = new Set<AdminModuleKey>();
  // for each AdminModuleKey, if hasPermission(keys, `${key}.view`) add key
  // always allow 'profile' if profile.view or authenticated
  return set;
}
```

Nav Time Clock rule:

```typescript
const modules = modulesFromPermissions(user.permissionKeys);
// after building allowed set:
if (!user.payrollEnabled) {
  if (modules !== 'all') modules.delete('time_clock');
  else {
    /* when 'all', still hide time_clock in filterNav by special case */
  }
}
```

Implement explicitly: even Super Admin without payrollEnabled **hides** Time Clock (spec: payroll flag gates visibility). Super Admin can still open Settings.

Route guard for `/admin/time-clock`: if `!payrollEnabled || !hasPermission(..., 'time_clock.view')` → navigate to `getRoleHomeRoute(role)`.

- [ ] **Step 1: Implement `admin-permissions.ts` and wire layout + guards.**

- [ ] **Step 2: Manual check** — payroll-disabled user: no Time Clock; payroll-enabled seeded sales: Time Clock visible.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/app/admin/rbac frontend/src/app/admin/layout frontend/src/app/admin/data/admin-modules.data.ts
git commit -m "feat(admin): permission-based nav and hide Time Clock without payroll"
```

---

### Task 7: Settings shell + move Printing Generator

**Files:**
- Create: `frontend/src/app/admin/pages/settings/settings-shell-page.component.ts`
- Create: `frontend/src/app/admin/pages/settings/settings-shell-page.component.html`
- Create: `frontend/src/app/admin/pages/settings/settings-shell-page.component.css`
- Create: `frontend/src/app/admin/pages/settings/settings-roles-page.component.ts` (stub list OK until Task 8 — or empty router-outlet child)
- Modify: `frontend/src/app/admin/admin.routes.ts`
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts`

**Interfaces:**
- Routes:

```typescript
{
  path: 'settings',
  component: SettingsShellPageComponent,
  canActivate: [/* permission guard settings.view */],
  children: [
    { path: '', pathMatch: 'full', redirectTo: 'roles' },
    { path: 'roles', component: SettingsRolesPageComponent, data: { module: 'settings' } },
    { path: 'printing', component: PrintingGeneratorPageComponent, data: { module: 'printing_generator' } },
  ],
},
{ path: 'modules/settings', redirectTo: '/admin/settings', pathMatch: 'full' },
{ path: 'modules/printing-generator', redirectTo: '/admin/settings/printing', pathMatch: 'full' },
```

- Nav: `settings` → route `/admin/settings`, `status: 'active'`; **remove** `printing_generator` from System Management section item list (module can remain in `ADMIN_MODULES` for redirects/guards).
- Shell UI: left sub-nav links “Roles & access” → `roles`, “Printing Generator” → `printing`; router-outlet for children. Match existing admin page spacing/typography.

- [ ] **Step 1: Build shell + routes + nav updates + redirects.**

- [ ] **Step 2: Manual** — Settings active; Printing only under Settings; old printing URL redirects.

- [ ] **Step 3: Commit**

```powershell
git add frontend/src/app/admin/pages/settings frontend/src/app/admin/admin.routes.ts frontend/src/app/admin/data/admin-modules.data.ts
git commit -m "feat(admin): Settings shell and move Printing Generator"
```

---

### Task 8: Roles & access UI (create / update / deactivate / soft delete / matrix)

**Files:**
- Modify: `frontend/src/app/admin/pages/settings/settings-roles-page.component.ts`
- Create: `frontend/src/app/admin/pages/settings/settings-roles-page.component.html`
- Create: `frontend/src/app/admin/pages/settings/settings-roles-page.component.css`
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` — roles API methods

**Interfaces:**
- API helpers:

```typescript
listRoles() // GET /admin/roles
getPermissionCatalog() // GET /admin/roles/catalog
createRole(body)
updateRole(id, body)
softDeleteRole(id)
```

- UI:
  - Left/main list of roles with badges: System / Inactive
  - Detail: name field (disabled if system), Active toggle, grouped permission checkboxes from catalog, Save
  - Actions: Soft delete (confirm; show API error if assignees remain)
  - Create role button → name + empty/default permissions
  - Clear error/success messages on failure

- [ ] **Step 1: Wire API methods.**

- [ ] **Step 2: Build roles page UI** following existing admin forms (user-management patterns).

- [ ] **Step 3: Manual** — Admin/Super Admin can edit Admin role matrix; cannot mutate Super Admin; soft delete blocked when user assigned.

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/app/admin/pages/settings frontend/src/app/admin/services/admin-api.service.ts
git commit -m "feat(admin): Roles and access Settings UI"
```

---

### Task 9: User Management uses DB roles + `role_id`

**Files:**
- Modify: `backend/src/admin/users/users.service.ts` — `listRoles` / create / update set `role_id` + `role` name from `pcmazing_roles`
- Modify: `backend/src/admin/rbac/rbac.service.ts` — `listRoles()` returns active non-deleted role **names** (or `{id,name}` if FE updated)
- Modify: `frontend/.../user-management-page.component.ts` — consume roles from API (already `listUserRoles()`); ensure inactive/deleted omitted

**Interfaces:**
- `GET /admin/users/roles` returns active assignable role names (from DB).
- Create/update user: resolve name → `role_id`; reject unknown/inactive/deleted roles with `400`.

- [ ] **Step 1: Backend resolve + persist `role_id`.**

- [ ] **Step 2: Confirm FE dropdown updates after creating a role in Settings** (may need refresh list on User Management open — already loads on init).

- [ ] **Step 3: Commit**

```powershell
git add backend/src/admin/users backend/src/admin/rbac frontend/src/app/admin/pages/user-management
git commit -m "feat(users): assign DB roles with role_id sync"
```

---

### Task 10: Docs, env example, acceptance pass

**Files:**
- Modify: `backend/.env.example` — document `RBAC_ENABLED` and note permission-key enforcement when enabled
- Modify: `docs/superpowers/specs/2026-10-08-settings-rbac-and-time-clock-visibility-design.md` — Status → Implemented
- Optional: short note in `docs/deployment.md` if migrations are listed there

- [ ] **Step 1: Update `.env.example` comments.**

- [ ] **Step 2: Run acceptance checklist from spec** (Super Admin, Admin Settings, sales seed modules, Time Clock payroll gate, printing redirect, soft-delete guard, `RBAC_ENABLED=false` recovery).

- [ ] **Step 3: Commit**

```powershell
git add backend/.env.example docs/superpowers/specs/2026-10-08-settings-rbac-and-time-clock-visibility-design.md docs/deployment.md
git commit -m "docs: Settings RBAC acceptance and env notes"
```

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Tables + seed + backfill | 2 |
| Fine-grained catalog | 1 |
| Role CRUD / deactivate / soft delete / matrix | 3, 8 |
| Super Admin locked | 3, 8 |
| Auth permissionKeys + payrollEnabled | 4 |
| FE + BE enforcement | 5, 6 |
| Settings sub-nav + Printing move + redirects | 7 |
| User Management DB roles | 9 |
| Time Clock hidden without payroll | 6 |
| RBAC_ENABLED escape | 5, 10 |
| Acceptance | 10 |

## Placeholder / consistency notes

- Module area for quotation keys is `quotation.*` (matches `AdminModuleKey`), not `quotations.*`.
- JWT stores `roleId`; permission keys loaded in guard + returned on `/me`.
- Super Admin Time Clock still requires `payrollEnabled` for nav visibility.
