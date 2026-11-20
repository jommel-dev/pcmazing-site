# Job Order Form print (A4 intake / service agreement)

**Status:** Implemented  
**Date:** 2026-11-21  
**Area:** Job Order create/edit + new A4 print page  
**Reference:** Attached PCmazing Job Order Form (paper layout)

## Problem

JO printing today is a **sales receipt** (line items + totals). Staff also need the official **Job Order Form** intake/agreement sheet on **A4**, matching the existing paper form.

## Goals

- Keep the current JO **sales receipt** print unchanged.
- Add a second print: **Job Order Form**, near-exact visual match to the attached form, fitted on **one A4 page** (`210×297mm`).
- Capture the form’s intake fields on JO create/edit so the print fills from the system.
- Print from JO create/edit/view via **Print Job Order Form** (after save).

## Non-goals (V1)

- Replacing or redesigning the sales receipt.
- Editable agreement text in Printing settings (hardcoded V1; editable later).
- Modeling this form in the Printing Generator drag-drop canvas.
- Changing Sales Order print.
- Forcing auto-print on create.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Relationship to receipt | **Add** form print; keep receipt |
| Data | Add intake fields to JO create/edit (**B**) |
| Visual fidelity | Near-exact match to attached form (**A**) |
| Paper | **A4** portrait |
| Print entry | Button on JO create/edit/view after save (**A**) |
| Agreement text | Hardcoded V1; editable later (**C**) |
| Architecture | Dedicated print page + JO fields (Approach 1) |

## Existing fields to reuse

| Form area | Existing JO source |
| --- | --- |
| Job Order No. | JO id / reference |
| Date | Created / job date |
| Customer name, address, contact, email | Existing customer fields |
| Brand, model, serial | `deviceBrand`, `deviceModel`, `deviceSerial` |
| Estimated cost / down payment / balance | Totals + `downpayment` (remaining = total − downpayment; respect manual total when set) |
| Assigned technician | Person in charge |
| Internal status / dates | Existing status, started/ended (map to Pending / In Progress / For Release / Completed as best-effort) |

## New fields (migration + ensure)

Add to `pcmazing_services` (names illustrative; implement with clear snake_case columns):

| Field | Type | Notes |
| --- | --- | --- |
| `service_arrangement` | text/enum | `in_store` \| `onsite_home` \| `onsite_office` |
| `device_type` | text/enum | `laptop` \| `desktop` \| `printer` \| `iphone` \| `android` \| `others` |
| `device_type_other` | text null | When type = others |
| `device_cpu` | text null | Processor |
| `device_ram` | text null | Memory |
| `device_storage` | text null | Storage |
| `device_display` | text null | Display |
| `included_accessories` | jsonb | Array of accessory keys from fixed checklist |
| `included_accessories_other` | text null | |
| `unit_condition` | text/enum | `good` \| `minor` \| `defective` \| `others` |
| `unit_condition_other` | text null | |
| `customer_reported_issue` | text null | |
| `technician_diagnosis` | text null | |
| `service_requested` | text null | May default from service line names; editable |
| `expected_completion` | text null | Free text or date string as entered |
| `consent_software_install` | boolean | Default false |
| `consent_data_backup_ack` | boolean | Default false |
| `released_by` | text null | Internal footer |

### Accessory checklist keys (fixed)

`laptop_unit`, `desktop_pc`, `printers`, `iphone`, `android`, `charger`, `battery`, `memory_ram`, `storage`, `mouse`, `keyboard`, `bag_case`, `optical_drive`, `cables`, `others`

## JO create/edit UI

Add an **Intake / Job Order Form** section (or grouped panels) with:

1. Service arrangement (radio/check one)
2. Device type + specs (CPU/RAM/storage/display) alongside existing brand/model/serial
3. Included accessories (multi-checkbox)
4. Unit condition
5. Customer’s reported issue / Technician’s diagnosis
6. Service requested (prefill from services when empty)
7. Expected completion
8. Two consent checkboxes matching the form wording
9. Optional Released by (internal)

Persist with create/update JO APIs. Do not block create if intake fields are empty (print can show blanks).

**Actions:** After save / on existing JO: **Print Job Order Form** → navigate to form print page (optionally `?print=1`).

## Print page

- Route: `/admin/job-order/:id/form`
- Preview on screen; **Print** uses browser print with `@page { size: A4; margin: … }`
- Single sheet layout: header (logo + contact), blue **JOB ORDER FORM** title, then sections in the same order as the paper form:
  1. Service Arrangement  
  2. Customer Information \| Included Items / Accessories  
  3. Device Information \| Unit Condition  
  4. Customer’s Reported Issue \| Technician’s Diagnosis  
  5. Service Requested \| Estimated Cost / Down Payment / Remaining / Expected Completion / Assigned Technician  
  6. Repair / Service Agreement (hardcoded 9 terms + 2 consents)  
  7. Signature blocks (blank lines for wet signature)  
  8. Internal use footer (technician, status checks, dates, released by)
- Checked boxes / filled underlines from JO data; empty = blank for handwriting
- Fit content on **one A4 page** with compact print CSS (tighten spacing if needed; prefer one page over overflow)

### Header contact (print)

Use store/printing settings where available; otherwise fall back to the form’s known PCmazing letterhead content (address / phone / services line / Facebook).

### Agreement text (V1 hardcoded)

Match the attached form’s nine terms (Scope of Service through Customer Authorization) and the two consent lines. Exact wording to be copied from the reference image during implementation (no paraphrase).

## Phasing (implementation plan)

1. **Phase 1 — Data:** migration/ensure, DTO/API map, create/edit UI for intake fields  
2. **Phase 2 — Print:** A4 form page, route, Print button, print CSS polish to one page  

## Testing

- Create JO with full intake → form print shows checks/text correctly  
- Create JO with empty intake → form still prints with blanks  
- Sales receipt print still works unchanged  
- Print preview fits A4 without cutting critical sections (spot-check Chrome print preview)  
- Consents unchecked vs checked render correctly  
- Manual total / downpayment: remaining balance on form uses effective total  

## Risks

| Risk | Mitigation |
| --- | --- |
| Dense form overflows A4 | Compact print CSS; reduce padding; optional slightly smaller type |
| Status mapping imperfect | Best-effort checkbox map; staff can still hand-check |
| Letterhead drift vs brand kit | Prefer printing/store settings; hardcode only as fallback |

## Related

- Existing JO receipt: `inventory-service-receipt-page`
- Printing settings / letterhead defaults: Printing Generator content settings
