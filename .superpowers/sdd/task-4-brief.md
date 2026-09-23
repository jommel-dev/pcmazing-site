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
