# Office vs WFH Daily Rates

**Date:** 2026-09-22  
**Status:** Implemented  
**Approach:** Keep `monthly_salary` as Office amount; add `wfh_salary`; pay by scheduled location

## Goal

Let admins set two salary amounts per employee (Office and WFH). Period/payslip day pay uses the rate that matches the employee’s **scheduled** work location for that Manila work date. Fixed monthly salary continues to override daily rates.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Model | Two amounts: Office (`monthly_salary`) + WFH (`wfh_salary`) |
| Rate selection | Scheduled weekly location (not punch GPS tag) |
| WFH amount blank | Fall back to Office amount |
| Fixed monthly set | Ignore both daily amounts (unchanged) |
| Off-day punches | No day pay this slice; mismatch remains visible |
| Off-day pay approval | Follow-up feature (out of scope) |
| Column rename | Do not rename `monthly_salary` |

## Scope

### In scope

1. `wfh_salary` on `pcmazing_user_payroll` (+ ensure/migration).
2. Profile API: `wfhSalary` on get/upsert (User Management create/update).
3. Day-pay calculation in period summary / payslip preview/generate: pick Office vs WFH amount from schedule, then existing salary-type + full/half-day + grace rules.
4. User Management UI: label Office rate; add WFH rate field.
5. Payroll Employees list: show both amounts.
6. Payslip day rows: indicate Office vs WFH (and Off unpaid).

### Out of scope

- Off-day punch pay approval workflow  
- Renaming `monthly_salary`  
- Changing OT multipliers or fixed-monthly math beyond “fixed wins”  
- Geofencing or punch-tag-based rates  

## Architecture

```
Admin (User Management)
        │
        ▼
Payroll profile: monthly_salary (office) + wfh_salary
        │
        ▼
Period / payslip day loop
        │
        ├─ resolveExpectedLocation(schedule, workWeek, workDate)
        ├─ pick amount (office | wfh | off→0)
        ├─ existing dailyRate / units / OT
        └─ day row label includes location
```

## Data model

### `pcmazing_user_payroll.wfh_salary` (NUMERIC, nullable)

Same precision/semantics as `monthly_salary`:

- Weekly / semi-monthly: treated as daily rate  
- Monthly / cutoff: same derivation path as today’s `monthly_salary` → daily rate  

`monthly_salary` remains the Office amount. UI copy should say “Office”.

## Pay rules

For each attendance day when `fixed_monthly_salary` is null/unused:

1. `expected = resolveExpectedLocation(weekly_location_schedule, work_week, work_date)`  
2. Amount:
   - `office` → `monthly_salary`
   - `wfh` → `wfh_salary` if set, else `monthly_salary`
   - `off` → day pay units and day pay = 0 (hours may still display)
3. Run existing `resolveRates` / `dayPayUnits` / OT using that amount.

When fixed monthly is set: period pay unchanged; location rates unused.

## API

Extend payroll profile fields:

- `wfhSalary?: number | null`

No new endpoints required.

## UI

- User Management: “Office rate” + “WFH rate” inputs next to existing salary fields.  
- Payroll Employees: show Office and WFH amounts under Amount.  
- Payslip preview: day type / location hint (Office, WFH, Off unpaid).

## Testing / verification

1. Office 800 / WFH 700; Wed=WFH → Wed pays from 700.  
2. WFH blank → WFH days use Office amount.  
3. Fixed monthly set → dual rates ignored.  
4. Off-day punch → ₱0 day pay; mismatch visible.  
5. Edit rates in User Management; period preview reflects change.

## Risks

- Admins leaving WFH blank silently equals Office (acceptable; document in UI).  
- Mid-period schedule edits change which rate applies going forward (same as location feature).  
- Off-day unpaid until approval feature ships — communicate in UI/attendance.

## Follow-up

Off-day punch pay approval: pending → approve/reject; approved days pay at Office rate.
