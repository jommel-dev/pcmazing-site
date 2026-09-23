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
