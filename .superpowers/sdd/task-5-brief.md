### Task 5: Loans + period overrides API

**Files:**
- DTOs + `payroll.service` methods + controller routes
- Frontend API methods (UI in Task 8)

**Routes:**
- `GET /admin/payroll/loans?userId&userSource`
- `POST /admin/payroll/loans` create (`principal`, `termStyle`, counts/amounts, notes)
- `PATCH /admin/payroll/loans/:id` (cancel, notes)
- `PUT /admin/payroll/loans/:id/period-override` `{ dateFrom, dateTo, action: 'skip'|'custom', customAmount? }`
- `DELETE /admin/payroll/loans/:id/period-override?dateFrom&dateTo`

On create: `balance = principal`. Status `paid` when balance hits 0 after a generate deduction.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Commit** `feat(payroll): employee loans and period overrides API`

---

