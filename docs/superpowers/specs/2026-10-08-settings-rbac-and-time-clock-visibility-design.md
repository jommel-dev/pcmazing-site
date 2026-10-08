# Settings RBAC, Printing Hub, and Time Clock Visibility

**Date:** 2026-10-08  
**Status:** Approved for planning  
**Scope:** Activate Settings; fine-grained role/permission management; move Printing Generator under Settings; hide Time Clock when payroll is disabled.

## Goal

Give Super Admin and Admin a centralized **Settings** area to manage roles and fine-grained permissions, keep system tools (Printing Generator) in that same hub, wire User Management to DB roles, and stop showing Time Clock to users who are not payroll-enabled — without breaking existing role behavior on day one.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Permission depth | Fine-grained curated action keys covering all current admin modules (view/create/edit/delete/approve-style where applicable) |
| Seed strategy | Super Admin locked/system-only; other current business roles seeded as editable with permissions matching today’s hardcoded maps |
| Who manages Settings / RBAC | Super Admin + Admin |
| Settings layout | Left sub-nav under Settings (Roles & access, Printing Generator) |
| Role lifecycle | Deactivate ≠ soft delete (see below) |
| Architecture | Permission-key RBAC: code catalog + DB role↔permission rows; FE and BE both enforce keys |

## Out of scope

- Business profile / branches / other Settings stubs beyond Roles & access and Printing Generator
- CASL-style conditional policy engine
- Per-button UI hiding beyond what permission keys already cover for V1 screens
- Hard-deleting roles from the database

## Architecture

### Data model

**`pcmazing_roles`**

| Column | Notes |
| --- | --- |
| `id` | PK |
| `name` | Display label (e.g. `Sales Manager`) |
| `slug` | Stable key (e.g. `sales_manager`), unique among non-deleted |
| `is_system` | `true` for Super Admin only in V1 |
| `is_active` | Deactivate flag |
| `deleted_at` | Soft delete |
| `created_at` / `updated_at` | Timestamps |

**`pcmazing_role_permissions`**

| Column | Notes |
| --- | --- |
| `role_id` | FK → `pcmazing_roles` |
| `permission_key` | String matching code catalog (e.g. `quotations.create`) |
| PK | `(role_id, permission_key)` |

**Users**

- Prefer `role_id` on `pcmazing_admin_users` (nullable during migration) with `role` display string kept in sync for legacy UI/logs.
- Legacy `tblusers` / `tblrbac`: continue resolving by role name where still used; seed names must match existing labels so assignment does not break.
- `payroll_enabled` on `pcmazing_user_payroll` remains the payroll enrollment flag (unchanged semantics).

### Permission catalog (code-owned)

- Shared catalog definition (backend source of truth; frontend consumes via API or shared constants).
- Grouped by module (Users, Quotations, Inventory, Payroll, Settings, Printing, …).
- Key convention (fixed): `{area}.{action}` in `snake_case` areas aligned to admin module keys where possible — e.g. `quotation.view`, `quotation.create`, `inventory.edit`, `time_clock.view`, `user_management.view`, `settings.view`, `settings.roles.manage`, `printing_generator.view`, `printing_generator.templates.edit`, `payroll.run`.
- Sidebar/module visibility uses `{moduleKey}.view` for each `AdminModuleKey`.
- Seed maps replicate current `getAllowedModuleKeys` / `@Roles` behavior so day-one access does not regress.

### Auth payload

Login / session / profile payload includes:

- `role` (display name)
- `roleId`
- `permissionKeys: string[]`  
  Super Admin: treat as all permissions (`*` or expanded full catalog); never editable via Settings.

### Enforcement

| Layer | Behavior |
| --- | --- |
| Frontend nav | Filter modules by permission keys; Settings visible to Super Admin + Admin (seeded `settings.*`) |
| Frontend routes | Guard by required permission(s) for the page |
| Backend | `@RequirePermissions(...)` (or evolved `RolesGuard`) checks keys; Super Admin bypass |
| Escape hatch | Existing `RBAC_ENABLED=false` continues to allow-all for emergencies |

Migrate call sites from coarse `@Roles('admin'|'sales'|…)` to permission keys in the same delivery so Settings grants cannot disagree with the API.

## Settings UI

### Shell

