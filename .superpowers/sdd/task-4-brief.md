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

