# Quotation Local Price Lists + Per-Item Topup

**Date:** 2026-09-30  
**Status:** Approved design — pending implementation  
**Approach:** Staff-managed Cabanatuan local price lists (CRUD + CSV) alongside existing web sources; per-line topup (`fixed` or `percent`) with customer-safe final prices only

## Goal

1. Let staff maintain **local Cabanatuan PC store** price lists (in-app + CSV) and surface those hits in quotation parts search **together with** today’s web sources (unchanged).
2. Let staff add a **per-item topup** (fixed ₱ **or** % — one mode per line) when creating/editing quotations. Staff see base, topup, and totals; **customers never see that a topup exists** — only the final unit/line price.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Existing web sources | Remain as-is |
| Local lists | Add staff-managed store lists (Cabanatuan focus by content, not geo-filter) |
| List maintenance | In-app CRUD **and** CSV upload |
| CSV behavior | **Replace** that store’s item list on upload (confirm before replace) |
| Search UX | Local hits **mixed** into the same results list, labeled by store name |
| Topup modes | Per line: `none` \| `fixed` \| `percent` (not both fixed and % on one line) |
| Charged price | **Derived:** `unitPrice` from base + topup (no third free-edit that desyncs) |
| Staff visibility | Create/edit + admin quotation detail |
| Customer / print | Final `unitPrice` + line totals only — no topup fields |
| Inventory | Local lists are **not** imported into `tblmaterials` |

## §1 Local Cabanatuan price lists

### Data

- **Stores:** `id`, `name`, `active`, timestamps.
- **Items:** `id`, `store_id`, `title`, `sku` (nullable), `price_php`, `notes` (nullable), timestamps.
- Soft constraint: unique `(store_id, sku)` when sku present; titles searchable with `ILIKE`.

### Admin UI

- Module under admin (quotations-adjacent): list stores → open store → list/edit items.
- Create/rename/deactivate stores; add/edit/delete items.
- CSV upload per store: columns `title`, `price` (required); `sku`, `notes` optional. Header row required. On success, **replace** all items for that store (confirm dialog).
- Download sample CSV template from the same screen.

### Parts search integration

- Extend `GET /admin/parts-price-search` to query active local items by title/sku (same query string).
- Map hits to existing result shape:
  - `sourceId`: `local:<storeId>`
  - `sourceLabel`: store name
  - `title`, `pricePhp`, optional `sku` / url omitted
- Merge with existing web adapter results; keep current sort (price ascending unless already specified otherwise).
- Selecting a local hit on quotation create seeds description + **base** unit price (same UX as web select).

### Access

- Same roles that already use quotations / parts price search (no new public endpoints).

## §2 Per-item topup

### Math (per unit)

| Mode | Charged `unitPrice` |
|------|---------------------|
| `none` | `baseUnitPrice` |
| `fixed` | `baseUnitPrice + topupValue` |
| `percent` | `baseUnitPrice × (1 + topupValue / 100)` |

- Round money with the same PHP rounding already used for quotation line totals.
- Line total continues to use charged `unitPrice` × quantity, then existing SC/PWD / header discount rules.
- **Staff line topup total:** `(unitPrice − baseUnitPrice) × quantity` (show on create/edit and admin detail).
- Optional quote-level **total topup** sum on those same surfaces.

### Persistence

Add to `pcmazing_quotation_items` (migration):

- `base_unit_price` numeric (NOT NULL; backfill from `unit_price` for existing rows)
- `topup_mode` text NOT NULL DEFAULT `'none'` (`none` \| `fixed` \| `percent`)
- `topup_value` numeric NOT NULL DEFAULT `0`

Keep `unit_price` as the **charged** unit price written by the server from base + mode + value (trust server normalize; reject client `unitPrice` that disagrees, or ignore client charged and recompute).

DTO create/update items accept `baseUnitPrice`, `topupMode`, `topupValue` (and existing fields). Server computes `unit_price` / `line_total`.

### Admin create / edit / detail

- Per line: base price, topup mode, topup value; live preview of charged unit price, per-unit topup, line topup total.
- Inventory / web / local select → set `baseUnitPrice` from seed price; topup defaults to `none` / `0`.
- Admin detail shows the same breakdown (not shown on print).

### Customer safety

- `GET /public/quotations/:token` response **omits** `baseUnitPrice`, `topupMode`, `topupValue`, and any topup totals (strip in service for public path).
- Admin print template unchanged: description, qty, unit price, line total only — no topup columns/labels.
- Share viewer `/q/:token` unchanged visually aside from already using charged prices.

## Out of scope

- Replacing or removing PCX / DynaQuest / Octagon / UniPC / PCHub adapters
- Auto-scraping Cabanatuan store websites
- Importing local lists into inventory stock
- Staff-only “internal worksheet” print with topup (can add later)
- Default global topup % for all lines

## Acceptance

1. Staff can create a store, add items in-app, and search them mixed with web hits on quotation create (labeled by store).
2. CSV replace updates that store’s list; sample template downloadable.
3. On create/edit, choosing fixed or % topup updates charged unit price and shows line topup total for staff.
4. Saved quotation admin detail shows topup breakdown; public share and admin print do **not**.
5. Existing quotations without topup continue to work (`none`, base = unit price).
6. Existing web search behavior still works when local lists are empty.
