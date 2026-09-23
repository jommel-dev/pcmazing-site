# Task 4 Report: Admin UI — User Management + Payroll Employees

## Status

**DONE**

## Commits

| SHA | Subject |
|-----|---------|
| `0dca199` | Add Office and WFH rate fields in admin payroll UI. |

## Files modified

- `frontend/src/app/admin/services/admin-api.service.ts` — `wfhSalary` on `AdminUser`, `PayrollEmployeeItem`, create/update payloads
- `frontend/src/app/admin/pages/user-management/user-management-page.component.ts` — form control, populate/reset, create/update payload + validation
- `frontend/src/app/admin/pages/user-management/user-management-page.component.html` — Office/WFH rate fields + view panel
- `frontend/src/app/admin/pages/payroll/payroll-page.component.html` — Amount column shows Office + WFH (or “Same as office”)
- `frontend/src/app/admin/pages/payroll/payroll-page.component.ts` — included as listed (existing weekly-location helpers; no new formatter required)

## Steps completed

1. Added `wfhSalary?: number | null` to API types and create/update payloads
2. User Management: renamed salary label to Office rate; added WFH rate with blank=Office help; view shows both
3. Payroll Employees Amount: Office + WFH lines; fixed monthly unchanged when set
4. Frontend build
5. Commit (only the five frontend files listed in the brief)

## Build

Command:

```powershell
cd frontend; npx ng build --configuration=development
```

Result: exit 0

## Self-review

- Preserved existing weekly-location UI in the same files.
- Blank WFH sends `null`; UI help and list/view show “Same as office”.
- Fixed monthly Amount display unchanged when set.
- No backend changes.

## Concerns

- Commit also includes prior uncommitted weekly-location UI in these five files (intentionally preserved per brief).
- Create path still omits `monthlySalary` when blank (existing pattern); `wfhSalary` always sent (null when empty) per brief.
