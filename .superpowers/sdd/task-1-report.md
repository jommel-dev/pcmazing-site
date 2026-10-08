# Task 1 Report: Pure helpers (TDD)

## Status

**DONE**

## Commits

| SHA | Subject |
|-----|---------|
| `03ebb52` | feat(payroll): ledger math helpers for loans late and net |

## TDD

1. Added `payroll-ledger.util.spec.ts` with the six cases from the plan (verbatim structure).
2. **RED:** Jest failed — module `./payroll-ledger.util` missing.
3. Implemented `payroll-ledger.util.ts`.
4. **GREEN:** `npx jest src/admin/payroll/payroll-ledger.util.spec.ts --no-cache` — 6 passed.

## Deliverables

| File | Purpose |
|------|---------|
| `backend/src/admin/payroll/payroll-ledger.util.ts` | Types + pure math helpers |
| `backend/src/admin/payroll/payroll-ledger.util.spec.ts` | Unit tests |

### Exported API

- `PayslipLedgerLineType`, `PayslipLedgerLine`
- `computeLateMinutes` — Asia/Manila wall clock via `Intl.DateTimeFormat`; compares clock-in on `workDateYmd` to `shiftStartHhmm + graceMinutes`; returns whole minutes late (0 if early/on time/wrong date).
- `computeLateDeduction` — 0 when `minutesLate <= 0`; else `fixed + minutesLate * perMinute`, rounded to 2 decimals.
- `computeEqualInstallmentAmount` — `roundMoney(principal / installmentCount)`.
- `computeLoanPeriodAmount` — skip → 0; custom → capped custom; fixed_per_cutoff → fixed amount; equal_installments → prefer `fixedInstallmentAmount` (principal/N at loan create), else balance ÷ count; all capped at `balance`, money rounded.
- `computePayslipNet` — per design spec: `grossPay = base + OT + commissions`; deductions = late + loan + manual; `netPay = max(0, gross − deductions)`; category subtotals returned.

## Self-review

- Matches plan signatures and passing tests.
- Timezone documented in file header and `computeLateMinutes` JSDoc; test UTC instant `2026-10-08T01:30:00.000Z` = 09:30 Manila, after 09:15 grace boundary → late minutes &gt; 0.
- `roundMoney` follows existing project pattern (`quotation-topup.util.ts`).
- No changes to `generatePayslips`, UI, or unrelated payroll code.

## Concerns

1. **`equal_installments` fallback:** When `fixedInstallmentAmount` is null, per-period amount still derives from **current balance** ÷ count (legacy path). Task 3+ should persist principal/N on the loan and pass it via `fixedInstallmentAmount`.
2. **Clock-in on wrong Manila calendar date:** Returns 0 late minutes (no cross-midnight shift handling in helper); overnight shifts may need service-layer work date alignment later.

## Verification command

```powershell
cd backend; npx jest src/admin/payroll/payroll-ledger.util.spec.ts --no-cache
```

---

## Review fixes (Important)

**Commit:** `1016efb` — fix(payroll): equal installment preference and ledger tests

### Changes

1. **`computeLoanPeriodAmount` / `equal_installments`:** Prefer `fixedInstallmentAmount` when set; otherwise `computeEqualInstallmentAmount(balance, installmentCount)`. Inline comment documents caller contract. Final amount still capped at `balance`.
2. **Tests added:** custom override (cap + under balance); `fixed_per_cutoff` without skip (incl. balance cap); equal_installments stored fixed vs fallback; balance cap on stored fixed; `computePayslipNet` commission + all deduction types.
3. **Late minutes:** Assert exact **15** minutes for `2026-10-08T01:30:00.000Z` (09:30 Manila) vs shift 09:00 + 15 grace.

### Verification (post-fix)

```powershell
cd backend; npx jest src/admin/payroll/payroll-ledger.util.spec.ts --no-cache
```

```
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Snapshots:   0 total
Time:        ~1.1 s
```
