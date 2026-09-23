### Task 4: Verify

- [ ] **Step 1: Automated**

```
cd backend; npx tsc --noEmit -p tsconfig.build.json
cd frontend; npx ng build --configuration=development
```

- [ ] **Step 2: Manual (when Nest running)**

1. Schedule Office → picker defaults Office; pick WFH → GPS; payslip WFH rate.  
2. Schedule WFH → default WFH.  
3. Schedule Off → empty pick; warning; must choose; paid; mismatch false.  
4. Time In without pick on Off → blocked.

- [ ] **Step 3: Mark spec Implemented** in `docs/superpowers/specs/2026-09-22-time-clock-location-pick-design.md` and commit.

---
