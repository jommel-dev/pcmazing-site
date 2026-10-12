# Task 1 Report: PDF util — Scan to pay block

## Status

Completed successfully.

## Summary

Added optional `qrImageUrl` to `PayslipPdfPayload` and, when the URL resolves to an existing file on disk, embeds a centered “Scan to pay” label and 120px-wide QR image after the Net pay line on the payslip PDF. Missing files, invalid paths, and resolver errors are ignored so PDF generation never fails.

## TDD Evidence

### RED (Step 2)

Command:

```bash
cd backend && npx jest src/admin/payroll/payslip-pdf.util.spec.ts --no-cache
```

Result: **FAIL** — 1 failed, 4 passed.

- `includes Scan to pay when qrImageUrl points to an existing file` — expected `extractPdfText(buffer)` to contain `Scan to pay`; received string ended at Net pay / footer with no QR label.

- `omits Scan to pay when qrImageUrl is null` — **passed** (field not yet implemented; absence of URL behaves as omit).

### GREEN (Step 4)

Same command.

Result: **PASS** — 5 passed, 1 suite, ~1.7s.

## Implementation Details

### `PayslipPdfPayload`

- Added `qrImageUrl?: string | null`.

### `buildPayslipPdfBuffer`

- Imports: `existsSync` from `node:fs`, `resolveUploadDiskPath` from `../../common/uploads-path.util`.
- After Net pay `writeLine(...)`, before the page footer loop:
  - If `payload.qrImageUrl?.trim()` is truthy, resolve disk path, and when `existsSync(diskPath)`:
    - `doc.moveDown(0.6)`
    - Centered `Scan to pay` via `writeLine(..., { align: 'center' })`
    - `doc.moveDown(0.25)`
    - `doc.image(diskPath, x, doc.y, { width: 120 })` with `x` centered on page content width
    - Advance `doc.y` by QR height + 8
  - Wrapped in `try/catch` — omit QR on any error.

### Tests

- New `describe('Scan to pay QR block')`:
  - `beforeAll`: writes minimal 1×1 PNG to `getUploadSubdir('payroll-qr')/payslip-spec-qr.png`, sets `qrPublicUrl` via `toPublicUploadUrl('payroll-qr', filename)`.
  - `afterAll`: removes fixture file with `rmSync(..., { force: true })`.
  - Include test: payload with `qrImageUrl: qrPublicUrl` → text contains `Scan to pay`.
  - Omit test: `qrImageUrl: null` → text does not contain `Scan to pay`.

No separate fixture directory under `__fixtures__/`; inline base64 minimal PNG matches brief’s recommended upload-dir approach.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/admin/payroll/payslip-pdf.util.ts` | Field + QR drawing block + imports |
| `backend/src/admin/payroll/payslip-pdf.util.spec.ts` | Scan to pay tests + upload helpers |

## Commit

- **SHA:** `28b5e06`
- **Subject:** `feat(payroll): embed Scan to pay QR on payslip PDF`

## Self-Review

- Matches task brief verbatim for field name, placement (after Net pay, before footer loop), styling, QR width 120, centered label, silent skip on missing file / errors.
- Reuses existing `writeLine`, `left`, `pageWidth`, and `contentBottom` patterns elsewhere in the file; QR block does not add explicit `ensureRowSpace` — acceptable for typical payslip length; very long payslips could theoretically overlap footer (pre-existing pattern for Net pay as well).
- Tests use real filesystem + `resolveUploadDiskPath` integration path, not mocks.
- Scope limited to PDF util and spec; no backend JSON or frontend changes.

## Concerns

- **Minor:** No test for missing file on disk (non-null URL but file deleted) — behavior is silent omit per spec; could add later for regression.
- **Minor:** `extractPdfText` only validates label text, not embedded image bytes — sufficient for this task.
- **Environment:** Tests write under process `uploads/payroll-qr/` (or `UPLOADS_DIR` if set); cleanup in `afterAll` should prevent pollution.

## Out of Scope (per brief)

Backend payload wiring, frontend UI, and other tasks in the payslip payment QR feature were not modified.
