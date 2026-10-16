# Quotation manual total + hide item prices design

**Date:** 2026-10-16  
**Status:** Approved for implementation  
**Scope:** Quote-level manual grand-total override and customer-facing hide of line prices (print + public link).

## Goal

Staff can set a **manual grand total** that takes priority over item math, and can **hide per-item prices** on customer surfaces while still showing the item list and a single grand total (manual or calculated).

## Decisions

| Topic | Choice |
| --- | --- |
| Manual total UX | Toggle **Use manual total**; when on, amount is the customer grand total |
| Staff reference | Always show calculated total beside manual amount |
| Hide prices UX | Quote-level **Hide item prices from customer** |
| Customer totals when hidden | **Grand Total only** (no subtotal / discount breakdown) |
| Manual + visible prices | Turning manual total **on** auto-enables and locks hide prices |
| Storage | Keep real line prices for staff; override only `total_amount` when manual |
| Public security | Strip unit/line money fields in `getByShareToken` when hide is on |

## Data model

Migration `079_quotation_manual_total_hide_prices.sql` on `pcmazing_quotations`:

- `use_manual_total BOOLEAN NOT NULL DEFAULT FALSE`
- `manual_total_amount NUMERIC(12,2) NULL`
- `hide_item_prices BOOLEAN NOT NULL DEFAULT FALSE`

### Save rules

1. Normalize items and compute `subtotal` / `discount_total` as today.
2. If `use_manual_total`: require finite `manual_total_amount >= 0`; force `hide_item_prices = true`; set `total_amount = manual_total_amount`.
3. Else: `total_amount` = calculated; may keep prior `manual_total_amount` for re-enable convenience.
4. Persist flags with create/update/duplicate.

## Surfaces

| Surface | Behavior |
| --- | --- |
| Admin create/edit/detail | Full line prices; toggles; calculated + effective total |
| Admin print (customer printout) | If hide: description + qty; Grand Total only |
| Public `/q/:token` | Same as print when hide; API strips prices |

## Out of scope

- Per-line hide toggles
- Changing SC/PWD / custom discount math
- Legacy `tblquotation` rows (defaults: flags false / null)
