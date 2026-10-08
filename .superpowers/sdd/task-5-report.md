# Task 5 Report: Loans + period overrides API

## Status

Completed the employee-loan and loan-period-override APIs.

## Implementation

- Added validated DTOs and guarded routes for listing, creating, updating/cancelling loans, and upserting/deleting period overrides.
- Equal-installment creation persists `computeEqualInstallmentAmount(principal, installmentCount)` as the stable fixed installment amount.
- Override writes never mutate loan balances; balance remains reserved for payroll generation.
- Added migration 075 and runtime schema backfill/constraint correction for the equal-installment storage contract.
- Added typed `AdminApiService` models and clients; no admin UI was added.
- Added loan service tests for stable installment storage, term validation, override upsert behavior, and missing override deletion.

## Verification

- Backend: 16 suites and 80 tests passed; Nest build passed.
- Frontend TypeScript check passed.
- IDE diagnostics reported no errors.
- Targeted ESLint exposed existing CRLF/Prettier failures; new explicit-any findings were removed.

## Commit

- `feat(payroll): employee loans and period overrides API`

## Concerns

- Migration 075 must be applied in existing environments before creating equal-installment loans.
