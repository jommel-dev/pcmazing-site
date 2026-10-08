# Payroll Loans, Commissions, Late Deductions, and Payslip Remarks

**Date:** 2026-10-08  
**Status:** Implemented  
**Scope:** Employee loans/cash advances with terms and period overrides; multi-line commissions; attendance-linked late deductions with settings plus manual deductions; per-payslip notes/remarks with optional print inclusion.

## Goal

Extend payroll so admins can manage loans, commissions, and deductions that flow into payslip net pay automatically (with manual control), and attach remarks employees see on their dashboard while choosing whether to include them when printing a payslip — without breaking existing attendance/OT pay math.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Architecture | Payslip ledger lines + supporting loan/commission/deduction tables |
| Loan terms | Per loan: **equal installments** (amount ÷ N cutoffs, frozen as `fixed_installment_amount`) **or** **fixed amount per cutoff** until balance zero |
| Loan skip | Skip this cutoff → installment deferred to end of schedule; balance unchanged until deducted |
| Loan manual | Custom amount for this period allowed and reduces balance; the equal-installment amount stays fixed, so custom/skip shifts the schedule end until the balance is paid |
| Late definition | Global shift start + late grace minutes; clock-in after start+grace = late |
| Late amount | Configurable fixed ₱ and/or per-minute after grace (settings) |
| Commissions | Commission types catalog + “Other” free-text; multiple lines per employee/period |
| Other deductions | Manual deduction lines (label + amount) in addition to auto-late |
| Remarks | Per-payslip admin text; shown on employee dashboard; print/PDF checkbox **default unchecked** |
| Net pay | `basePay + overtimePay + commissions − late − loan − otherDeductions`, floored at ₱0 |
| Access | Same as existing payroll admin; employees see only their own data |

## Out of scope

- Full accounting / GL / statutory tax modules  
- Office vs WFH different late rules (V1 is global)  
- Standing (multi-period) employee notes  
- Employee self-service loan/commission requests  
- Interest-bearing loans  

## Current baseline

Payslips today store `estimated_pay` from attendance day units + approved OT only. Settings: `work_week`, `undertime_grace_minutes`. No loan/commission/late penalty/remarks. Employee portal: payslip modal + PDF download.

## Architecture

### Payslip ledger

Each generated payslip gains structured **ledger lines** (persisted):

| Field | Notes |
| --- | --- |
| `line_type` | `commission` \| `late_deduction` \| `loan_deduction` \| `manual_deduction` |
| `label` | Display text |
| `amount` | Always positive; sign implied by type (earnings vs deduction) |
| `source` | `auto` \| `manual` \| `override` |
| `meta` | JSON (e.g. loan_id, minutes_late, commission_type_id) |

**Gross / net (V1):**

- `grossPay` = `basePay + overtimePay + sum(commissions)`  
- `totalDeductions` = sum(late + loan + manual)  
- `netPay` = `max(0, grossPay − totalDeductions)`  
- Keep `estimated_pay` column = `netPay` for backward compatibility with existing UI that reads it.

### Loans

**`pcmazing_payroll_loans`**

- employee (`user_id` + `user_source`), `principal`, `balance`  
- `term_style`: `equal_installments` \| `fixed_per_cutoff`  
- `installment_count` (equal) or `fixed_installment_amount` (fixed)  
- `status`: `active` \| `paid` \| `cancelled`  
- `notes`, timestamps  

**`pcmazing_payroll_loan_installments`** (optional schedule rows) or compute on the fly + **period overrides**:

**`pcmazing_payroll_loan_period_overrides`**

- `loan_id`, period identity (`payroll_run_id` or date_from/date_to)  
- `action`: `skip` \| `custom`  
- `custom_amount` when action = custom  

On payslip generate for an active loan with remaining balance: create `loan_deduction` line unless skipped; amount = schedule default or custom.

### Commissions

**`pcmazing_payroll_commission_types`:** `id`, `name`, `is_active`  

**`pcmazing_payroll_commission_entries`:** employee, period/run, `type_id` nullable, `label` (required if other), `amount`, created_by  

Multiple entries allowed; become `commission` ledger lines on generate.

### Late & manual deductions

**Payroll settings additions** (same settings store as today):

- `shift_start_time` (e.g. `09:00`)  
- `late_grace_minutes` (0–120)  
- `late_deduction_fixed` (₱, default 0)  
- `late_deduction_per_minute` (₱, default 0)  

**Auto-late:** For each attendance day in the period with a clock-in: if `time_in` is after `shift_start + grace` on that local work date, minutes late = difference after grace; deduction = `fixed + minutes * per_minute` (if both zero, no line). Rest / day-off / absent → no late line.

**Manual deductions:** `pcmazing_payroll_manual_deductions` (employee, period/run, label, amount) → `manual_deduction` lines.

### Remarks

- Column on `pcmazing_generated_payslips`: `remarks` (text, nullable)  
- Employee dashboard always shows remarks when non-empty  
- PDF/print endpoint accepts `includeRemarks=true|false` (default **false**); UI checkbox on employee print action  

### Regenerate behavior

- Refresh **auto** late lines from current attendance + settings  
- Preserve admin commissions, manual deductions, remarks, and loan period overrides unless explicitly cleared  
- Recompute net and rewrite ledger accordingly  

## UI

### Admin payroll page

- Settings: existing fields + late rule fields  
- Commission types CRUD (name, active)  
- Per-employee (or period workspace): loans CRUD + balance; period loan skip/custom; commission entries; manual deductions; remarks on payslip rows  
- Period preview/generate table columns: base, OT, commissions, deductions (breakdown), net  

### Employee dashboard

- Payslip modal: breakdown including commissions/deductions/loan + remarks  
- Print/PDF: “Include notes/remarks” checkbox, default off  

### Access

- Admin: existing payroll permissions  
- Employee: own payslips only  

## Error handling

- Deductions exceeding gross → net ₱0 + admin warning on generate/preview  
- Soft-delete/cancel loan with balance → stop future auto lines; past payslips unchanged  
- Unknown commission type → reject  
- Invalid late settings (negative amounts) → reject on save  

## Testing / acceptance

1. Equal-installment loan appears on successive cutoffs; skip defers one period.  
2. Fixed-per-cutoff loan deducts until balance zero.  
3. Custom period amount reduces balance correctly.  
4. Multiple commission lines (typed + Other) increase net.  
5. Late clock-in creates late deduction per settings; on-time does not.  
6. Manual deduction appears on payslip.  
7. Remarks visible on dashboard; PDF without flag omits remarks; with flag includes them.  
8. Legacy payslip without ledger still opens (net = stored `estimated_pay`).  

## Implementation notes

- Prefer pure helpers for late minutes, installment amount, and net math (unit tested).  
- Extend `payslip-pdf.util` and employee payslip modal together so print matches screen when remarks included.  
- No unrelated payroll redesign.  
