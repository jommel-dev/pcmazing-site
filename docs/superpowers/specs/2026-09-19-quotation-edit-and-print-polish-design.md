# Quotation Edit + Print Polish

**Date:** 2026-09-19  
**Status:** Approved design — pending implementation  
**Approach:** Extend existing draft update path for any status

## Goal

Allow staff to edit any quotation (draft or finalized) in place, keep optional form fields truly optional, polish the quotation print layout (columns, page number, validity note), and simplify line entry to a single **Add item** flow that also covers custom descriptions.

## Scope

### In scope

1. **Edit any status** — reuse create/edit form and `PATCH /admin/quotations/:id`; drop draft-only guards.
2. **Save choice on edit** — same as create: Save as draft or Finalize; quote number unchanged; overwrite header + line items.
3. **Discoverability** — Edit action on list and detail for all editable quotes (label: “Edit”).
4. **Optional fields** — Email, phone, address, remarks not required; blank email must not fail validation; save succeeds when those are empty.
5. **Print layout**
   - Rename column header **Item** → **Item Description**
   - Remove **Description** column (built-in layout and custom template table rendering on the quotation print page)
   - Never show **Page 1** / page numbering on quotation printouts
   - Bottom-left validity note from `validityDays`
6. **Unified Add item** — remove **Add custom item**; a single **Add item** row accepts inventory picks, web-store picks, and free-text custom descriptions.

### Out of scope

- Revision history / cloning finalized quotes into a new quote number
- Changing printing settings globally for other document types
- New quotation statuses beyond draft / finalized
- Separate edit UI or new REST resource shape
- Keeping a second button or a separate custom-only row mode

## Architecture

```
List / Detail ──Edit──► QuotationCreatePage (/quotations/:id/edit)
                              │
                              ▼
                     PATCH /admin/quotations/:id
                              │
                              ▼
                     QuotationService.update (any status)
                              │
                              ▼
                     Overwrite header + replace line items
                     (quote_no preserved)

Print page ──► built-in sheet + optional custom template table
               (Item Description only; no page #; validity note)
```

### Components

| Unit | Responsibility |
|------|----------------|
| `QuotationService.updateDraft` → rename or relax to update any owned quote | Allow PATCH for draft and finalized; keep quote_no; replace items |
| `QuotationController` `PATCH :id` | Unchanged contract; success message reflects resulting status |
| `QuotationCreatePageComponent` | Load any status into form; remove redirect away from finalized; keep draft/finalize buttons; unify item rows under Add item |
| `QuotationsPageComponent` / `QuotationDetailPageComponent` | Show Edit for all quotes (not draft-only) |
| `QuotationPrintPageComponent` (+ HTML) | Column rename/removal, hide page numbers, render validity note |
| Create DTO / form validators | Ensure optional header fields accept empty values |

## Edit behavior

### Load

- Route: `/admin/quotations/:id/edit` (already exists).
- Load quotation by id; populate form for **draft or finalized**.
- Do **not** redirect finalized quotes to the detail page.
- Missing / deleted → existing error handling.

### Save

- Payload same as create (`CreateQuotationDto` + `status: 'draft' | 'finalized'`).
- Backend updates header fields and soft-deletes/reinserts (or equivalent existing) line items.
- **Preserve** `quote_no` and `id`.
- Recalculate subtotal, discount total, total, `expires_at` from quote date + `validityDays`.
- Response messages:
  - Finalized → “Quotation finalized.” (or “Quotation updated.” if already finalized and staying finalized — either is fine; prefer status-based: finalized vs draft messages already used).

### UI entry points

- List row: **Edit** link beside View (all statuses).
- Detail: **Edit** button (replace “Edit draft” / draft-only `canEdit()`).

## Unified line items (Add item)

### Goal

One button (**Add item**) and one row UX for inventory, web, and custom lines so staff do not choose “custom vs material” up front.

### Behavior

- Remove the **Add custom item** button and `addCustomItem()` entry path from the UI.
- **Add item** always inserts the searchable item row (today’s material/search row).
- Item field stays a typeahead that can:
  1. Select an **inventory** material (sets `materialId` + description/price).
  2. Select a **web store** hit (custom line: title as description, price from hit, no `materialId`).
  3. Enter a **custom description** without picking a suggestion — treat typed text as the line description (custom line, no `materialId`).
