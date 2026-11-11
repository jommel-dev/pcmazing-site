# HIRS hourly day proration (early out / incomplete day)

**Status:** Implemented  
**Date:** 2026-11-11  
**Area:** HIRS payroll — attendance → day pay → payslip base pay

## Problem

Employees who leave early (or otherwise work under a full duty day) are currently paid in coarse buckets: full day (~9h elapsed), half day (4h–under full), or unpaid (&lt;4h). Owners want pay to reflect **hours actually worked**: daily rate ÷ 8 working hours × paid hours.

## Goals

- Prorate daily-rate day pay by paid working hours (standard **8**).
- Full duty includes a **1-hour break** (clock span for a full day is typically ~9 elapsed hours).
- Early outs reduce that day’s pay continuously (no half-day bucket).
- Keep undertime grace as a full-day bump.
- Keep OT eligibility on **9 elapsed** hours and **approval-gated** (never auto-added).
- Fixed monthly salary employees unchanged.

## Non-goals

- Deriving break from lunch out/in punches (V1 uses assumed break).
- Persisting paid hours / units on attendance rows.
- Changing late, loan, commission, or manual deduction rules.
- Changing fixed monthly salary period math.
- Auto-paying overtime.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Standard paid work hours | **8** |
| Break | Assume **1h** when elapsed ≥ **5h**; else no break subtraction |
| Incomplete day pay | Continuous `paidHours / 8 × dailyRate` (replace half-day buckets) |
| Under 4h | Still paid proportionally (no unpaid floor) |
| Undertime grace | Still bumps to **full day** when paid hours are within grace of 8 |
| No time out | **₱0** for that day until punch completed |
| OT threshold | Still **9.0 elapsed** hours |
| OT pay | Still requires employee request + admin approval |
| Who | Daily-rate path only; **fixed monthly** exempt |
| Implementation style | Replace day units with hour fractions (Approach 1) |
| Persistence | Compute at preview/generate time; **no migration** |

## Day pay formula

Applies per attendance day when the employee is on a **daily rate** path and both `time_in` and `time_out` exist.

1. **Elapsed** = `(timeOut − timeIn)` in hours (same span used for display / OT eligibility).
2. **Paid hours** =
   - if `elapsed < 5` → `elapsed`
   - else → `max(0, elapsed − 1)`
3. Cap paid hours used for **regular day pay** at **8**.
4. **Day units** = `paidHours / 8` (continuous in `[0, 1]`).
5. If paid hours are within **undertime grace** of 8 → units = **1.0**.
6. **Day pay** = `units × dailyRate` (Office/WFH rate selection unchanged).
7. Missing `time_out` → units = 0 / Incomplete.
8. Late deductions remain separate ledger lines.
9. Hours beyond 9 elapsed may become OT only if requested and approved; regular day pay never exceeds 1.0 unit from this formula.

### Examples (₱800/day, 30 min grace)

| Clock span | Elapsed | Paid hours | Units | Day pay |
| --- | --- | --- | --- | --- |
| 09:00–15:00 | 6.0 | 5.0 | 0.625 | ₱500 |
| 09:00–12:00 | 3.0 | 3.0 (no break) | 0.375 | ₱300 |
| 09:00–18:00 | 9.0 | 8.0 | 1.0 | ₱800 |
| 09:00–17:40 | 8.67 | 7.67 | 1.0 via grace | ₱800 |
| Time in only | — | — | 0 | ₱0 |

## Architecture

### Pure helpers (new util + unit tests)

Suggested module: `backend/src/admin/payroll/day-pay-hours.util.ts`

- `toPaidHours(elapsedHours: number): number`
- `dayPayUnitsFromPaidHours(paidHours: number, undertimeGraceMinutes: number): number`
- Constants:
  - `STANDARD_WORK_HOURS = 8`
  - `ASSUMED_BREAK_HOURS = 1`
  - `BREAK_AFTER_ELAPSED_HOURS = 5`
  - `OT_ELAPSED_THRESHOLD_HOURS = 9` (eligibility only)

### Service integration

`payroll.service.ts`:

- Replace half-day `dayPayUnits` / related labels with the helpers.
- Period summary, payslip generation, and day-row labels all use the same units.
- **OT hourly rate** for approved OT uses **daily ÷ 8** (aligned with standard work hours).
- **OT eligibility** remains `elapsed > 9` and approval-gated.

### UI

Update HIRS copy that still describes “9h+ = full day / 4h = half day” to:

- Full duty = 8 paid hours (+ 1h break in the day).
- Early out / short day = paid for paid hours worked.
- Undertime grace can still pay a full day.
- OT after 9 elapsed hours still needs approval.

### Data

No schema / migration changes. Regenerating payslips recalculates with the new rule (no historical snapshot of old half-day units).

## Labels

| Condition | Label |
| --- | --- |
| No time out | `Incomplete` |
| units = 1 via grace | `Undertime (paid, ≤Xm)` |
| units = 1 otherwise | `Full day` |
| 0 &lt; units &lt; 1 | `Partial (Nh)` using paid hours |
| units = 0 | `Unpaid` |

## Testing (required before ship)

- Break rule: elapsed &lt; 5 vs ≥ 5.
- Proration: ₱800, 6 elapsed → 5 paid → ₱500.
- Grace bumps short paid hours to full day.
- No time out → 0 pay.
- OT still requires elapsed &gt; 9 and approval; unapproved OT does not increase pay.
- Fixed monthly path unchanged in unit/integration coverage where already asserted.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Assumed break unfair on short-but-≥5h days | Documented rule; V1 accepts simplicity over lunch-punch math |
| Payslip history changes on regenerate | Expected; call out in release note to owners |
| Copy still says half day | Explicit UI string updates in plan |

## Related

- Existing late deductions: `docs/superpowers/specs/2026-10-08-payroll-loans-commissions-deductions-remarks-design.md`
- Office/WFH daily rates: `docs/superpowers/specs/2026-09-22-office-wfh-daily-rates-design.md`
