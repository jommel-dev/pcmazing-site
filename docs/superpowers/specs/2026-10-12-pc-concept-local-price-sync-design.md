# PC Concept local price sync design

**Date:** 2026-10-12  
**Status:** Approved for planning  
**Scope:** Sync [PC Concept](https://pcconcept.com.ph/) public catalog into a local price store so items appear in quotation create search (Web & local stores).

## Goal

Staff creating quotations can search PC Concept product names/SKUs and pull the store’s **regular** price into a line item, without manually maintaining a CSV for that catalog.

## Current state

- Quotation create searches inventory materials plus `GET /admin/parts-price-search` (web adapters + all **active** local price stores).
- Local catalogs live in `pcmazing_local_price_stores` / `pcmazing_local_price_items` (CRUD + CSV **replace**).
- PC Concept site exposes a public generated file:  
  `https://pcconcept.com.ph/assets/js/products-data.js`  
  (`window.PCC_DATA = { settings, products: [...] }` — ~550 products with `id`, `sku`, `name`, `brand`, `cat`, `specs`, `price`, `sale`, `stock`, `hidden`, …).

## Decisions

| Topic | Choice |
| --- | --- |
| Integration style | Sync into a **local price store** (not live scrape per keystroke) |
| Store name | **PC Concept** (auto-create on first sync if missing; keep **active**) |
| Sync replace | Full **replace** of that store’s items on each successful sync |
| Price | Always regular **`price`** (ignore `sale`) |
| Hidden products | Skip when `hidden === true` |
| Invalid price | Skip when `price` missing or ≤ 0 |
| Refresh | Manual **Refresh** + **daily** auto sync (~02:00 Asia/Manila) |
| Quotation UI | No change — existing local search labels hits by store name |
| Inventory | Do **not** import into `tblmaterials` |
| Site markup setting | Ignore `settings.markup` |

## Sync mapping

| Local field | Source |
| --- | --- |
| `title` | `name` |
| `sku` | `sku` if non-empty, else `id` |
| `price_php` | `price` |
| `notes` | Compact: brand, cat, specs (trimmed), stock e.g. `Cab:n Pam:m` |

## Backend

- Fetch catalog URL (default above; optional env `PC_CONCEPT_PRODUCTS_URL`).
- Parse JS assigning `window.PCC_DATA` (extract JSON object; do not `eval` untrusted code beyond controlled parse).
- Ensure store “PC Concept” exists and is active.
- Transaction: delete all items for that store → insert mapped rows; unique SKU per store.
- Clear parts-price-search cache after success.
- On failure: leave previous items unchanged; return clear error.
- Persist **last synced at** (store column or settings row — prefer `last_synced_at` on the store if added; else notes/meta acceptable for v1).
- Endpoints:
  - `POST /admin/local-price-stores/sync/pc-concept` (or `:id/sync` when store is PC Concept) — same permission as local price list edit.
- Scheduled job: Nest schedule daily Manila 02:00 calling the same sync path.

## Admin UI

- On Local price lists: for PC Concept store (or a dedicated card), show:
  - **Refresh from PC Concept**
  - Last synced timestamp
  - Item count after sync
- Loading / error / success messaging.

## Quotation behavior

- After sync, searches (≥3 chars) include hits with `sourceLabel: "PC Concept"`.
- Selecting a hit seeds a **custom** line (description + base unit price), same as other local/web picks.

## Edge cases

- Catalog URL 404 / Cloudflare block → fail sync, keep old items.
- File format change (no `PCC_DATA`) → fail with parse error.
- Empty products array after filters → fail or no-op replace only if explicitly allowed; prefer fail if zero importable products to avoid wiping the store.
- Duplicate SKUs in source → last wins or skip duplicates with stable order (document in plan; prefer first-wins).

## Out of scope

- Live adapter in `parts-price-search` per query
- Branch stock filters / availability gating
- Applying sale prices or site markup
- Scraping HTML pages under `/shop/`
- Customer-facing PC Concept branding beyond source label

## Verification

1. Manual refresh imports hundreds of items onto PC Concept store.  
2. Quotation search finds a known title (e.g. BIOSTAR SSD) labeled PC Concept with regular price.  
3. Failed fetch leaves previous items intact.  
4. Daily schedule is registered and callable without crashing the app.  