- Dropdown includes an explicit action when the query is non-empty, e.g. **Use “{query}” as custom item**, so custom entry is obvious even when inventory/web results exist.
- Existing custom lines loaded in edit mode use the same row: description shown in the item field; user can re-search or edit the text.
- Helper copy under Quoted items: mention that typing a description without selecting inventory/web creates a custom line (labor/services).
- Save rules unchanged: a row is valid if it has a selected material **or** a non-empty description, plus qty/price.

### Non-goals

- Do not require a separate “custom mode” toggle.
- Do not change API item shape beyond what create already supports (`materialId` optional + `description`).

## Optional fields

Labeled optional today: Email, Phone, Address, Remarks.

Rules:

- Frontend: no `Validators.required` on those controls; empty string allowed.
- Email: blank string treated as unset before `Validators.email` (or equivalent) so empty does not block submit.
- Backend: already `@IsOptional` for those fields; ensure empty string is normalized to `null`/undefined (especially email) so class-validator does not reject `""`.
- Required remain: customer name, validity days (1–365), ≥1 valid line item (material selected or custom description + qty/price).

## Print layout

### Line items table

Columns (left → right):

1. **Item Description** (was Item) — product/custom name currently shown in `line.itemName`
2. Qty
3. Price
4. Discount
5. Amount

Remove the separate **Description** column and its cells. Apply to:

- Built-in quotation print sheet
- Custom printing-template `table` case on the quotation print page

Do not change the printing template canvas editor in this work unless the print page alone is insufficient for saved templates that still expect two text columns — print rendering is the source of truth for quotation printouts.

### Page numbering

- Do not render “Page 1” (or any page number) on quotation printouts.
- Ignore `printingSettings.showPageNumbers` for this page (quotation-specific hide).
- Clear/omit `pageNumber` in custom-template field values when used for quotations.

### Validity note

Place at bottom left of the built-in sheet (near discounts/remarks area, left column), after totals block layout allows:

```text
Note: *This quotation is valid for {duration}.
```

`{duration}` derived from `validityDays` (integer days on the quotation):

| Preference order | Rule | Example |
|------------------|------|---------|
| Months | Whole months of 30 days, remainder handled below | 30 → `1 month`; 60 → `2 months` |
| Weeks | Whole weeks of 7 days from remainder (or full days if no months) | 14 → `2 weeks`; 45 → `1 month and 15 days` |
| Days | Remaining days, or full value when &lt; 7 | 7 → `7 days`; 3 → `3 days` |

Formatting rules:

- Use singular/plural: `1 month` / `N months`, `1 week` / `N weeks`, `1 day` / `N days`.
- Prefer weeks only when the value is an exact multiple of 7 and &lt; 30 (e.g. 7 → `7 days` is acceptable; 14 → `2 weeks`; 21 → `3 weeks`). **Explicit choice:** 7 days → `7 days` (not “1 week”) to match common quote language; 14/21 → weeks; ≥30 use months + leftover days (leftover ≥7 may be expressed as weeks only if exact, else days).
- Simpler locked algorithm for implementers:
  1. `months = floor(days / 30)`, `rem = days % 30`
  2. If `months > 0` and `rem === 0` → `"{months} month(s)"`
  3. If `months > 0` and `rem > 0` → `"{months} month(s) and {rem} day(s)"`
  4. Else if `days % 7 === 0` and `days >= 14` → `"{days/7} week(s)"`
  5. Else → `"{days} day(s)"`

If `validityDays` missing, fall back to computed span from quote date → expires at, or omit the note if neither is available.

Custom templates: no new required canvas element in this change; note is built-in layout only unless a field key already exists — do not block on template editor work.

## Testing / verification

1. Edit a draft → save as draft and finalize; quote no unchanged.
2. Edit a finalized quote → save as draft (status becomes draft) and finalize again; totals/items update.
3. Save with empty email/phone/address/remarks succeeds.
4. Print: single Item Description column; no Page 1; validity note matches form days.
5. List and detail show Edit for finalized quotes.
6. Only **Add item** is visible; custom labor/service lines work via typed text or “Use as custom item” without **Add custom item**.

## Risks

- Overwriting finalized quotes has no revision history (accepted).
- Soft-deleted line items accumulate on repeated edits (existing pattern; acceptable).
- Custom print templates that sized for two text columns may look sparse; operators can adjust templates later.
- Users who relied on the dedicated custom textarea may need one discovery moment for “Use as custom item” / free-text commit (mitigated by helper copy + dropdown action).
