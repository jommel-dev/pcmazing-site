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