- Activate Settings (replace coming-soon stub). Recommended route family:
  - `/admin/settings` — shell with left sub-nav
  - `/admin/settings/roles` — Roles & access
  - `/admin/settings/printing` — Printing Generator (existing feature hosted here)
- Main sidebar: **Settings** active under System Management; remove standalone **Printing Generator** entry.
- Redirect `/admin/modules/printing-generator` → Settings → Printing.
- Redirect `/admin/modules/settings` → `/admin/settings` (or roles default child).

### Roles & access

Capabilities:

1. **Create** role (name → slug).
2. **Update** name and permission matrix (replace set on save).
3. **Deactivate** — `is_active = false`: hidden from User Management assign list; users already on the role keep it and keep their permissions until reassigned.
4. **Soft delete** — set `deleted_at`: blocked while any user still assigned that role (must reassign first); not shown in assign list. V1 has no restore UI (DB row retained for audit; restore is a later enhancement if needed).
5. **Super Admin** — visible as system/locked; cannot edit permissions, deactivate, or soft delete.

Permission matrix: grouped checkboxes from catalog; save is atomic replace of that role’s permission rows.

Who can open: Super Admin (bypass) and Admin via seeded `settings.view` + `settings.roles.manage` (and printing keys for the Printing child). Enforcement is permission-based; “Super Admin + Admin” is the day-one seed outcome, not a hardcoded second gate forever.

### Printing Generator

- Move navigation/hosting into Settings sub-nav; reuse existing printing page/components and APIs.
- Printing APIs remain gated by printing permissions (seeded equivalent of today’s admin-only access).

## User Management

- Role dropdown loads **active, non-deleted** roles from `pcmazing_roles` (not hardcoded `PLACEHOLDER_ROLES` / `BUSINESS_ROLE_LABELS` alone).
- Assigning a user sets `role_id` + synced `role` name.
- Payroll enabled checkbox unchanged.

## Time Clock visibility

- If `payroll_enabled` is false for the signed-in user:
  - Do **not** show Time Clock in dashboard/nav.
  - Route guard blocks `/admin/time-clock` (redirect to role home or profile).
- Keep existing post-login behavior: only land on Time Clock when `canTimeIn` is true.
- Payroll-enabled users still need the Time Clock module permission (seeded for roles that have it today) **and** `payroll_enabled`.

## Role lifecycle rules

| Action | Effect |
| --- | --- |
| Deactivate | Off assign list; existing assignees keep role + permissions |
| Soft delete | Requires zero assignees; then hidden permanently from assign UI (`deleted_at` set) |
| Super Admin | No deactivate / soft delete / permission edit |

## Seed / migration

1. Create tables.
2. Insert Super Admin (`is_system=true`) and current business roles (Admin, Manager, Assistant Manager, Marketing Lead, Marketing, Sales Manager, Assistant Sales Manager, Developer, Project Manager).
3. Insert permission rows matching today’s hardcoded module maps and admin-gated APIs.
4. Backfill `pcmazing_admin_users.role_id` by matching existing `role` strings (normalized).
5. Do not invent new day-one access; unknown/unmatched roles get no extra module permissions (profile-only), except Super Admin heuristics already in code.

## Error handling

- Soft delete with assignees → `400` with clear message to reassign first.
- Mutating Super Admin → `403` / `400`.
- Unknown permission keys on save → reject.
- Missing permission on API → `403`.
- Frontend: Settings load failure shows clear error; do not leave Printing/Roles half-broken without messaging.

## Testing / acceptance

- Super Admin: full nav including Settings; cannot edit Super Admin role.
- Admin: Settings → Roles & access + Printing; can create/update/deactivate roles; soft delete blocked when users assigned.
- Seeded Sales/ops user: same modules as today; no Settings unless granted.
- User Management lists only active roles; new custom role appears after create + activate.
- User with `payroll_enabled=false`: no Time Clock nav; direct URL blocked.
- User with `payroll_enabled=true` and time-clock view permission: Time Clock visible.
- Old Printing Generator URL redirects into Settings.
- With `RBAC_ENABLED=false`, system remains usable (allow-all) for recovery.

## Implementation notes

- Prefer one delivery that ships schema + seed + Settings UI + guard migration + Time Clock visibility + Printing nav move together.
- Preserve existing admin visual patterns (no unrelated redesign).
- Keep `RBAC_ENABLED` behavior documented in `.env.example`.
