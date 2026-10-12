### Task 4: Employee dashboard payslip detail

**Files:**
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html` (after remarks ~617–622, before disclaimer)
- Modify: `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts` (add resolve helper using `adminApi.resolveProfileImageUrl`)

**Interfaces:**
- Consumes: same `EmployeePayslipDetail.qrImageUrl` from `getEmployeePayslipDetail`
- Produces: Scan to pay block in detail modal (PDF already covered by Task 1–2)

- [ ] **Step 1: Add resolve helper** on the dashboard component (same as payroll page).

- [ ] **Step 2: Markup** after remarks block, before the disclaimer paragraph:

```html
@if (resolvePayslipQrUrl(detail.qrImageUrl); as qrUrl) {
  <div class="mt-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
    <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Scan to pay</p>
    <img [src]="qrUrl" alt="Payment QR code" class="mt-3 size-40 rounded-xl border border-slate-200 object-contain dark:border-slate-700" />
  </div>
}
```

- [ ] **Step 3: Manual check**

Employee dashboard → open payslip detail for online+QR user → QR at bottom; Download PDF → QR on PDF.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts
git commit -m "feat(admin): show Scan to pay QR on employee payslip detail"
```

---

