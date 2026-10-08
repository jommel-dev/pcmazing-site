# Task 10 Report: Acceptance + spec status

## Status

Completed. Spec status set to **Implemented**; acceptance mapped to tests and code paths (no new E2E harness).

## Verification

- `npx jest src/admin/payroll --no-cache` — 13 suites, 49 tests passed.

## Acceptance checklist

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Equal-installment loan on successive cutoffs; skip defers one period | **Partial** | Stable installment at create: `payroll-loans.service.spec.ts` (“stores principal divided by count…”). Per-period amount + skip→0: `payroll-ledger.util.spec.ts` (`equal_installments`, `skip loan returns 0`). Skip omits line: `payroll-payslip-ledger.util.spec.ts` (“omits on-time punches and skipped loans”). Generate applies loans + balance updates: `payroll.service.ts` `replacePayslipLedger` (~2273–2285). No multi-cutoff integration test; “defer to end of schedule” is behaviorally skip-with-unchanged-balance only. |
| 2 | Fixed-per-cutoff deducts until balance zero | **Partial** | Amount logic: `payroll-ledger.util.spec.ts` (“fixed_per_cutoff uses fixed amount…”, caps at balance). Paid status on generate: `payroll.service.ts` `replacePayslipLedger` loan `UPDATE` (`status = CASE WHEN balance - $2 <= 0 THEN 'paid'`). No test simulating two consecutive generates to zero. |
| 3 | Custom period amount reduces balance correctly | **Pass** | `payroll-ledger.util.spec.ts` (“custom loan override caps at balance”). Override API: `payroll-loans.service.spec.ts` (“upserts an override without changing the loan balance” until generate). Balance decrement on generate: `payroll.service.ts` `replacePayslipLedger` `loanDeductions` loop. |
| 4 | Multiple commission lines (typed + Other) increase net | **Partial** | `assemblePayslipLedger` maps every commission entry (`payroll-payslip-ledger.util.ts` ~49–58). Net sums all commission lines: `payroll-ledger.util.spec.ts` (`computePayslipNet composes commission and deductions`). “Other” label rule: `payroll-commissions.service.spec.ts` (“requires a custom label when no commission type is selected”). Unit test uses one commission line, not typed+Other together. |
| 5 | Late clock-in creates late deduction; on-time does not | **Pass** | `payroll-ledger.util.spec.ts` (`computeLateMinutes`, `computeLateDeduction`). Assembly: `payroll-payslip-ledger.util.spec.ts` (late line for 09:30 punch; empty lines for on-time 09:10). Settings wired: `payroll-settings.service.spec.ts`, `dto/payroll-settings.dto.spec.ts`. |
| 6 | Manual deduction appears on payslip | **Pass** | Ledger assembly: `payroll-payslip-ledger.util.spec.ts` (`manual_deduction` line). CRUD/mapping: `payroll-manual-deductions.service.spec.ts`. Period summary surfaces manual total: `payroll-period-summary.service.spec.ts`. |
| 7 | Remarks on dashboard; PDF off/on | **Pass** | Employee modal shows remarks: `frontend/.../sales-employee-dashboard.component.html` (~594–597). Detail API selects `p.remarks`: `payroll-payslip-remarks.service.spec.ts`. PDF flag: `payslip-pdf.util.spec.ts` (`shouldRenderPayslipRemarks`, “omits remarks… when includeRemarks is false”). Query default false: `employee-workspace.controller.ts` (`includeRemarks`). |
| 8 | Legacy payslip without ledger still opens (net = stored `estimated_pay`) | **Partial** | Opens: `getEmployeePayslipDetail` loads payslip + empty ledger query (`payroll.service.ts` ~2743–2930). Empty ledger → net = recomputed `basePay + overtimePay` via `computePayslipNet` (same formula as pre-ledger generate), not an explicit read of `p.estimated_pay`. List view still uses stored `estimated_pay`: `getEmployeePayslips` (~2694–2717). No dedicated legacy regression test. |

## Summary

| Pass | Partial | Gap |
| --- | --- | --- |
| 4 | 4 | 0 |

## Commit

- `docs: mark payroll ledger features implemented`

## Concerns (for controller)

1. **Multi-period loan flows** are covered by pure helpers + generate SQL paths but lack integration tests across two cutoffs (items 1–2).
2. **Legacy net display** recomputes from attendance; if pay rules or attendance change after an old payslip was stored, detail `netPay` may diverge from `estimated_pay` even with an empty ledger (item 8).
3. **Equal-installment “defer to end”** is implemented as skip (no deduction, balance unchanged); no explicit schedule extension beyond that.

## Fix

- Item 8: **Pass** — legacy payslip detail now uses stored `estimated_pay` when no ledger rows exist; payroll tests pass (13 suites, 50 tests).
