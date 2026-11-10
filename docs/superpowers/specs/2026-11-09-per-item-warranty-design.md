# Per-item warranty design (Sales Order + Job Order)

**Date:** 2026-11-09  
**Status:** Approved for implementation  
**Scope:** Optional warranty on SO line items and JO parts; checkbox + popup (presets + custom); Warranty column on receipts; hide global terms block by default and rename its title.

## Decisions

| Topic | Choice |
| --- | --- |
| Applies to | SO line items + JO **parts** only (not JO services/labor) |
| Storage model | `warranty_value` (int ≥ 1) + `warranty_unit` (`day` \| `week` \| `month` \| `year`) |
| Create UX | Checkbox opens popup; presets + custom number/unit |
| Receipt | New **Warranty** column on items table |
| Global block | Keep Printing Settings toggle; **default hidden**; rename title |

## Data

### `pcmazing_sales_order_items`

| Column | Type | Notes |
| --- | --- | --- |
| `warranty_value` | `INTEGER NULL` | Required with unit when warranty set; must be ≥ 1 |
| `warranty_unit` | `VARCHAR(10) NULL` | `day` \| `week` \| `month` \| `year` |

Constraint: both null, or both set with valid unit and value ≥ 1.

### `pcmazing_service_parts`

Same two columns and constraint as above.

Migration + ensure-helpers (same pattern as promotion / custom items).

## API

- Extend SO create item DTO and JO create/update part DTO with optional:
  - `warrantyValue?: number | null`
  - `warrantyUnit?: 'day' | 'week' | 'month' | 'year' | null`
- Validate: reject unit without value, value without unit, value &lt; 1, or unknown unit.
- Clear warranty by sending both null / omitting both when checkbox off.
- `GET` detail responses include both fields on SO items and JO parts.
- JO services remain without warranty fields.

## Create / edit UI

### Surfaces

- Sales Order create: each line item row
- Job Order create/edit: each **part** row only

### Checkbox

- Label: **Warranty** (unchecked by default)
- Unchecked → clear `warrantyValue` / `warrantyUnit`
- Checked → open warranty popup
- When set → show summary next to checkbox (e.g. `1 Year`); click reopens popup to edit

### Popup

- Title: **Set warranty**
- Presets: `7 Days`, `1 Month`, `3 Months`, `1 Year` (fill number + unit)
- Custom: integer ≥ 1 + unit select (`Day` / `Week` / `Month` / `Year`)
- Actions: **Save** / **Cancel**
- Cancel on first set → uncheck again
- Cancel when editing existing → keep previous warranty
- Uncheck anytime → clear warranty

### JO edit

- Load saved warranty onto parts; same checkbox/popup on update.

## Receipts (JO + SO)

### Items table

- Add **Warranty** column (built-in + custom template line-items tables)
- Display format: `1 Year`, `7 Days`, `3 Months` (correct pluralization)
- Empty / `—` when no warranty
- JO: only part lines show values; service/labor rows blank
- SO custom-discount rows: blank

### Global terms block

- Default: **hidden** (`showWarrantyPolicy` treated as off unless explicitly enabled)
- Printing Settings toggle remains so the block can be turned back on
- Title text: **PCmazing Warranty Terms & Condition** (was “PCmazing Warranty Policy”)
- Body remains editable in Printing Settings; when shown, use the new title

## Display helpers

Shared formatter (frontend, optionally mirrored backend if needed for exports):

- `1` + `day` → `1 Day`; `7` + `day` → `7 Days`
- Same pattern for week / month / year

## Out of scope

- Warranty on JO services/labor
- Warranty claims / tracking workflow
- Editing warranty on existing Sales Orders (SO remains create-only)
- Changing warranty after receipt reprint history (current value at print time only)
