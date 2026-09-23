# Task 1 Report: Location pay helpers + unit tests

## Status

**DONE**

## Commits

| SHA | Subject |
|-----|---------|
| `fa420fa` | Add location pay amount helpers for Office vs WFH rates. |

## Files created

- `backend/src/admin/payroll/location-pay.util.ts` — `pickSalaryAmountForLocation`, `locationPayLabelSuffix`
- `backend/src/admin/payroll/location-pay.util.spec.ts` — 5 Jest cases per brief

## TDD evidence

### RED (Step 2)

Command:

```powershell
cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts --verbose
```

Note: Brief uses `-v`; this Jest CLI rejects `-v` (`Unrecognized option "v"`). Used `--verbose` for equivalent output.

Output (spec only, before implementation):

```
FAIL src/admin/payroll/location-pay.util.spec.ts
  ● Test suite failed to run

    Cannot find module './location-pay.util' from 'admin/payroll/location-pay.util.spec.ts'

Test Suites: 1 failed, 1 total
Tests:       0 total
```

### GREEN (Step 4)

Command:

```powershell
cd backend; npx jest src/admin/payroll/location-pay.util.spec.ts --verbose
```

Output:

```
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        1.204 s
```

## Self-review

- Implementation matches brief verbatim; imports `WorkLocationType` from `work-location.util.ts` (unchanged).
- Global constraints respected in logic: off → `null`; WFH with null/invalid WFH amount falls back to office when office > 0; no renames of monthly salary fields; no changes to `payroll.service` or frontend.
- Commit contains only the two new files; other workspace WIP left unstaged.
- `locationPayLabelSuffix('office')` uses `default` branch → `' · Office'` as specified.

## Concerns

- Minor: plan’s `-v` flag does not work with this repo’s Jest version; use `--verbose` in later tasks if needed.
- Implementation treats non-positive salaries as absent (`> 0` check); brief tests do not assert zero/negative edge cases (consistent with provided implementation code).

## Test summary

One suite, five tests: office/WFH/off amount picking, WFH→office fallback, and label suffixes for all three location types — all passing.
