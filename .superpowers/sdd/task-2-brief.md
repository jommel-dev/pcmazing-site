### Task 2: Backend payload — preview + payslip detail

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` (`previewPayslips` ~2999–3027, `getEmployeePayslipDetail` SELECT ~3158–3175 and return ~3272–3313)

**Interfaces:**
- Consumes: `listEmployees` already exposes `payoutMethod` + `qrImageUrl` on preview employees; detail JOIN must select `pay.payout_method`, `pay.qr_image_url`
- Produces: preview/detail JSON field `qrImageUrl: string | null`; `pdfPayload.qrImageUrl` same value

- [ ] **Step 1: Add private helper (same file)**

```ts
private payslipQrImageUrl(
  payoutMethod: string | null | undefined,
  qrImageUrl: string | null | undefined,
): string | null {
  if (this.normalizePayoutMethod(payoutMethod) !== 'online') {
    return null;
  }
  const url = qrImageUrl?.trim();
  return url ? url : null;
}
```

- [ ] **Step 2: Preview**

In `previewPayslips` return object, add:

```ts
qrImageUrl: this.payslipQrImageUrl(employee.payoutMethod, employee.qrImageUrl),
```

- [ ] **Step 3: Detail query + return**

Extend SELECT with:

```sql
pay.payout_method, pay.qr_image_url,
```

Type the row fields, then:

```ts
const qrImageUrl = this.payslipQrImageUrl(slip.payout_method, slip.qr_image_url);
```

Add `qrImageUrl` to both the public return object and `pdfPayload`.

- [ ] **Step 4: Smoke / unit coverage**

If an existing payslip detail spec mocks the SQL row, extend the mock with `payout_method` / `qr_image_url` and assert `qrImageUrl` on the result. Otherwise run:

`cd backend && npx jest src/admin/payroll/payslip-pdf.util.spec.ts src/admin/payroll/payroll-payslip-remarks.service.spec.ts --no-cache`

Fix any type/compile breaks from the new SELECT columns.

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts
git commit -m "feat(payroll): include qrImageUrl on payslip preview and detail"
```

---

