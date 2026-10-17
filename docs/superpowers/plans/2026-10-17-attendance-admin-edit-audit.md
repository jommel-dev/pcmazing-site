# Attendance Admin Punch Edit + Audit Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins can edit existing attendance punches (time in / lunch out / lunch in / time out) with a required reason; every save is audited; HIRS shows a row indicator and an Attendance logs tab.

**Architecture:** Keep Bypass for fill-missing. Add `PATCH /admin/payroll/attendance/:id` that only overwrites non-null punches after validation. Persist history in new `pcmazing_attendance_audit_log`. List last edit onto Attendance rows via join/subquery; expose paginated logs API for the new tab.

**Tech Stack:** NestJS + PostgreSQL (migration + `ensurePayrollTables`), Angular HIRS payroll page, existing `payroll.edit` / `payroll.view` RBAC.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-17-attendance-admin-edit-audit-design.md`
- Edit only (no clear); reason min 8 chars; all four fields when already set
- Permission: edit=`payroll.edit`, logs view=`payroll.view`
- ASCII-safe UI copy (avoid fancy dashes that re-corrupt)

---

### Task 1: Migration + schema ensure for audit log

**Files:**
- Create: `backend/src/sql/migrations/082_attendance_audit_log.sql`
- Modify: `backend/src/admin/payroll/payroll.schema.ts` (`ensurePayrollTables`)

- [ ] **Step 1:** Add migration creating `pcmazing_attendance_audit_log` with columns/indexes from the spec.
- [ ] **Step 2:** Mirror `CREATE TABLE IF NOT EXISTS` + indexes in `ensurePayrollTables`.
- [ ] **Step 3:** Verify migration SQL is valid (no dependency on hard FK if other payroll tables omit them).

---

### Task 2: Pure validation helper + unit tests

**Files:**
- Modify: `backend/src/admin/payroll/attendance-lunch.util.ts`
- Modify: `backend/src/admin/payroll/attendance-lunch.util.spec.ts`

**Interfaces:**
- Produces: `assertAdminEditAllowed(current, next, workDate)` throwing Error messages suitable for BadRequestException

- [ ] **Step 1:** Write failing tests for: change-only (reject null current), order, Manila work date, at least one change.
- [ ] **Step 2:** Implement `assertAdminEditAllowed`.
- [ ] **Step 3:** Run util specs until green.

---

### Task 3: Backend edit + list logs APIs

**Files:**
- Create: `backend/src/admin/payroll/dto/edit-attendance-punch.dto.ts`
- Modify: `backend/src/admin/payroll/payroll.service.ts`
- Modify: `backend/src/admin/payroll/payroll.controller.ts`

**Interfaces:**
- Produces:
  - `editAttendancePunch(id, body, adminId): Promise<AttendanceRecord>`
  - `listAttendanceAuditLogs(page, limit, workDate?, q?, actorAdminId?): Promise<{ items, meta }>`
  - AttendanceRecord gains optional `lastEditedAt`, `lastEditedByAdminName`

- [ ] **Step 1:** Add DTO with optional ISO fields + required `reason`.
- [ ] **Step 2:** Implement service: load by id, payroll-enabled check, merge values, validate, UPDATE only changed columns, insert audit row with actor snapshot + meta.changes, sync OT / clear adjustment if time_out changed.
- [ ] **Step 3:** Extend `listAttendance` SELECT with last-edit subquery.
- [ ] **Step 4:** Implement `listAttendanceAuditLogs` with pagination + filters.
- [ ] **Step 5:** Controller routes:
  - `GET attendance/logs` **before** any `:id` route
  - `PATCH attendance/:id`
- [ ] **Step 6:** Smoke-check Nest compiles.

---

### Task 4: Frontend API + Attendance edit UI

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html`

- [ ] **Step 1:** Types + `editPayrollAttendance` / `listPayrollAttendanceLogs`.
- [ ] **Step 2:** Edit dialog state (fields for set punches, reason, save/error).
- [ ] **Step 3:** Actions column: Edit icon when any punch set; badge/tooltip for last edit.
- [ ] **Step 4:** Modal UI mirroring Bypass styling; convert datetime-local to ISO like Bypass.

---

### Task 5: Attendance logs tab

**Files:**
- Modify: same payroll-page component files

- [ ] **Step 1:** Add tab key `attendance_logs` / label `Attendance logs`.
- [ ] **Step 2:** Load logs on tab focus; filters workDate + search + pagination.
- [ ] **Step 3:** Table: When, Admin, Employee, Work date, Changes, Reason.

---

### Task 6: Verification

- [ ] **Step 1:** Backend unit tests for util.
- [ ] **Step 2:** Frontend build / lints on touched files.
- [ ] **Step 3:** Manual checklist from spec (edit, reject clear, logs list, bypass unchanged).
