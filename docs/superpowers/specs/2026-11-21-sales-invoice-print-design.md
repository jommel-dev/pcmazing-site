# Sales Invoice print (A4 — replace Sales Order receipt)

**Status:** Approved  
**Date:** 2026-11-21  
**Area:** Sales Order create/edit + replace receipt print with A4 Sales Invoice  
**Reference:** Attached PCmazing Sales Invoice (paper layout)

## Problem

Sales Order printing today is a **sales receipt** (thermal-style line items + totals). Staff need the official **Sales Invoice** on **A4**, matching the existing paper form, with invoice fields captured on SO create/edit.

## Goals

- **Replace** the current SO sales receipt print with an A4 **Sales Invoice** near-exact match to the attached form, fitted on **one A4 page** (`210×297mm`).
- Add invoice fields to SO create/edit so the print fills from the system.
- Allow **edit after create** (JO-style) so invoice details can be completed or corrected later.
- Keep print entry on the existing SO print path (`/admin/sales-order/:id/receipt`); UI label may say **Print Sales Invoice**.

## Non-goals (V1)

- Keeping a separate thermal/sales-receipt layout alongside the invoice.
- Editable Terms & Conditions in Printing settings (hardcoded V1; editable later).
- Modeling this form in the Printing Generator drag-drop canvas.
- Discount / warranty columns on the printed invoice table (discounts still affect totals; warranty stays in SO UI only).
- Changing Job Order form or receipt prints.
- Forcing auto-print on create.

## Locked decisions

| Topic | Decision |
| --- | --- |
| Relationship to receipt | **Replace** receipt with Sales Invoice (**B**) |
| Data | Add invoice fields to SO create/edit |
| Visual fidelity | Near-exact match to attached form |
| Paper | **A4** portrait |
| Terms text | Hardcoded V1; editable later (**C**) |
| Table rows | Always **20** rows; pad empty (**A**) |
| >20 items | Cap at 20 + UI warning (**A**) |
| Payment summary | Editable CWT + Amount Paid; Change/Balance computed (**A**) |
| Sales Type | `cash` \| `charge`, default Cash (**A**) |
| Ship To | Optional address field (**A**) |
| Line Serial / Unit | Per-line Serial/IMEI optional; Unit from material or `PCS` (**A**) |
| Post-create edit | Full SO edit unlocked (**B**) |
| Printed table | Paper columns only — no discount/warranty columns (**A**) |
| Architecture | Rebuild receipt route in place as A4 invoice (Approach 1) |

## Existing fields to reuse

| Invoice area | Existing SO source |
| --- | --- |
| Invoice No. | `referenceNo` |
| Date / Time | `saleDate` |
| Sold To name | `customerName` |
| Contact No. | `customerPhone` |
| Remarks / Notes | `notes` |
| Item Code / SKU | Joined `materialCode` (blank for custom lines) |
| Description | Material name/description or `customItemName` |
| Qty / Unit Price | `quantity`, `unitPrice` |
| Amount (print) | **Net line amount** after that line’s SC/PWD discount (same contribution used in SO totals). Header custom discount / promotion / manual total affect **Total Sales** only — they do not rewrite individual Amount cells. |
| Total Sales | Effective order total (`manualTotalAmount` wins when set; else `totalAmount`) |
| Promotion / SC-PWD / custom discount / warranty | Remain in SO UI and total math; **not** shown as print table columns |

## New fields (migration + ensure)

### Header — `pcmazing_sales_orders`

| Field | Type | Notes |
| --- | --- | --- |
| `customer_address` | text null | Sold To address |
| `customer_email` | text null | Sold To email |
| `customer_tin` | text null | TIN |
| `business_style` | text null | Business Style |
| `ship_to_address` | text null | Ship To / delivery address |
| `sales_type` | text/enum | `cash` \| `charge`, default `cash` |
| `customer_po_no` | text null | Customer PO / Reference No. |
| `salesperson` | text null | Default logged-in user display name on create |
| `payment_method` | text null | e.g. Cash / GCash / Bank Transfer / Charge / Other |
| `payment_terms` | text null | e.g. COD, Net 30 |
| `withholding_tax` | numeric | CWT amount, default 0 |
| `amount_paid` | numeric | default 0 |

**Computed on print / UI (not stored):**

- Total Amount Due = Total Sales − CWT  
- Change = max(0, Amount Paid − Amount Due)  
- Balance = max(0, Amount Due − Amount Paid)

### Lines — `pcmazing_sales_order_items`

| Field | Type | Notes |
| --- | --- | --- |
| `serial_no` | text null | Serial No. / IMEI |
| `unit` | text | Default from `tblmaterials.unit` when material selected; else `PCS` |

## Create / edit UI

