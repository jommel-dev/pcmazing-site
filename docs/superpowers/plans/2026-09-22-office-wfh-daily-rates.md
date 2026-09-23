# Office vs WFH Daily Rates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-employee Office and WFH salary amounts; period/payslip day pay uses the rate for the **scheduled** location (Off days unpaid this slice).

**Architecture:** Keep `monthly_salary` as Office amount. Add nullable `wfh_salary`. A small pure helper picks the amount from scheduled location; payslip day loop and period estimates use per-day rates (fixed monthly still overrides).

**Tech Stack:** NestJS + PostgreSQL, Angular admin UI, existing Jest util specs.

**Spec:** `docs/superpowers/specs/2026-09-22-office-wfh-daily-rates-design.md`

## Global Constraints

- Do not rename `monthly_salary` column or `monthlySalary` API field (UI label = Office).
- WFH blank → use Office amount.
- Fixed monthly set → ignore both location amounts.
- Scheduled location drives rate (not punch GPS).
- Scheduled `off` → day pay / paid units = 0 (hours may still show).
- Off-day approval workflow is out of scope.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/admin/payroll/location-pay.util.ts` | Pure helpers: pick amount + label suffix |
| `backend/src/admin/payroll/location-pay.util.spec.ts` | Unit tests for helpers |
| `backend/src/sql/migrations/071_office_wfh_daily_rates.sql` | `wfh_salary` column |
| `backend/src/admin/payroll/payroll.schema.ts` | `ensurePayrollTables` ALTER |
| `backend/src/admin/payroll/dto/payroll-profile-fields.dto.ts` | `wfhSalary` field |
| `backend/src/admin/payroll/payroll.service.ts` | Profile map/upsert; day pay + period estimate |
| `backend/src/admin/users/users.types.ts` / `users.service.ts` | Attach `wfhSalary` |
| `frontend/.../admin-api.service.ts` | Types + create/update payloads |
| `frontend/.../user-management-page.*` | Office + WFH inputs |
| `frontend/.../payroll-page.*` | Show both amounts on Employees |

---

### Task 1: Location pay helpers + unit tests

**Files:**
- Create: `backend/src/admin/payroll/location-pay.util.ts`
- Create: `backend/src/admin/payroll/location-pay.util.spec.ts`
- Consumes: `WorkLocationType` from `work-location.util.ts`

**Interfaces:**
- Produces:
  - `pickSalaryAmountForLocation(expected: WorkLocationType, officeSalary: number | null, wfhSalary: number | null): number | null`
  - `locationPayLabelSuffix(expected: WorkLocationType): string` → `''` | `' · Office'` | `' · WFH'` | `' · Off (unpaid)'`

- [ ] **Step 1: Write failing tests**

```typescript
import { pickSalaryAmountForLocation, locationPayLabelSuffix } from './location-pay.util';

describe('pickSalaryAmountForLocation', () => {
  it('uses office amount for office days', () => {
    expect(pickSalaryAmountForLocation('office', 800, 700)).toBe(800);
  });

  it('uses wfh amount for wfh days', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, 700)).toBe(700);
  });

  it('falls back to office when wfh is null', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, null)).toBe(800);
  });

  it('returns null for off days (unpaid)', () => {
    expect(pickSalaryAmountForLocation('off', 800, 700)).toBe(null);
  });
});

