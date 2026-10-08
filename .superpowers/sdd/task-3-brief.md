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

