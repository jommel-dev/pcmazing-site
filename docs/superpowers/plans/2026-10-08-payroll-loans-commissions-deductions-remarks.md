# Payroll Loans, Commissions, Late Deductions, and Remarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add loans/cash advances (equal or fixed terms + skip/custom), multi-line commissions, auto late + manual deductions, and per-payslip remarks with optional PDF inclusion — all flowing into payslip net pay.

**Architecture:** Pure math helpers + migration for loans/commissions/manual deductions/ledger/remarks/late settings; payroll APIs manage entries; `generatePayslips` / detail assemble ledger lines and set `estimated_pay = netPay`; employee PDF accepts `includeRemarks`.

**Tech Stack:** NestJS, PostgreSQL migrations, Angular admin + ESS dashboard, Jest for pure helpers, existing payslip PDF util.

**Spec:** `docs/superpowers/specs/2026-10-08-payroll-loans-commissions-deductions-remarks-design.md`

## Global Constraints

- Net: `max(0, base + OT + commissions − late − loan − manual)`; `estimated_pay` stores net.
- Loan styles: `equal_installments` | `fixed_per_cutoff`; skip defers; custom amount allowed.
- Late: global `shift_start_time` + `late_grace_minutes` + fixed and/or per-minute.
- Commissions: types catalog + Other free-text; multiple lines.
- Remarks: per payslip; PDF `includeRemarks` default **false**.
- Regenerate: refresh auto-late only; preserve manual commissions/deductions/remarks/loan overrides.
- PowerShell: use `;` not `&&`.
- No unrelated payroll redesign; unit-test pure helpers.
- Access: existing payroll admin gates; employees own data only.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/sql/migrations/074_payroll_ledger_loans_commissions.sql` | Tables + settings columns + remarks |
| `backend/src/admin/payroll/payroll-ledger.util.ts` | Net/gross, late minutes, loan installment amount |
| `backend/src/admin/payroll/payroll-ledger.util.spec.ts` | Unit tests |
| `backend/src/admin/payroll/payroll.schema.ts` | Ensure new DDL on ensure |
| `backend/src/admin/payroll/dto/*` | Settings + loan/commission/deduction DTOs |
| `backend/src/admin/payroll/payroll.service.ts` | CRUD + generate/preview ledger |
| `backend/src/admin/payroll/payroll.controller.ts` | New routes |
| `backend/src/admin/payroll/payslip-pdf.util.ts` | Remarks optional block |
| `backend/src/admin/employee-workspace/*` | Detail + PDF query flag |
| `frontend/.../payroll/payroll-page.*` | Settings, types, loans, entries, period columns |
| `frontend/.../dashboard/sales-employee-dashboard.*` | Breakdown + remarks + print checkbox |
| `frontend/.../services/admin-api.service.ts` | API clients |
| Spec → Implemented | |

---

### Task 1: Pure helpers (TDD)

**Files:**
- Create: `backend/src/admin/payroll/payroll-ledger.util.ts`
- Create: `backend/src/admin/payroll/payroll-ledger.util.spec.ts`

**Interfaces:**
- Produces:
  - `export type PayslipLedgerLineType = 'commission' | 'late_deduction' | 'loan_deduction' | 'manual_deduction'`
  - `export type PayslipLedgerLine = { lineType: PayslipLedgerLineType; label: string; amount: number; source: 'auto' | 'manual' | 'override'; meta?: Record<string, unknown> }`
  - `computeLateMinutes(timeIn: Date, workDateYmd: string, shiftStartHhmm: string, graceMinutes: number): number`
  - `computeLateDeduction(minutesLate: number, fixed: number, perMinute: number): number`
  - `computeEqualInstallmentAmount(principal: number, installmentCount: number): number`
  - `computeLoanPeriodAmount(args: { balance: number; termStyle: 'equal_installments' | 'fixed_per_cutoff'; installmentCount: number | null; fixedInstallmentAmount: number | null; override: null | { action: 'skip' | 'custom'; customAmount?: number } }): number` // 0 if skip
  - `computePayslipNet(args: { basePay: number; overtimePay: number; lines: PayslipLedgerLine[] }): { grossPay: number; totalDeductions: number; netPay: number; commissionsTotal: number; lateTotal: number; loanTotal: number; manualTotal: number }`

- [ ] **Step 1: Write failing tests**

```typescript
import {
  computeLateMinutes,
  computeLateDeduction,
  computeEqualInstallmentAmount,
  computeLoanPeriodAmount,
  computePayslipNet,
} from './payroll-ledger.util';

describe('payroll-ledger.util', () => {
  it('late minutes after grace', () => {
    // workDate 2026-10-08, shift 09:00, grace 15 → late after 09:15
    const timeIn = new Date('2026-10-08T01:30:00.000Z'); // adjust to project TZ handling — use same convention as attendance
    expect(computeLateMinutes(timeIn, '2026-10-08', '09:00', 15)).toBeGreaterThan(0);
  });
  it('on-time is zero', () => {
    expect(computeLateDeduction(0, 50, 2)).toBe(0);
  });
  it('late deduction fixed + per minute', () => {
    expect(computeLateDeduction(10, 50, 2)).toBe(70);
  });
  it('equal installment rounds money', () => {
    expect(computeEqualInstallmentAmount(6000, 6)).toBe(1000);
  });
  it('skip loan returns 0', () => {
    expect(
      computeLoanPeriodAmount({
        balance: 3000,
        termStyle: 'fixed_per_cutoff',
        installmentCount: null,
        fixedInstallmentAmount: 500,
        override: { action: 'skip' },
      }),
    ).toBe(0);
  });
  it('net floors at 0', () => {
    const r = computePayslipNet({
      basePay: 100,
      overtimePay: 0,
      lines: [
        { lineType: 'manual_deduction', label: 'x', amount: 500, source: 'manual' },
      ],
    });
    expect(r.netPay).toBe(0);
    expect(r.totalDeductions).toBe(500);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```powershell
cd backend; npx jest src/admin/payroll/payroll-ledger.util.spec.ts --no-cache
```

- [ ] **Step 3: Implement util** (use Asia/Manila or existing payroll date helpers if present; document TZ in comments). Cap loan period amount at `balance`. Round money to 2 decimals.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```powershell
git add backend/src/admin/payroll/payroll-ledger.util.ts backend/src/admin/payroll/payroll-ledger.util.spec.ts
git commit -m "feat(payroll): ledger math helpers for loans late and net"
```

---

### Task 2: Migration 074

**Files:**
- Create: `backend/src/sql/migrations/074_payroll_ledger_loans_commissions.sql`
- Create: `backend/scripts/apply-payroll-ledger-migration.mjs` (copy pattern from `apply-settings-rbac-roles-migration.mjs`)
- Modify: `backend/src/admin/payroll/payroll.schema.ts` — append same DDL for ensure path

**Schema (essential):**

```sql
ALTER TABLE pcmazing_payroll_settings
  ADD COLUMN IF NOT EXISTS shift_start_time TIME NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS late_grace_minutes SMALLINT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS late_deduction_fixed NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_deduction_per_minute NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE pcmazing_generated_payslips
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL;

CREATE TABLE IF NOT EXISTS pcmazing_payroll_payslip_ledger (
  id BIGSERIAL PRIMARY KEY,
  payslip_id BIGINT NOT NULL REFERENCES pcmazing_generated_payslips(id) ON DELETE CASCADE,
  line_type VARCHAR(40) NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pcmazing_payroll_loans ( ... );
CREATE TABLE IF NOT EXISTS pcmazing_payroll_loan_period_overrides ( ... );
CREATE TABLE IF NOT EXISTS pcmazing_payroll_commission_types ( ... );
CREATE TABLE IF NOT EXISTS pcmazing_payroll_commission_entries ( ... );
CREATE TABLE IF NOT EXISTS pcmazing_payroll_manual_deductions ( ... );
```

Period identity for entries/overrides: prefer `payroll_run_id` nullable + `date_from`/`date_to` so entries can be staged before generate, then attached on generate.

- [ ] **Step 1: Write SQL + ensure schema sync**

- [ ] **Step 2: Apply** `node scripts/apply-payroll-ledger-migration.mjs`

- [ ] **Step 3: Commit**

```powershell
git add backend/src/sql/migrations/074_payroll_ledger_loans_commissions.sql backend/scripts/apply-payroll-ledger-migration.mjs backend/src/admin/payroll/payroll.schema.ts
git commit -m "feat(payroll): migration for loans commissions ledger remarks"
```

---

### Task 3: Settings API — late fields

**Files:**
- Modify: `backend/src/admin/payroll/dto/payroll-settings.dto.ts`
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `getSettings` / `updateSettings`
- Modify: frontend payroll settings form + `AdminApiService` types

**Interfaces:**
- Extend `PayrollSettings` with `shiftStartTime: string` (`HH:mm`), `lateGraceMinutes`, `lateDeductionFixed`, `lateDeductionPerMinute`
- Validate: grace 0–120; money ≥ 0; time matches `/^\d{2}:\d{2}$/`

- [ ] **Step 1: Backend DTO + service read/write**

- [ ] **Step 2: Frontend settings inputs**

- [ ] **Step 3: Commit** `feat(payroll): late deduction settings`

---

### Task 4: Commission types + entries API

**Files:**
- Create DTOs under `backend/src/admin/payroll/dto/`
- Modify: `payroll.controller.ts` / `payroll.service.ts`
- Modify: `admin-api.service.ts`

**Routes (all `@RequirePermissions` payroll edit/view as appropriate):**
- `GET/POST/PATCH /admin/payroll/commission-types`
- `GET/POST/DELETE /admin/payroll/commission-entries?userId&userSource&dateFrom&dateTo`

Entry body: `{ typeId?: number | null; label?: string; amount: number }` — if `typeId` null, `label` required (Other).

- [ ] **Step 1: Implement service + controller**

- [ ] **Step 2: Smoke with Nest**

- [ ] **Step 3: Commit** `feat(payroll): commission types and entries API`

---

### Task 5: Loans + period overrides API

**Files:**
- DTOs + `payroll.service` methods + controller routes
- Frontend API methods (UI in Task 8)

**Routes:**
- `GET /admin/payroll/loans?userId&userSource`
- `POST /admin/payroll/loans` create (`principal`, `termStyle`, counts/amounts, notes)
- `PATCH /admin/payroll/loans/:id` (cancel, notes)
- `PUT /admin/payroll/loans/:id/period-override` `{ dateFrom, dateTo, action: 'skip'|'custom', customAmount? }`
- `DELETE /admin/payroll/loans/:id/period-override?dateFrom&dateTo`

On create: `balance = principal`. Status `paid` when balance hits 0 after a generate deduction.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit** `feat(payroll): employee loans and period overrides API`

---

### Task 6: Manual deductions API

**Files:**
- Routes: `GET/POST/DELETE /admin/payroll/manual-deductions`
- Fields: user, period dates, label, amount

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit** `feat(payroll): manual deduction entries API`

---

### Task 7: Generate / preview / detail — ledger + remarks + loan balance

**Files:**
- Modify: `payroll.service.ts` (`generatePayslips`, `previewPayslips`, payslip detail builders)
- Modify: employee-workspace payslip detail mapper
- Modify: `payslip-pdf.util.ts`

**Logic on generate (per employee):**
1. Compute existing `basePay` / `overtimePay` as today (keep day breakdown).
2. Load commission entries + manual deductions for period → lines.
3. Compute auto-late from attendance + settings → late lines (sum or per-day lines; prefer **one line per late day** for clarity).
4. For each active loan: `computeLoanPeriodAmount`; if > 0 add loan line; after successful insert, `balance -= amount` (and mark paid if 0). **Important:** only mutate balance on generate (not preview).
5. `computePayslipNet` → write `estimated_pay = netPay`, replace ledger rows for payslip (delete auto late + prior generate snapshot carefully: delete all ledger for payslip then re-insert from this assemble, while entries tables remain source of truth for commissions/manual).
6. Preserve `remarks` on upsert if already set; allow PATCH remarks endpoint.

Also: `PATCH /admin/payroll/payslips/:id/remarks` `{ remarks: string | null }`.

Preview returns same breakdown without writing loans balance.

- [ ] **Step 1: Wire assembleLedger helper inside service using util**

- [ ] **Step 2: Persist ledger + update estimated_pay**

- [ ] **Step 3: Detail API returns `{ ..., lines, remarks, basePay, overtimePay, netPay }`**

- [ ] **Step 4: Commit** `feat(payroll): assemble ledger on payslip generate`

---

### Task 8: Admin payroll UI

**Files:**
- `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`
- `frontend/src/app/admin/pages/payroll/payroll-page.component.html`
- `admin-api.service.ts` (if not done)

**UI sections (reuse existing tabs/cards style):**
1. Settings — late fields  
2. Commission types — small table  
3. Employee tools — select employee: loans list/create, period override, commission entries, manual deductions  
4. Period table — show commissions / deductions / net; edit remarks on generated row  

- [ ] **Step 1: Wire API + forms**

- [ ] **Step 2: Manual smoke**

- [ ] **Step 3: Commit** `feat(admin): payroll UI for loans commissions deductions`

---

### Task 9: Employee dashboard + PDF includeRemarks

**Files:**
- `sales-employee-dashboard.component.ts/html`
- `admin-api.service.ts` — `downloadEmployeePayslipPdf(id, open?, includeRemarks?)`
- `employee-workspace.controller.ts` — `@Query('includeRemarks')`
- `payslip-pdf.util.ts` — render remarks block only when flag true and text present

**UI:**
- Modal shows lines + remarks  
- Checkbox “Include notes/remarks” default **false** next to Download  
- Pass query to PDF endpoint  

- [ ] **Step 1: Backend query + PDF**

- [ ] **Step 2: Dashboard checkbox**

- [ ] **Step 3: Commit** `feat(ess): payslip remarks and optional print inclusion`

---

### Task 10: Acceptance + spec status

**Files:**
- Spec status → Implemented  
- Optional short note in payroll-related docs if any  

- [ ] **Step 1: Run checklist from spec** (loan skip, multi commission, late punch, remarks print off/on, legacy payslip)

- [ ] **Step 2: Commit** `docs: mark payroll ledger features implemented`

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| Helpers late/loan/net | 1 |
| Schema | 2 |
| Late settings | 3 |
| Commissions | 4, 7, 8 |
| Loans + skip/custom | 5, 7, 8 |
| Manual deductions | 6, 7, 8 |
| Ledger on generate | 7 |
| Remarks + PDF flag | 7, 9 |
| Admin UI | 8 |
| ESS UI | 9 |
| Acceptance | 10 |
