# Payslip Payment QR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an employee’s online-payout QR (“Scan to pay”) at the bottom of admin payslip Preview and employee payslip PDF/detail when a QR is on file.

**Architecture:** Live lookup from `pcmazing_user_payroll` (`payout_method` + `qr_image_url`). Add `qrImageUrl` to preview/detail JSON; PDF embeds the file from disk via `resolveUploadDiskPath`, omitting the block if the file is missing. No migration.

**Tech Stack:** NestJS + PostgreSQL, PDFKit (`payslip-pdf.util.ts`), Angular payroll page + sales employee dashboard, existing upload URL helpers.

**Spec:** `docs/superpowers/specs/2026-10-12-payslip-payment-qr-design.md`

## Global Constraints

- Show QR only when payout is **online** and `qr_image_url` is non-empty; otherwise omit entirely (no “No QR” placeholder).
- Label copy: **Scan to pay** (exact).
- Placement: bottom, after summary / ledger / remarks.
- Surfaces: admin Preview, employee PDF, employee dashboard payslip detail.
- No DB migration; no bank-details text beside QR.
- Missing disk file must not fail PDF generation.

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/admin/payroll/payslip-pdf.util.ts` | Payload field + draw QR after net pay |
| `backend/src/admin/payroll/payslip-pdf.util.spec.ts` | PDF tests for Scan to pay / omit |
| `backend/src/admin/payroll/payroll.service.ts` | Set `qrImageUrl` in preview + detail; pass into `pdfPayload` |
| `frontend/.../admin-api.service.ts` | `EmployeePayslipDetail.qrImageUrl` |
| `frontend/.../payroll-page.component.html` | Preview QR block |
| `frontend/.../sales-employee-dashboard.component.html` (+ `.ts` if needed for URL resolve) | Detail modal QR block |

---

### Task 1: PDF util — Scan to pay block

**Files:**
- Modify: `backend/src/admin/payroll/payslip-pdf.util.ts`
- Test: `backend/src/admin/payroll/payslip-pdf.util.spec.ts`

**Interfaces:**
- Consumes: `resolveUploadDiskPath` from `backend/src/common/uploads-path.util.ts`; `existsSync` from `node:fs`
- Produces: `PayslipPdfPayload.qrImageUrl?: string | null`; PDF draws label + image when file exists

- [ ] **Step 1: Write failing tests**

In `payslip-pdf.util.spec.ts`, add:

```ts
it('includes Scan to pay when qrImageUrl points to an existing file', async () => {
  // write a tiny PNG/JPEG under a temp path OR mock existsSync + use a real small fixture
  // pass qrImageUrl that resolveUploadDiskPath can resolve in test env
  // assert extractPdfText(buffer) contains 'Scan to pay'
});

it('omits Scan to pay when qrImageUrl is null', async () => {
  const buffer = await buildPayslipPdfBuffer(makePayload({ qrImageUrl: null }));
  expect(extractPdfText(buffer)).not.toContain('Scan to pay');
});
```

Prefer a small fixture file under `backend/src/admin/payroll/__fixtures__/sample-qr.png` and a public URL shape `/uploads/payroll-qr/sample-qr.png` only if uploads root can be pointed at the fixture dir in test; otherwise pass an absolute path helper. Simplest robust approach: add optional internal test-only field **or** export a tiny helper `resolvePayslipQrImagePath(url)` and unit-test that + integration smoke that calls `doc.image` with a real temp file written in `beforeAll`.

Recommended minimal approach for this codebase:

1. Add `qrImageUrl?: string | null` to `PayslipPdfPayload`.
2. In `buildPayslipPdfBuffer`, after Net pay line, if `payload.qrImageUrl`:
   - `const diskPath = resolveUploadDiskPath(payload.qrImageUrl)`
   - if `existsSync(diskPath)`, draw centered “Scan to pay” + `doc.image(diskPath, …, { width: 120 })`
   - else skip silently
3. Test omit when null; for include test, write a 1×1 PNG to `getUploadSubdir('payroll-qr')` in `beforeAll`, use `toPublicUploadUrl('payroll-qr', filename)`, then cleanup in `afterAll`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && npx jest src/admin/payroll/payslip-pdf.util.spec.ts --no-cache`

Expected: FAIL (new tests / missing field)

- [ ] **Step 3: Implement PDF drawing**

In `PayslipPdfPayload` add:

```ts
qrImageUrl?: string | null;
```

After the Net pay `writeLine(...)` (before page footer loop), insert QR block:

```ts
if (payload.qrImageUrl?.trim()) {
  try {
    const diskPath = resolveUploadDiskPath(payload.qrImageUrl.trim());
    if (existsSync(diskPath)) {
      // ensure space / new page if needed using existing contentBottom helpers
      doc.moveDown(0.6);
      doc.fontSize(10).fillColor('#0f172a');
      writeLine('Scan to pay', { align: 'center' });
      doc.moveDown(0.25);
      const qrWidth = 120;
      const x = left + (pageWidth - qrWidth) / 2;
      doc.image(diskPath, x, doc.y, { width: qrWidth });
      doc.y += qrWidth + 8;
    }
  } catch {
    // omit QR; never fail PDF
  }
}
```

Import `existsSync` from `node:fs` and `resolveUploadDiskPath` from `../../common/uploads-path.util`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && npx jest src/admin/payroll/payslip-pdf.util.spec.ts --no-cache`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/payslip-pdf.util.ts backend/src/admin/payroll/payslip-pdf.util.spec.ts
git commit -m "feat(payroll): embed Scan to pay QR on payslip PDF"
```

---

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