describe('locationPayLabelSuffix', () => {
  it('labels office, wfh, and off', () => {
    expect(locationPayLabelSuffix('office')).toBe(' · Office');
    expect(locationPayLabelSuffix('wfh')).toBe(' · WFH');
    expect(locationPayLabelSuffix('off')).toBe(' · Off (unpaid)');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts -v`  
Expected: FAIL module not found / cannot find module

- [ ] **Step 3: Implement helpers**

```typescript
import { WorkLocationType } from './work-location.util';

export function pickSalaryAmountForLocation(
  expected: WorkLocationType,
  officeSalary: number | null,
  wfhSalary: number | null,
): number | null {
  if (expected === 'off') {
    return null;
  }
  if (expected === 'wfh') {
    if (wfhSalary != null && wfhSalary > 0) {
      return wfhSalary;
    }
    return officeSalary != null && officeSalary > 0 ? officeSalary : null;
  }
  return officeSalary != null && officeSalary > 0 ? officeSalary : null;
}

export function locationPayLabelSuffix(expected: WorkLocationType): string {
  switch (expected) {
    case 'wfh':
      return ' · WFH';
    case 'off':
      return ' · Off (unpaid)';
    default:
      return ' · Office';
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/location-pay.util.ts backend/src/admin/payroll/location-pay.util.spec.ts
git commit -m "Add location pay amount helpers for Office vs WFH rates."
```

---

### Task 2: Schema + profile API (`wfhSalary`)

**Files:**
- Create: `backend/src/sql/migrations/071_office_wfh_daily_rates.sql`
- Modify: `backend/src/admin/payroll/payroll.schema.ts` (add ALTER beside weekly location columns)
- Modify: `backend/src/admin/payroll/dto/payroll-profile-fields.dto.ts`
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `PayrollProfile`, `EMPTY_PAYROLL`, `PayrollEmployeeRecord`, SELECTs, `upsertProfile`, `mapProfile`, `listEmployees`
- Modify: `backend/src/admin/users/users.types.ts`
- Modify: `backend/src/admin/users/users.service.ts` — create/update upsert + `attachPayrollProfiles`

**Interfaces:**
- Produces: `PayrollProfile.wfhSalary: number | null` and same on `AdminUserRecord` / employee list rows

- [ ] **Step 1: Migration SQL**

```sql
ALTER TABLE pcmazing_user_payroll
  ADD COLUMN IF NOT EXISTS wfh_salary NUMERIC(12, 2);
```

Also append the same `ALTER` to `ENSURE_PAYROLL_SQL` in `payroll.schema.ts`.

- [ ] **Step 2: DTO**

In `PayrollProfileFieldsDto` add (mirror `monthlySalary`):

```typescript
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  wfhSalary?: number | null;
```

- [ ] **Step 3: Service profile plumbing**

- Add `wfhSalary: number | null` to `PayrollProfile`, `EMPTY_PAYROLL`, `PayrollEmployeeRecord`.
- Include `wfh_salary` in all profile SELECT/INSERT/UPDATE/RETURNING and `mapProfile`.
- In `upsertProfile`, merge `dto.wfhSalary` like `monthlySalary`.
- In `listEmployees`, map `wfhSalary` from row.

- [ ] **Step 4: Users attach**

- Add `wfhSalary?: number | null` to `AdminUserRecord`.
- Pass `wfhSalary: dto.wfhSalary` in create/update `upsertProfile` calls (include in update `if` guard).
- In `attachPayrollProfiles`, set `wfhSalary: profile?.wfhSalary ?? null`.

- [ ] **Step 5: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/sql/migrations/071_office_wfh_daily_rates.sql backend/src/admin/payroll/payroll.schema.ts backend/src/admin/payroll/dto/payroll-profile-fields.dto.ts backend/src/admin/payroll/payroll.service.ts backend/src/admin/users/users.types.ts backend/src/admin/users/users.service.ts
git commit -m "Add wfh_salary to payroll profile API."
```

---

### Task 3: Period + payslip day pay uses location rates

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `buildPayslipDaysAndTotals`, `buildPeriodRow`, and callers that pass salary into those

**Interfaces:**
- Consumes: `pickSalaryAmountForLocation`, `locationPayLabelSuffix`, `resolveExpectedLocation`
- `buildPayslipDaysAndTotals` input gains:
  - `wfhSalary: number | null`
  - `weeklyLocationSchedule: WeeklyLocationSchedule | null`

- [ ] **Step 1: Update `buildPayslipDaysAndTotals`**

Inside the punch day branch (when not fixed monthly):

1. `expected = resolveExpectedLocation(input.weeklyLocationSchedule, workWeek, workDate)`
2. `amount = pickSalaryAmountForLocation(expected, input.salaryAmount, input.wfhSalary)`
3. If `amount == null` (Off): `units = 0`, `dayPay = 0`, still compute hours for display; append `locationPayLabelSuffix('off')` to `dayType`
4. Else: `const { dailyRate, hourlyRate } = this.resolvePayRates(input.salaryType, amount, ...)` for **that day**; `dayPay = units * dailyRate`; OT hourly from that day’s hourlyRate (or office rate — use that day’s rate for consistency)
5. Append location suffix to `dayType` for office/wfh punches: `this.dayPayLabel(...) + locationPayLabelSuffix(expected)`

For **totals** when not fixed: set `basePay` / `estimatedPay` from **sum of dayPay** (+ OT), not `estimatePay` with a single `salaryAmount` (otherwise dual rates would be wrong). Keep `estimatePay` path only when `usesFixedSalary`.

When fixed monthly: leave existing behavior; still append location suffix on punched days for clarity (optional but preferred).

- [ ] **Step 2: Pass new fields from payslip builders**

Every caller of `buildPayslipDaysAndTotals` must pass `wfhSalary` and `weeklyLocationSchedule` from the employee profile (search for `buildPayslipDaysAndTotals(` and update each).

- [ ] **Step 3: Fix `buildPeriodRow` estimated pay**

`buildPeriodRow` currently does `paidDayUnits * single salaryAmount`. Change to:

- Accept `workWeek` + use `employee.weeklyLocationSchedule` / `employee.wfhSalary` / `employee.monthlySalary`.
- For each punch: resolve expected location; if Off, do not add paid units for pay; else compute units × dailyRate from picked amount; sum into `estimatedPay` (+ OT using that day’s hourly rate or office hourly — prefer per-day).
- Keep `paidDayUnits` as sum of units that are **payable** (Off → 0 units toward pay).

Update callers of `buildPeriodRow` if signature changes.

- [ ] **Step 4: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts
git commit -m "Apply Office vs WFH rates in period and payslip day pay."
```

---

### Task 4: Admin UI — User Management + Payroll Employees

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` — `AdminUser`, `PayrollEmployeeItem`, create/update payloads
- Modify: `frontend/src/app/admin/pages/user-management/user-management-page.component.ts`
- Modify: `frontend/src/app/admin/pages/user-management/user-management-page.component.html`
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html` (Amount column)
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts` only if a formatter helper is needed

- [ ] **Step 1: API types**

Add `wfhSalary?: number | null` to `AdminUser`, `PayrollEmployeeItem`, and create/update user payloads.

- [ ] **Step 2: User Management form**

- Add `wfhSalary: ['']` control.
- Label existing salary field **Office rate**; add **WFH rate** input with note: “Blank = use Office rate. Same unit as Office rate for the pay schedule.”
- Include `wfhSalary` in create/update payload (null when empty).
- Populate/reset in `openCreateForm` / `populateUserForm`.
- View panel: show Office and WFH amounts.

- [ ] **Step 3: Payroll Employees Amount column**

Show e.g.:

```
Office: ₱800
WFH: ₱700   (or “Same as office” when null)
```

Keep fixed monthly display as today when set.

- [ ] **Step 4: Frontend build**

Run: `cd frontend; npx ng build --configuration=development`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/services/admin-api.service.ts frontend/src/app/admin/pages/user-management/user-management-page.component.ts frontend/src/app/admin/pages/user-management/user-management-page.component.html frontend/src/app/admin/pages/payroll/payroll-page.component.html frontend/src/app/admin/pages/payroll/payroll-page.component.ts
git commit -m "Add Office and WFH rate fields in admin payroll UI."
```

---

### Task 5: Verify end-to-end

- [ ] **Step 1: Restart Nest** so `ensurePayrollTables` adds `wfh_salary` (or run migration `071`).

- [ ] **Step 2: Manual checks**

1. User with Office 800 / WFH 700; Wed=WFH → period/payslip Wed day pay from 700.  
2. Clear WFH → WFH days use 800.  
3. Set fixed monthly → location rates ignored.  
4. Punch on Off day → day pay 0; mismatch still visible.  
5. Payslip day type shows `· Office` / `· WFH` / `· Off (unpaid)`.

- [ ] **Step 3: Re-run automated checks**

```bash
cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts -v
cd backend; npx tsc --noEmit -p tsconfig.build.json
cd frontend; npx ng build --configuration=development
```

Expected: all pass / exit 0

- [ ] **Step 4: Commit any leftover fixes** (if needed), then mark spec status Implemented in `docs/superpowers/specs/2026-09-22-office-wfh-daily-rates-design.md`

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| `wfh_salary` column + ensure | Task 2 |
| Profile API `wfhSalary` | Task 2 |
| Day pay by scheduled location | Task 1 + 3 |
| WFH blank → Office | Task 1 |
| Fixed monthly wins | Task 3 |
| Off → unpaid | Task 1 + 3 |
| User Management UI | Task 4 |
| Payroll Employees display | Task 4 |
| Payslip location hint | Task 3 |
| Off-day approval | Out of scope (documented) |
