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

