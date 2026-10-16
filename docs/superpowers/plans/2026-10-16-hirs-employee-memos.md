# HIRS Employee Memos + Payroll→HIRS Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement task-by-task.

**Goal:** Admin issues formal employee memos under HIRS; employees must acknowledge via dashboard popup; rename Payroll nav/route to HIRS with redirect.

**Spec:** `docs/superpowers/specs/2026-10-16-hirs-employee-memos-design.md`

**Tech:** NestJS + PostgreSQL migration 080, Angular payroll page tab + employee dashboard modal, route rename.

## File map

| File | Role |
| --- | --- |
| `backend/src/sql/migrations/080_employee_memos.sql` | Table |
| `backend/scripts/apply-employee-memos-migration.mjs` | Apply helper |
| `backend/src/admin/payroll/employee-memos.util.ts` | Memo no + type helpers |
| `backend/src/admin/payroll/employee-memos.util.spec.ts` | Unit tests |
| `backend/src/admin/payroll/dto/employee-memo.dto.ts` | Create DTO |
| `backend/src/admin/payroll/payroll.service.ts` | Memo CRUD (or thin memos section) |
| `backend/src/admin/payroll/payroll.controller.ts` | Admin memo routes |
| `backend/src/admin/employee-workspace/*` | Pending/list/acknowledge |
| `frontend/.../admin-modules.data.ts` | Label HIRS, route `/admin/hirs` |
| `frontend/.../admin.routes.ts` | `hirs` path + payroll redirect |
| `frontend/.../payroll-page.component.*` | Memos tab + titles |
| `frontend/.../admin-api.service.ts` | Memo API client |
| `frontend/.../sales-employee-dashboard.component.*` | Popup + My memos |

---

### Task 1: Migration 080

Create `080_employee_memos.sql` + apply script. Commit.

### Task 2: Memo helpers (TDD)

`buildMemoNo(id, year)`, `normalizeMemoType`, types. Commit.

### Task 3: Admin + employee memo APIs

- Admin: list, create, get by id (`payroll.view` / `payroll.edit`)
- Employee: list mine, pending, acknowledge
- Header company info from printing settings when returning detail (optional join at read time)
- Commit.

### Task 4: HIRS rename (frontend routes/nav)

- Module label `HIRS`, route `/admin/hirs`, `data.module` stay `payroll`
- Add `path: 'payroll'` redirect to `hirs`
- Page H1 / loading copy say HIRS where user-facing
- Commit.

### Task 5: Admin Memos tab UI

- Tab on payroll page; create form; list; detail with logo header
- Commit.

### Task 6: Employee dashboard popup + list

- Load pending on dashboard init; blocking modal; acknowledge; My memos section
- Commit.

### Task 7: Verification

- Apply 080 locally; util tests; smoke create → login employee → ack
- Commit plan checkboxes if desired.
