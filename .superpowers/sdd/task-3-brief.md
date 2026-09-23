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
