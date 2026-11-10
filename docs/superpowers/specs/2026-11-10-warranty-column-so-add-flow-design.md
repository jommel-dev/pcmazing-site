# Warranty column + Sales Order add-flow design

**Date:** 2026-11-10  
**Status:** Approved for implementation  
**Scope:** Frontend UX only on Job Order parts and Sales Order create. No schema/API changes (existing per-item warranty fields remain).

## Goals

1. Move warranty controls into a dedicated **Warranty** column before the item name so rows can be selected in bulk.
2. Apply one warranty to many selected rows via a single **Set warranty** action, while still allowing per-row edit.
3. Make Sales Order item entry match Job Order Parts Used: type-to-search / pick / Enter — no **Add item** button.

## Decisions

| Topic | Choice |
| --- | --- |
| Bulk model | Checkbox = **selection** only (not on/off by itself) |
| Select all | Header checkbox in Warranty column |
| Bulk set | **Set warranty** button above grid when ≥1 row selected → existing popup → apply to all selected |
| Per-item | Duration link / Set on that row opens popup for **that row only** |
| Uncheck selection | Does **not** clear warranty |
| Clear warranty | Existing popup/clear behavior on that row (or bulk apply after a future clear path if we keep Clear in popup) |
| Surfaces | JO create/edit **parts** + SO create **items** |
| SO Add item | **Removed** — search box + Enter only |
| Stores on SO | Same parts-price search as JO (inventory + web/local stores) |
| Backend | No changes |

## Warranty column layout

Column order (desktop):

`Warranty | Material/Item | …existing columns… | remove`

### Warranty cell

- Checkbox for selection.
- If the row already has warranty: show duration link (e.g. `7 Days`) under/beside the checkbox; click opens per-row popup.
- If no warranty yet: optional muted **Set** link that opens per-row popup (so you can assign without using bulk).
- Header: checkbox (select all / none) + label **Warranty**.

### Bulk bar

When `selectedCount >= 1` and form is editable:

- Show **Set warranty** (and selected count, e.g. `2 selected`) above the grid.
- Opens the existing **Set warranty** popup in bulk mode.
- **Save** writes `warrantyValue` / `warrantyUnit` onto every selected index.
- **Cancel** leaves all rows unchanged; selection stays as-is.
- After successful bulk save, clear selection (recommended) so the next bulk action is intentional.

### Done / view mode

- JO Done / SO view: no checkboxes, no Set warranty; show read-only duration when present.

## Sales Order add-flow

Mirror JO Parts Used:

1. Single search input above the items list.
2. Dropdown sections: **Inventory** + **Web & local stores** (PC Concept, PC Express, etc.).
3. Pick inventory → add line with material id + price.
4. Pick store hit → add custom-style line with title, price, brand/source label.
5. Type new name + Enter / **Add as new** → custom non-inventory line (price editable).
6. Stock rules: Non-Inventory always selectable; stocked materials only when in stock; if exact name exists but is not selectable, still allow add-as-new.
7. Remove **Add item** and the empty-row-first workflow.
8. Existing rows show name as text (like JO), not an in-row search field — edit qty/price/discount/warranty; remove to delete.

### SO create empty state

- No starter empty row on load (or clear any auto-`addItem()` seed).
- User adds the first line via search.

## Popup modes

Reuse the current warranty popup component/handlers:

| Mode | Trigger | On Save |
| --- | --- | --- |
| Single | Row Set / duration link | Update that index only |
| Bulk | **Set warranty** button | Update all selected indices |

Draft presets/custom number+unit unchanged (`7 Days`, `1 Month`, `3 Months`, `1 Year`, custom day/week/month/year).

## Out of scope

- Backend / migration changes
- Warranty on JO services/labor
- Bulk clear-warranty button (unless already supported by unchecking in single-row UX — single-row clear remains)
- Quotation form parity
- Editing warranty on existing Sales Orders after create (SO remains create-only for edits)

## Acceptance checks

- JO: Warranty column before name; header select-all; bulk Set warranty applies to selected only; per-row Set still works.
- JO: Unchecking a row does not wipe its warranty.
- SO: Can add inventory, store, and manual lines without Add item.
- SO: Same warranty column + bulk/per-row behavior as JO.
- Receipts unchanged (still show per-line warranty labels from saved fields).
