# Payroll Employee Tools UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add required loan labels on payslips, cancel/restore/soft-delete for loans, confirmations on Employee tools mutations, and collapsed create forms on all three cards.

**Architecture:** Migration adds `label` + `deleted` status; loan APIs enforce lifecycle; ledger assembly uses `loan.label`; Angular Employee tools gain confirm wrappers, per-card collapse toggles, and restore/delete actions.

**Tech Stack:** NestJS, PostgreSQL migrations, Angular admin payroll page, Jest unit/service specs.

## Global Constraints

- Soft delete = loan `status = 'deleted'` (not hard delete, not `deleted_at`).
- List/API exclude `deleted`; restore only `cancelled` → `active`; never restore `deleted`.
- Loan `label` required on create (1–120 chars); ledger uses label, fallback `Loan #{id}`.
- Confirmations via `window.confirm` / `confirm(...)`.
- Collapse create/add forms by default on Loans, Commission entries, Manual deductions.
- Confirm before: create loan, save override, cancel/restore/delete loan, add/remove commission, add/remove deduction.
- No unrelated payroll redesign.

---

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/sql/migrations/076_payroll_loan_label_deleted.sql` | Schema: label + deleted status |
| `backend/scripts/apply-payroll-loan-label-migration.mjs` | Apply 076 locally |
| `backend/src/admin/payroll/payroll.schema.ts` | Ensure path mirrors 076 |
| `backend/src/admin/payroll/dto/loan.dto.ts` | Create/Update DTO fields |
| `backend/src/admin/payroll/payroll-payslip-ledger.util.ts` (+ spec) | Label on ledger lines |
| `backend/src/admin/payroll/payroll.service.ts` (+ loans spec) | CRUD lifecycle |
| `frontend/.../admin-api.service.ts` | Types + API payloads |
| `frontend/.../payroll-page.component.ts/html` | UX: label, confirm, collapse, restore/delete |

---

### Task 1: Migration 076 — loan label + deleted status

**Files:**
- Create: `backend/src/sql/migrations/076_payroll_loan_label_deleted.sql`
- Create: `backend/scripts/apply-payroll-loan-label-migration.mjs` (copy pattern from `apply-payroll-ledger-migration.mjs` or equal-installment apply script if present)
- Modify: `backend/src/admin/payroll/payroll.schema.ts` — mirror label column + status CHECK including `deleted`

**Interfaces:**
- Produces: `pcmazing_payroll_loans.label VARCHAR(120) NOT NULL`; status IN (`active`,`paid`,`cancelled`,`deleted`)

- [ ] **Step 1: Write migration SQL**

```sql
ALTER TABLE pcmazing_payroll_loans
  ADD COLUMN IF NOT EXISTS label VARCHAR(120);

UPDATE pcmazing_payroll_loans
SET label = 'Loan #' || id::text
WHERE label IS NULL OR BTRIM(label) = '';

ALTER TABLE pcmazing_payroll_loans
  ALTER COLUMN label SET NOT NULL;

ALTER TABLE pcmazing_payroll_loans
  DROP CONSTRAINT IF EXISTS pcmazing_payroll_loans_status_check;
-- Also drop any named CHECK on status if different; then:
ALTER TABLE pcmazing_payroll_loans
  ADD CONSTRAINT ck_pcmazing_payroll_loans_status
  CHECK (status IN ('active', 'paid', 'cancelled', 'deleted'));
```

Inspect existing constraint name in DB/schema and drop the correct one (074 used inline CHECK; may be `pcmazing_payroll_loans_status_check`).

- [ ] **Step 2: Mirror in `payroll.schema.ts` ensure SQL** — add `label` to CREATE TABLE / ALTER ADD COLUMN + backfill + status CHECK including `deleted`.

- [ ] **Step 3: Add apply script** and run it against local DB.

- [ ] **Step 4: Commit** `feat(payroll): migration for loan label and deleted status`

---

### Task 2: Ledger uses loan label (TDD)

**Files:**
- Modify: `backend/src/admin/payroll/payroll-payslip-ledger.util.ts`
- Modify: `backend/src/admin/payroll/payroll-payslip-ledger.util.spec.ts`
- Any caller that builds `input.loans` must pass `label` (wire in Task 3 if not already)

**Interfaces:**
- Consumes: loan objects with optional `label?: string | null` and `id: number`
- Produces: ledger line `label: loan.label?.trim() || \`Loan #${loan.id}\``

- [ ] **Step 1: Failing test** — assemble with `{ id: 7, label: 'Laptop advance', ... }` expects line label `'Laptop advance'`; with empty label expects `'Loan #7'`.

- [ ] **Step 2: Extend loan input type** with `label?: string | null` and implement label selection in the loan loop.

