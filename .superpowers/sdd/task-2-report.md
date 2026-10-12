# Task 2 Report: Backend payload — preview + payslip detail

## Status

Completed successfully.

## Summary

Implemented `payslipQrImageUrl` helper and wired `qrImageUrl` into both `previewPayslips` and `getEmployeePayslipDetail` (JSON return object + `pdfPayload`). The QR image URL is only included when an employee's payout method normalizes to `'online'` and the URL is a non-empty string.

## Implementation Details

### Helper `payslipQrImageUrl`
- Added private method in `PayrollService` placed immediately below `normalizePayoutMethod`.
- Returns `null` if `normalizePayoutMethod(payoutMethod) !== 'online'`.
- Returns trimmed string if non-empty, or `null`.

### `previewPayslips`
- Added `qrImageUrl: this.payslipQrImageUrl(employee.payoutMethod, employee.qrImageUrl)` to each returned preview payslip item.

### `getEmployeePayslipDetail`
- Extended SELECT query to retrieve `pay.payout_method` and `pay.qr_image_url` from `pcmazing_user_payroll`.
- Added `payout_method: string | null` and `qr_image_url: string | null` to the query result typing.
- Computed `qrImageUrl` via `this.payslipQrImageUrl(slip.payout_method, slip.qr_image_url)`.
- Attached `qrImageUrl` to `pdfPayload` (consumed by PDF generator) and the returned detail object (consumed by `employee-workspace.service.ts` / API response).

## Verification Evidence

### Smoke / Unit Tests (Step 4)
Command:
```bash
npx jest src/admin/payroll/payslip-pdf.util.spec.ts src/admin/payroll/payroll-payslip-remarks.service.spec.ts --no-cache
```
Result: **PASS** — 2 test suites passed, 9 tests passed.

### Payroll Suite Regression Check
Command:
```bash
npx jest src/admin/payroll --no-cache
```
Result: **PASS** — 13 test suites passed, 63 tests passed.

### Backend TypeScript Build Check
Command:
```bash
npm run build
```
Result: **PASS** (exit code 0).

## Files Changed

| File | Change |
|------|--------|
| `backend/src/admin/payroll/payroll.service.ts` | Added `payslipQrImageUrl` helper, `qrImageUrl` in preview payslips, extended detail SELECT query and populated `qrImageUrl` in `pdfPayload` & return object. |

## Commit

- **SHA:** `440b82a`
- **Subject:** `feat(payroll): include qrImageUrl on payslip preview and detail`

## Self-Review

- Matches task brief specification verbatim for helper logic, gating condition, preview payload, detail query, and detail payload.
- No frontend files modified.
- No PDF util files modified.
- Clean integration with Task 1 PDF drawing via `pdfPayload.qrImageUrl`.

## Concerns

None.
