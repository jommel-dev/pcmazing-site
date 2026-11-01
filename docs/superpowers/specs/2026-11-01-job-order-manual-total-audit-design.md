# Job Order manual total + audit log design

**Date:** 2026-11-01  
**Status:** Approved for implementation  
**Scope:** Optional manual total on Job Order create/edit and detail; audit who created/edited; detail timeline + searchable logs.

## Decisions

| Topic | Choice |
| --- | --- |
| Override model | Store `manual_total_amount` (nullable); when set, customer total uses it |
| Surfaces | Create/edit form + detail page edit |
| Reason | Required when changing total on an **existing** JO; optional on create |
| Logging | Detail timeline + searchable Job Order activity logs |
| Permission | `job_order.edit` to set/change total; `job_order.view` to read logs |

## Data

### `pcmazing_services`

- `manual_total_amount NUMERIC(12, 2) NULL` — when null, total = calculated (parts + labor − discounts − custom discount)

### `pcmazing_job_order_audit_log`

| Column | Purpose |
| --- | --- |
| `id` | PK |
| `service_id` | Job order id |
| `reference_no` | Snapshot |
| `action_type` | `created` \| `manual_total_set` \| `manual_total_cleared` \| `updated` |
| `actor_admin_id` | Who |
| `actor_admin_username` / `actor_admin_name` | Snapshots |
| `reason` | Optional on create; required on total change for existing |
| `meta_json` | `{ oldTotal, newTotal, calculatedTotal, ... }` |
| `created_at` | When |

Indexes: `(created_at DESC)`, `(service_id, created_at DESC)`.

## Behavior

- **Calculated total** remains available for display as “Calculated”.
- **Effective total** = `manual_total_amount` if set, else calculated.
- Refunds / downpayment / balance due use **effective** total.
- Create: log `created` (and `manual_total_set` if override provided).
- Detail edit total: reason ≥ 8 chars; log set or cleared.
- Stamp `updated_at`; keep `created_by` on insert.

## APIs

- Extend create/update DTOs with `manualTotalAmount?: number | null`.
- `PATCH /admin/inventory/services/:id/manual-total` body `{ amount: number | null, reason: string }` (`job_order.edit`) — or fold into existing update if cleaner.
- `GET /admin/inventory/services/:id/activity` and `GET /admin/inventory/services/activity` (paginated, filters).

## UI

- Create/edit: Manual total input + hint; show calculated vs effective.
- Detail: Edit total control + reason; activity timeline.
- Job Order area: Activity / logs list (searchable).
- Receipt: use effective total; badge when manual.

## Out of scope

- Hiding line item prices (quotation-only for now)
- Changing how line discounts work
