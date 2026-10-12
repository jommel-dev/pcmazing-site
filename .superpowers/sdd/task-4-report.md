# Task 4 Report: Employee dashboard payslip detail QR

## Status

**DONE**

## Summary

Mirrored the Task 3 **Scan to pay** block on the employee dashboard payslip detail modal, using `detail.qrImageUrl` from `getEmployeePayslipDetail` and resolving URLs via `adminApi.resolveProfileImageUrl`.

## Implementation Details

### Markup (`sales-employee-dashboard.component.html`)
- Inserted after the Notes / remarks block (~617–622), before the system-generated disclaimer paragraph.
- Conditional `@if (resolvePayslipQrUrl(detail.qrImageUrl); as qrUrl)` — same classes and copy as payroll Preview.

### Component helper (`sales-employee-dashboard.component.ts`)
- `resolvePayslipQrUrl(url)` delegates to `this.adminApi.resolveProfileImageUrl(url)` (same as payroll page).

## Verification Evidence

### Frontend build
Command:
```powershell
cd frontend; npx ng build --configuration=development
```
Result: **PASS** (exit code 0).

### Manual browser check
Not run — dev servers were not started. Expected: online employee with QR → block at bottom of detail modal; PDF download still includes QR (Tasks 1–2).

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.html` | Scan to pay QR block in payslip detail modal. |
| `frontend/src/app/admin/pages/dashboard/sales-employee-dashboard.component.ts` | `resolvePayslipQrUrl` helper. |

## Commit

- **SHA:** `8a37a66`
- **Subject:** `feat(admin): show Scan to pay QR on employee payslip detail`

## Self-Review

- Markup matches task brief / Task 3 verbatim.
- No payroll-page or backend changes.
- Helper placement follows payroll-page pattern next to formatting helpers.

## Concerns

- Manual UI verification deferred until dev servers are available.
