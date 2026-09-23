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
