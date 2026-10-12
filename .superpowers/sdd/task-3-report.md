# Task 3 Report: Frontend types + admin Preview UI

## Status

**DONE**

## Summary

Added `qrImageUrl` to `EmployeePayslipDetail` and a conditional **Scan to pay** block at the bottom of the admin payroll Period pay Preview modal, resolving the image URL through `adminApi.resolveProfileImageUrl`.

## Implementation Details

### Type (`admin-api.service.ts`)
- Added `qrImageUrl?: string | null` on `EmployeePayslipDetail`.

### Preview markup (`payroll-page.component.html`)
- Inserted after the Summary card (including ledger lines), before the `@else` empty state.
- Renders only when `resolvePayslipQrUrl(detail.qrImageUrl)` returns a truthy URL.

### Component helper (`payroll-page.component.ts`)
- `resolvePayslipQrUrl(url)` delegates to `this.adminApi.resolveProfileImageUrl(url)`.

## Verification Evidence

### Frontend build
Command:
```powershell
cd frontend; npx ng build --configuration=development
```
Result: **PASS** (exit code 0).

### Manual browser check
Not run — `ng serve` + API were not started in this session. Expected behavior (per brief): online employee with QR → block visible; cash / no URL → no block (backend gating from Task 2).

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/admin/services/admin-api.service.ts` | `qrImageUrl` on `EmployeePayslipDetail`. |
| `frontend/src/app/admin/pages/payroll/payroll-page.component.html` | Scan to pay QR block in Preview modal. |
| `frontend/src/app/admin/pages/payroll/payroll-page.component.ts` | `resolvePayslipQrUrl` helper. |

## Commit

- **SHA:** `b05ad20`
- **Subject:** `feat(admin): show Scan to pay QR on payslip preview`

## Self-Review

- Matches task brief markup and helper verbatim.
- No backend or employee dashboard changes.
- `@if (resolvePayslipQrUrl(...); as qrUrl)` avoids showing the block when URL resolves to null/empty.

## Concerns

- Manual UI verification deferred until dev servers are available.
