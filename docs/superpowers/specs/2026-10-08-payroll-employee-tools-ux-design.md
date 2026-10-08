# Payroll Employee Tools UX — Design

**Date:** 2026-10-08  
**Status:** Implemented  
**Scope:** Loan labels on payslips; loan cancel/restore/soft-delete; confirmations and collapsed create forms on all Employee tools cards.

## Goal

Make Employee tools (Loans, Commission entries, Manual deductions) cleaner and safer: named loans on payslips, confirmations before mutating actions, restore for cancelled loans, irreversible soft-delete, and collapsed create forms by default.

## Decisions

| Topic | Choice |
| --- | --- |
| Soft delete | New loan `status = 'deleted'` (not `deleted_at`) |
| Cancelled loans | Stay in list with Restore + Delete |
| Soft-deleted loans | Hidden from list; cannot restore; excluded from generate |
| Confirmations | `window.confirm` (match existing admin patterns) |
| Forms UX | Collapsed by default on all three cards; `+` / close toggle in card header |
| Loan label | Required on create; used as payslip ledger line label |

## Current state

- Payslip ledger labels loans as `Loan #{id}`.
- Loan statuses: `active` \| `paid` \| `cancelled`.
- Cancel sets `cancelled`; no restore or soft-delete.
- Create/add forms always visible; no confirmations on Employee tools mutations.

## Data model

### `pcmazing_payroll_loans`

- Add `label VARCHAR(120) NOT NULL` (migration + ensure-schema).
  - Backfill existing rows: `COALESCE(NULLIF(TRIM(notes), ''), 'Loan #' \|\| id)` or `'Loan #' \|\| id`.
- Extend status CHECK to include `'deleted'`.
- List/query APIs default to `status <> 'deleted'`.
- Generate / assemble only loads `status = 'active'` (already); ensure `deleted` never participates.

### Ledger label

In `assemblePayslipLedger`, loan line label = trimmed `loan.label` if present, else `Loan #{id}` (legacy safety).

## API

| Action | Behavior |
| --- | --- |
| `POST /loans` | Require `label` (1–120 chars). Store with principal/terms. |
| `PATCH /loans/:id` | Allow `status`: `cancelled` \| `active` (restore from cancelled only) \| `deleted`. Reject restore of `deleted` or `paid`→`active`. Optional `label` update allowed. |
| `GET /loans` | Exclude `deleted` by default. |

Restore rules:

- Only `cancelled` → `active`.
- `deleted` → reject (400).
- Soft delete allowed from `active`, `cancelled`, or `paid`.

## UI — Employee tools (all three cards)

### Collapsed forms

- Header row: card title (left) + toggle control (right).
- Default: form closed.
- Toggle opens/closes create/add form (`+` when closed, `×` when open).
- After successful create/add, collapse form again and reset fields.

### Confirmations

Use `window.confirm` before:

| Card | Actions |
| --- | --- |
| Loans | Create loan; save period override; cancel; restore; soft-delete |
| Commission entries | Add; remove |
| Manual deductions | Add; remove |

Delete confirm copy must state the loan will be hidden and cannot be restored.

### Loans list

- Show label prominently; balance/status secondary.
- **Active:** Set period override, Cancel, Delete.
- **Cancelled:** Restore, Delete (stay in same list).
- **Paid:** Delete only (cleanup).
- Override UI keeps existing Cancel alongside Save override.

## Out of scope

- Hard-deleting loan rows or ledger history.
- Custom modal library.
- Moving late/work-week settings into Employee tools.
- Bulk loan operations.

## Acceptance

1. New loan requires a label; payslip/PDF ledger shows that label (not `Loan #n` when label set).
2. Cancelled loan remains listed; Restore returns it to active and it can deduct again on generate.
3. Soft-deleted loan disappears from Employee tools and is never restored or deducted.
4. Create/add forms on all three cards start collapsed; `+` opens them.
5. Cancel/delete/restore/remove/create/add/override each prompt for confirmation; declining cancels the action.

## Implementation notes

- Migration `076` (or next number) for `label` + status CHECK update; mirror in `payroll.schema.ts` ensure path.
- Update DTOs, loan service specs, and `payroll-payslip-ledger.util` (+ tests) for label.
- Frontend: `PayrollLoan.label`, collapsed signals per card, confirm wrappers around existing actions.