- Unlock SO after create for full edit (header + lines + invoice fields), subject to existing void/refund constraints. Backend: add/extend an **update** API (create-only today) that persists header invoice fields and replaces/updates line items including `serial_no` / `unit`.
- Add an **Invoice / Sold To** intake section:
  1. Sold To: Name (required), TIN, Business Style, Address, Contact, Email  
  2. Ship To: optional delivery address  
  3. Other Details: Sales Type (Cash / Charge), Customer PO No., Salesperson, Payment Method, Terms  
  4. Payment: CWT, Amount Paid + live preview of Amount Due / Change / Balance  
- Line grid: add Serial/IMEI and Unit columns.
- Max **20** line items: block adding beyond 20 with admin alert; if legacy data somehow exceeds 20, print/save path uses first 20 and warns.
- Persist invoice fields on create and update APIs. Empty optional fields allowed (print shows blanks for handwriting).
- Print action: navigate to `/admin/sales-order/:id/receipt` (optionally `?print=1`); button label **Print Sales Invoice**.

## Print page

- Route: `/admin/sales-order/:id/receipt` (rebuild; remove old sales-receipt layout)
- Preview on screen; **Print** uses browser print with `@page { size: A4 portrait; margin: ~8mm }`
- Single sheet layout matching paper order:
  1. Letterhead (logo + slogan + services line + address / phone / Facebook)  
  2. Blue **SALES INVOICE** title  
  3. Meta pill: Invoice No., Date, Time, Sales Type Cash/Charge marks  
  4. Ship To · Other Details · Sold To  
  5. **20-row** items table: #, Item Code/SKU, Description, Serial/IMEI, Qty, Unit, Unit Price (₱), Amount (₱)  
  6. Remarks + Payment Summary  
  7. Signatures: Customer/Buyer · Cashier · Authorized Representative (PCMAZING) — blank signature lines; printed name under Cashier when salesperson/session name available  
  8. Terms & Conditions (7 hardcoded clauses) + red **STRICTLY NO RECEIPT, NO WARRANTY** + gray **THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX.**
- Always render 20 table rows (pad empty). Cap display at first 20 items.
- Void / REPRINTED banners remain when applicable.
- Out of print: discount/warranty columns, promotion line, barcode, Printing Generator template picker, thanks footer.
- Manual total: Payment Summary **Total Sales** uses effective total (manual wins); line Unit Price/Amount still print from line data when present.

### Letterhead (print)

Hardcoded fallback matching the invoice / JO Form letterhead (`1045 Nori St. Mabini Ext., Cabanatuan City`, `+63 939 413 3225`, `/PCmazing`, services line). Do not rely on Printing settings for this V1 form (same practical approach as JO Form letterhead).

### Terms text (V1 hardcoded)

Match the attached form’s seven numbered Terms & Conditions plus the two notice banners. Exact wording to be copied from the reference image during implementation (no paraphrase). Editable via settings is out of V1.

## Phasing (implementation plan)

1. **Phase 1 — Data:** migration/ensure, DTO/API map for header + line invoice fields; unlock SO update  
2. **Phase 2 — Create/edit UI:** intake section, line Serial/Unit, payment preview, 20-item cap warning, edit-after-create  
3. **Phase 3 — Print:** rebuild receipt page as A4 Sales Invoice, button label, print CSS polish to one page  

## Testing

- Create SO with full invoice fields → print shows checks/text correctly  
- Create SO with empty optional fields → print still shows blanks for handwriting  
- Edit SO after create → invoice fields and lines update on reprint  
- >20 add attempt → admin alert; print never exceeds 20 rows  
- Always 20 table rows visually (empty padding)  
- Payment math: Amount Due / Change / Balance correct for CWT + Amount Paid  
- Manual total: Total Sales on invoice uses manual amount  
- Cash vs Charge marks correctly  
- Void / REPRINTED still visible when applicable  
- Old thermal receipt layout no longer appears  
- Chrome print preview fits one A4 without cutting critical sections  

## Risks

| Risk | Mitigation |
| --- | --- |
| Dense invoice overflows A4 | Compact print CSS; tighten padding/type like JO Form |
| Existing SOs lack new fields | Null-safe print; blanks for handwriting |
| Users still expect “receipt” wording | Rename button/title to Sales Invoice; same URL |
| Line discounts vs paper Amount column | Print net line amount after SC/PWD; Total Sales carries header discounts / manual total |
| Unlocking edit changes stock/audit expectations | Keep void/refund rules; inventory adjustments on line changes follow existing SO create semantics or documented update rules |
| Amount column sum ≠ Total Sales | Expected when header custom discount / promotion / manual total applies; Payment Summary is source of truth for due |

## Related

- Current SO receipt: `sales-order-receipt-page`  
- SO create UI: `sales-order-create-page` (extend to edit)  
- JO Form parallel: `inventory-service-form-page`, spec `2026-11-21-job-order-form-print-design.md`  
- Reference image: Sales Invoice attachment in chat assets  
