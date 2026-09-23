### Task 2: Pay from punched location type

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `buildPayslipDaysAndTotals`, `buildPeriodRow`, and punch SELECTs feeding them

**Interfaces:**
- Punch rows must include `work_location_type: string | null`
- For a punched day:  
  `locationType = normalizeStoredLocationType(row.work_location_type)`  
  - if `null` or `'off'` → unpaid (legacy / invalid)  
  - if `'office' | 'wfh'` → `pickSalaryAmountForLocation(locationType, ...)`
- Do **not** use `resolveExpectedLocation` for day pay / OT unpaid gates anymore.
- Fixed monthly: do **not** zero units just because schedule is Off; zero only when punch type is null/`off`.
- Day label suffix: `locationPayLabelSuffix(locationType ?? 'off')` when punched; for null punch type use Off unpaid suffix.

- [ ] **Step 1: Ensure punch queries select `work_location_type`**

Find all queries that load punches for `buildPayslipDaysAndTotals` / `buildPeriodRow` / generate preview and add `work_location_type` to SELECT + TypeScript row types.

- [ ] **Step 2: Replace schedule-based expected with punch type in both builders**

Example for payslip day branch:

```typescript
const punchedType = this.normalizeStoredLocationType(row.work_location_type);
// punchedType: 'office' | 'wfh' | null  (treat 'off' as null unpaid via normalize or explicit)

let units = this.dayPayUnits(hours, undertimeGraceMinutes);
// ...
if (usesFixedSalary && fixedRates) {
  if (punchedType == null || punchedType === 'off') {
    units = 0;
  }
  // dayPay / OT using fixed rates; OT pay 0 when unpaid type
} else {
  const amount =
    punchedType == null || punchedType === 'off'
      ? null
      : pickSalaryAmountForLocation(punchedType, input.salaryAmount, input.wfhSalary);
  // same as before when amount null → units 0, dayPay 0, OT pay 0
}
```

Same pattern in `buildPeriodRow`.

- [ ] **Step 3: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts
git commit -m "Use punched work location for Office vs WFH day pay."
```

---
