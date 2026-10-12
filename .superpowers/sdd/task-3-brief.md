### Task 3: Frontend types + admin Preview UI

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` (`EmployeePayslipDetail` ~799–862)
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html` (after Summary block ~1320, before empty-state / footer)
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts` only if a resolve helper is needed (prefer `adminApi.resolveProfileImageUrl`)

**Interfaces:**
- Consumes: `detail.qrImageUrl` from preview API
- Produces: visible Scan to pay block in Preview modal

- [ ] **Step 1: Type**

```ts
qrImageUrl?: string | null;
```

on `EmployeePayslipDetail`.

- [ ] **Step 2: Preview markup**

After the Summary card closes (after ledger inside summary / after net pay section), before `@else { No payslips... }`:

```html
@if (resolvePayslipQrUrl(detail.qrImageUrl); as qrUrl) {
  <div class="mt-5 flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-700 dark:bg-slate-950/40">
    <p class="text-xs font-bold uppercase tracking-wide text-slate-500">Scan to pay</p>
    <img [src]="qrUrl" alt="Payment QR code" class="mt-3 size-40 rounded-xl border border-slate-200 object-contain dark:border-slate-700" />
  </div>
}
```

Add a tiny component method:

```ts
resolvePayslipQrUrl(url: string | null | undefined): string | null {
  return this.adminApi.resolveProfileImageUrl(url);
}
```

- [ ] **Step 3: Manual check**

With `ng serve` + API: Period pay → Preview an online employee with QR → bottom shows Scan to pay; cash employee → no block.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/services/admin-api.service.ts frontend/src/app/admin/pages/payroll/payroll-page.component.html frontend/src/app/admin/pages/payroll/payroll-page.component.ts
git commit -m "feat(admin): show Scan to pay QR on payslip preview"
```

---

