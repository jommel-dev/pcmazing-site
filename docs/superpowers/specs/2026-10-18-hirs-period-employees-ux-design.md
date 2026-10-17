# HIRS Period pay + Employees UX design

**Date:** 2026-10-18  
**Status:** Approved for implementation  
**Scope:** Per-employee payslip generate (keep bulk); Period pay search/sort/pagination + Preview icon + wider Employee column; Employees tab sort/pagination + View dossier modal.

## Decisions

| Topic | Choice |
| --- | --- |
| Generate | Keep bulk; add per-row Generate (wire `employees[]` on generate API) |
| Preview modal confirm | Remains bulk generate |
| Period table UX | Client search / sort / pagination (~20/page); Preview = eye icon + tooltip |
| Employees list UX | Keep server `?search=`; add client sort + pagination |
| Employee View | Full dossier via new admin GET detail endpoint |

## Period pay

### Backend

`generatePayslips` must filter to `body.employees` when non-empty (mirror `previewPayslips`). Each entry: `userId`, `userSource`, `payslipPeriod`. Empty/omitted = all employees (bulk).

### Frontend

- Search input filters loaded `periodItems`.
- Sortable headers (name, net, days, hours, etc.).
- Pagination on filtered/sorted list.
- Wider Employee column (`min-w` / more `fr`).
- Preview: icon button + tooltip (existing group hover pattern).
- Generate (row): icon + tooltip → confirm → `POST period/generate` with single-employee `employees` array + current period dates/type/confirmOverlap.

## Employees tab

### Backend

`GET /admin/payroll/employees/:userId?userSource=` (`payroll.view`) returns:

- profile (payroll fields, payout, QR if any)
- weekly schedule + expected location today
- today punches/status
- attendance for range (default current Manila month; optional `dateFrom`/`dateTo`)
- payslips (recent list)
- open loans summary
- commissions + manual deductions for a recent window or open items (reuse Tools query patterns)

### Frontend

- Client sort + pagination on list after search.
- View icon → modal with dossier sections.
- Edit week schedule unchanged.

## Out of scope

- Removing bulk generate
- Server-side period pagination
- Changing payslip PDF content
