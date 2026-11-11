# Payslip short-day / early-out amount (display)

**Status:** Implemented  
**Date:** 2026-11-11  
**Depends on:** `2026-11-11-hirs-hourly-day-proration-design.md`

## Goal

Show the unpaid portion of a full daily rate on payslips when an employee works a short / early-out day, without changing net pay math.

## Formula

Per punched day on the **daily-rate** path (not fixed monthly):

`shortDayAmount = max(0, roundMoney(dailyRate − dayPay))`

- Full day / undertime grace full day → `0`
- Incomplete / no rate / fixed monthly → `0`
- Summary `shortDayTotal` = sum of day `shortDayAmount`

Display only — base pay already uses reduced `dayPay`; do **not** add a ledger deduction line.

## Surfaces

- Admin payslip day table: **Short** column (`−₱X` or `—`)
- Admin payslip summary: **Short-day / early-out: −₱total**
- PDF: same column + summary line

## Non-goals

- Migration / persisted columns
- Changing net / ledger deduction types
- Fixed-monthly short-day amounts
