### Task 5: Verification pass

- [ ] **Step 1: Backend tests**

`cd backend && npx jest src/admin/payroll/payslip-pdf.util.spec.ts --no-cache`

Expected: PASS

- [ ] **Step 2: Frontend build**

`cd frontend && npx ng build --configuration=development`

Expected: success

- [ ] **Step 3: Spec checklist**

Walk through Verification section in `docs/superpowers/specs/2026-10-12-payslip-payment-qr-design.md`.

- [ ] **Step 4: Final commit only if docs/plan checkboxes need updating**

Optional: mark plan tasks complete in the plan file and commit `docs: mark payslip QR plan complete` if the team tracks that way.
