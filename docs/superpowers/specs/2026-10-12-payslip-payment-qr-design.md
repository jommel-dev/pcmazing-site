# Payslip payment QR design

**Date:** 2026-10-12  
**Status:** Approved for planning  
**Scope:** Show employee online-payout QR on admin payslip Preview and employee payslip PDF (and matching detail view).

## Goal

Employees and admins reviewing a payslip should see the employee’s payment QR when payout is online and a QR is on file—without opening User Management.

## Current state

- QR lives on `pcmazing_user_payroll.qr_image_url` (file under `uploads/payroll-qr/`).
- Shown only in User Management when `payout_method === 'online'`.
- Payslip Preview (`previewPayslips`) and PDF (`buildPayslipPdfBuffer` / `getEmployeePayslipDetail`) do not include QR.

## Decisions

| Topic | Choice |
| --- | --- |
| When to show | Only if payout is **online** and `qr_image_url` is present |
| Surfaces | Admin **Period pay → Preview** and employee **payslip PDF** (+ detail modal using same payload) |
| Placement | Bottom, after summary / ledger / remarks |
| Content | QR image + short label **“Scan to pay”** (no bank details text) |
| Data strategy | **Live** lookup from payroll profile (no snapshot column / no migration) |

## Data & API

- No database migration.
- Extend payslip detail / preview item payload with:
  - `qrImageUrl: string | null`
- Set `qrImageUrl` only when `payout_method === 'online'` and `qr_image_url` is non-empty; otherwise `null`.
- Populate in:
  - `PayrollService.previewPayslips()`
  - `PayrollService.getEmployeePayslipDetail()` (feeds detail UI + PDF)
- Frontend `EmployeePayslipDetail` includes optional `qrImageUrl`.
- Preview resolves URL via existing public upload URL helper.
- PDF resolves the file from disk (uploads path); if missing, omit the QR block and still generate the PDF.

## UI

### Admin Preview

- After Summary / ledger (and remarks if present), if `qrImageUrl`:
  - Centered “Scan to pay” label
  - QR image ~140–160px, light border, rounded
- If null: render nothing (no empty placeholder).

### Employee PDF

- After totals / remarks, same rule:
  - “Scan to pay” heading
  - Embedded QR ~120–140pt
- Omit entire block when no usable image.

### Employee dashboard payslip detail

- Same bottom QR block when `qrImageUrl` is present (consistent with Preview/PDF).

## Edge cases

- Cash payout or no QR → no block.
- URL in DB but file missing on disk → omit from PDF; do not fail payslip generation.
- QR updates in User Management apply on next Preview/PDF (live profile; not historical).

## Out of scope

- Snapshotting QR onto `pcmazing_generated_payslips` at generate time
- Showing bank details text beside the QR
- Changing User Management upload/remove flow
- New migrations

## Verification

1. Online employee with QR → Preview and PDF show “Scan to pay” + image at bottom.
2. Cash or online without QR → no QR block.
3. Missing file on disk → PDF still downloads without QR.
4. Update QR in User Management → next Preview/PDF shows the new image.