- [ ] **Step 3: Run** `npx jest src/admin/payroll/payroll-payslip-ledger.util.spec.ts --no-cache` — pass.

- [ ] **Step 4: Commit** `feat(payroll): use loan label on payslip ledger lines`

---

### Task 3: Loan API — label create, list filter, restore/delete

**Files:**
- Modify: `backend/src/admin/payroll/dto/loan.dto.ts`
- Modify: `backend/src/admin/payroll/payroll.service.ts` (`PayrollLoan` type, `mapLoan`, `listLoans`, `createLoan`, `updateLoan`, assemble loan loaders)
- Modify: `backend/src/admin/payroll/payroll-loans.service.spec.ts`

**Interfaces:**
- `CreateLoanDto.label: string` `@IsString() @MinLength(1) @MaxLength(120)`
- `UpdateLoanDto.status?: 'cancelled' | 'active' | 'deleted'`; optional `label?`
- `listLoans`: `WHERE ... AND l.status <> 'deleted'`
- `updateLoan` rules:
  - Load current row first.
  - If current `deleted` → 404 or 400 “Loan not found.”
  - `active` restore only when current is `cancelled`.
  - `deleted` allowed from `active` \| `cancelled` \| `paid`.
  - `cancelled` allowed from `active`.
  - Reject other transitions with clear 400.

- [ ] **Step 1: Failing tests** in `payroll-loans.service.spec.ts`:
  - create requires label / stores label
  - list excludes deleted
  - cancel then restore → active
  - delete → not listed; restore deleted rejected

- [ ] **Step 2: Implement DTO + service + mapLoan includes `label`**

- [ ] **Step 3: Pass `label` into assemble loan payloads** wherever loans are loaded for generate/preview/period summary.

- [ ] **Step 4: Run** `npx jest src/admin/payroll/payroll-loans.service.spec.ts src/admin/payroll/payroll-payslip-ledger.util.spec.ts --no-cache`

- [ ] **Step 5: Commit** `feat(payroll): loan label create and cancel restore soft-delete`

---

### Task 4: Frontend API types + Employee tools UX

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` — `PayrollLoan.label`, status union includes `deleted`; `createPayrollLoan` requires `label`; `updatePayrollLoan` status `'cancelled' | 'active' | 'deleted'` + optional `label`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html`

**UI behavior:**
- Signals: `loanFormOpen`, `commissionFormOpen`, `deductionFormOpen` default `false`; `loanLabel` string.
- Header per card: title + button toggling form (`+` / `×`).
- Forms only render when open; after successful create/add, close form and reset fields.
- Helper `confirmAction(message: string): boolean` → `return confirm(message);`
- Wrap: createLoan, saveLoanOverride, cancelLoan, restoreLoan, deleteLoan, add/delete commission, add/delete deduction.
- Loan row shows **label** bold; Cancel/Restore/Delete by status as in spec.
- Create form includes Loan name/label input (required).

- [ ] **Step 1: Update AdminApiService types and payloads**

- [ ] **Step 2: Component TS** — collapse signals, confirm helper, restore/delete methods, label on create

```ts
restoreLoan(item: PayrollLoan): Promise<void> {
  if (!confirm(`Restore loan "${item.label}"?`)) return;
  // updatePayrollLoan(id, { status: 'active' })
}
deleteLoan(item: PayrollLoan): Promise<void> {
  if (!confirm(`Delete loan "${item.label}"? It will be hidden and cannot be restored.`)) return;
  // updatePayrollLoan(id, { status: 'deleted' })
}
```

- [ ] **Step 3: Template** — three card headers with toggle; collapsed forms; loan label field + list actions

- [ ] **Step 4: Frontend build** `npx ng build --configuration=development`

- [ ] **Step 5: Commit** `feat(admin): employee tools loan label confirmations and collapse`

---

### Task 5: Spec status + smoke checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-10-08-payroll-employee-tools-ux-design.md` — Status → Implemented

- [ ] **Step 1: Map acceptance items 1–5** to code/tests in a short note (task report or commit body).

- [ ] **Step 2: Commit** `docs: mark employee tools UX implemented`

---

## Spec coverage

| Requirement | Task |
| --- | --- |
| Loan label column + required create | 1, 3, 4 |
| Ledger/payslip shows label | 2, 3 |
| Cancel stays listed; Restore | 3, 4 |
| Soft delete hidden, no restore | 3, 4 |
| Confirmations all mutating actions | 4 |
| Collapse forms all three cards | 4 |
| Acceptance / status | 5 |

## Self-review

- No TBD placeholders.
- Types: `label: string`, status includes `deleted`, restore = `active` from `cancelled` only — consistent across tasks.
- Migration number 076 follows 075.
