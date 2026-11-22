# Sales Invoice Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sales Order thermal receipt with an A4 **Sales Invoice**, add invoice fields + SO update/edit, and print a near-exact paper-form match on one A4 page.

**Architecture:** Migration + ensure for invoice columns on `pcmazing_sales_orders` / `pcmazing_sales_order_items`; payment/sales-type helpers with Jest; extend create DTO + add update API (stock-safe line replace); unlock Angular create page for edit; rebuild `sales-order-receipt-page` as hardcoded A4 Sales Invoice (JO Form CSS pattern). Same route `/admin/sales-order/:id/receipt`.

**Tech Stack:** NestJS + PostgreSQL, Angular reactive forms, browser `@media print` A4 layout, Jest for utils.

**Spec:** `docs/superpowers/specs/2026-11-21-sales-invoice-print-design.md`  
**Reference image:** chat assets `image-bb3b6721-7373-4433-948e-500d9eb4869d.jpg` (Sales Invoice scan)  
**Parallel:** JO Form plan `docs/superpowers/plans/2026-11-21-job-order-form-print.md`

## Global Constraints

- **Replace** SO sales receipt layout (do not keep thermal receipt alongside).
- Print is **A4 portrait** (`210×297mm`), near-exact section match, prefer **one page**.
- Invoice intake fields optional (blanks OK on print).
- Terms **hardcoded V1** — copy exact wording from reference image (no Printing settings editor).
- Always **20** table rows on print; **cap items at 20** with UI + API warning/reject.
- Payment: store `withholding_tax` + `amount_paid`; compute Amount Due / Change / Balance (not stored).
- Printed table: no discount/warranty columns; Amount = net after line SC/PWD; Total Sales = effective total (manual wins).
- Letterhead: reuse JO Form fallback constants (1045 Nori St. / +63 939 413 3225 / /PCmazing).
- Route stays `/admin/sales-order/:id/receipt`; button/title say **Sales Invoice**.
- Void/refund rules unchanged; voided orders reject update.
- Commits only when the user explicitly asks.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/sql/migrations/089_sales_invoice_fields.sql` | New header + line columns |
| `backend/src/admin/inventory/sales-invoice.schema.ts` | Runtime ensure |
| `backend/src/admin/inventory/sales-invoice.util.ts` | Normalize sales type + payment summary |
| `backend/src/admin/inventory/sales-invoice.util.spec.ts` | Unit tests |
| `backend/src/admin/inventory/dto/create-sales-order.dto.ts` | Invoice fields on create items/header |
| `backend/src/admin/inventory/dto/update-sales-order.dto.ts` | Update DTO (new) |
| `backend/src/admin/inventory/sales-orders.service.ts` | Persist/read/update + ensure calls |
| `backend/src/admin/inventory/sales-orders.controller.ts` | `PUT :id` update |
| `frontend/.../admin-api.service.ts` | Types + `updateSalesOrder` |
| `frontend/.../sales-invoice.util.ts` | Letterhead reuse, terms, payment helpers, max rows |
| `frontend/.../sales-order-create-page.component.*` | Intake UI, edit mode, 20-cap, Print label |
| `frontend/.../sales-order-receipt-page.component.*` | Rebuild as A4 Sales Invoice |
| `frontend/.../admin.routes.ts` | Title `Sales Invoice` for receipt route |

---

### Task 1: Migration + ensure schema

**Files:**
- Create: `backend/src/sql/migrations/089_sales_invoice_fields.sql`
- Create: `backend/src/admin/inventory/sales-invoice.schema.ts`

**Interfaces:**
- Produces: `ensureSalesInvoiceColumns(databaseService: DatabaseService): Promise<void>`

- [ ] **Step 1: Write migration**

```sql
-- Sales Invoice fields (A4 print replaces SO receipt).

ALTER TABLE pcmazing_sales_orders
  ADD COLUMN IF NOT EXISTS customer_address TEXT,
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS customer_tin VARCHAR(64),
  ADD COLUMN IF NOT EXISTS business_style VARCHAR(255),
  ADD COLUMN IF NOT EXISTS ship_to_address TEXT,
  ADD COLUMN IF NOT EXISTS sales_type VARCHAR(20) NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS customer_po_no VARCHAR(120),
  ADD COLUMN IF NOT EXISTS salesperson VARCHAR(120),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(120),
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(120),
  ADD COLUMN IF NOT EXISTS withholding_tax NUMERIC(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE pcmazing_sales_order_items
  ADD COLUMN IF NOT EXISTS serial_no VARCHAR(120),
  ADD COLUMN IF NOT EXISTS unit VARCHAR(40) NOT NULL DEFAULT 'PCS';
```

- [ ] **Step 2: Ensure helper** — mirror `job-order-intake.schema.ts`: module `invoiceReady` flag → `tableExists` → same `ADD COLUMN IF NOT EXISTS` batch for both tables.

- [ ] **Step 3: Smoke** — Nest start; confirm ensure runs when Task 3 wires it into create/get (no need to call from temporary script if Task 3 follows immediately).

---

### Task 2: Invoice util (TDD)

**Files:**
- Create: `backend/src/admin/inventory/sales-invoice.util.ts`
- Create: `backend/src/admin/inventory/sales-invoice.util.spec.ts`

**Interfaces:**
- Produces:
  - `SalesType = 'cash' | 'charge'`
  - `SO_INVOICE_MAX_ITEMS = 20`
  - `normalizeSalesType(v?: string | null): SalesType` — default `'cash'`; accept `cash`/`charge` case-insensitive; anything else → `'cash'`
  - `normalizeMoney(v?: number | string | null): number` — finite ≥ 0, else 0; round to 2 decimals
  - `computeInvoicePaymentSummary(input: { totalSales: number; withholdingTax: number; amountPaid: number }): { totalSales: number; withholdingTax: number; amountDue: number; amountPaid: number; change: number; balance: number }`
    - `amountDue = max(0, totalSales − withholdingTax)`
    - `change = max(0, amountPaid − amountDue)`
    - `balance = max(0, amountDue − amountPaid)`

- [ ] **Step 1: Write failing tests**

```ts
import {
  normalizeSalesType,
  normalizeMoney,
  computeInvoicePaymentSummary,
  SO_INVOICE_MAX_ITEMS,
} from './sales-invoice.util';

describe('sales-invoice.util', () => {
  it('defaults sales type to cash', () => {
    expect(normalizeSalesType(null)).toBe('cash');
    expect(normalizeSalesType('CHARGE')).toBe('charge');
    expect(normalizeSalesType('weird')).toBe('cash');
  });

  it('computes due/change/balance', () => {
    expect(
      computeInvoicePaymentSummary({
        totalSales: 1000,
        withholdingTax: 100,
        amountPaid: 500,
      }),
    ).toEqual({
      totalSales: 1000,
      withholdingTax: 100,
      amountDue: 900,
      amountPaid: 500,
      change: 0,
      balance: 400,
    });
  });

  it('exposes max items = 20', () => {
    expect(SO_INVOICE_MAX_ITEMS).toBe(20);
  });
});
```

- [ ] **Step 2: Run** `cd backend && npx jest src/admin/inventory/sales-invoice.util.spec.ts --verbose` → expect FAIL.

- [ ] **Step 3: Implement util** until PASS.

- [ ] **Step 4: Re-run tests** → PASS.

---

### Task 3: Backend DTO + create/read + update API

**Files:**
- Modify: `backend/src/admin/inventory/dto/create-sales-order.dto.ts`
- Create: `backend/src/admin/inventory/dto/update-sales-order.dto.ts`
- Modify: `backend/src/admin/inventory/sales-orders.service.ts`
- Modify: `backend/src/admin/inventory/sales-orders.controller.ts`

**Interfaces:**
- Consumes: `ensureSalesInvoiceColumns`, `normalizeSalesType`, `normalizeMoney`, `SO_INVOICE_MAX_ITEMS`
- Produces:
  - Create/Update payload fields (camelCase API):
    - Header: `customerAddress?`, `customerEmail?`, `customerTin?`, `businessStyle?`, `shipToAddress?`, `salesType?`, `customerPoNo?`, `salesperson?`, `paymentMethod?`, `paymentTerms?`, `withholdingTax?`, `amountPaid?`
    - Item: `serialNo?`, `unit?`
  - `SalesOrdersService.update(id: number, dto: UpdateSalesOrderDto, updatedBy?: number): Promise<SalesOrderDetail>`
  - Controller: `@Put(':id') update(...)`
  - Detail/list mapping includes new fields; `loadItems` selects `serial_no`, `unit`

**Update rules (stock-safe):**
1. Call `ensureSalesInvoiceColumns`.
2. Load existing order; if missing → NotFound; if `is_void` → BadRequest.
3. If `dto.items.length > SO_INVOICE_MAX_ITEMS` → BadRequest (`Maximum 20 line items`).
4. Same for create.
5. If any existing item has `refunded_quantity > 0` **and** the incoming items payload differs from current material/qty structure → BadRequest (`Cannot change line items after a partial refund`). Header-only invoice fields may still update when items omitted — for V1 require full items array like create and **block update entirely** when any refunded_quantity > 0 (simpler). Prefer: **if any refunded_quantity > 0, reject update** with clear message (staff use refund/void flows).
6. Else in transaction: restore stock for each current material line (`quantity − refunded_quantity`), soft-delete items (`deleted_at = now()`), update header columns + recalculated totals, insert new items, deduct stock (reuse create stock checks).
7. Custom lines: `unit` default `'PCS'`; material lines: use dto.unit or material.unit or `'PCS'`.

- [ ] **Step 1: Extend `CreateSalesOrderItemDto` / `CreateSalesOrderDto`** with optional invoice fields + validators (`@IsIn(['cash','charge'])` for salesType; `@MaxLength` as needed; `@Min(0)` for money).

- [ ] **Step 2: Create `UpdateSalesOrderDto`** — same shape as create (all fields class-validator optional except `customerName` + `items` required like create).

- [ ] **Step 3: Wire service create INSERT/SELECT/map** for new columns; reject `items.length > 20`.

- [ ] **Step 4: Implement `update`** per rules above; call ensure on list/create/get/update.

- [ ] **Step 5: Controller**

```ts
@Put(':id')
update(
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: UpdateSalesOrderDto,
  @CurrentUser() user: AdminUser,
) {
  return this.salesOrdersService.update(id, dto, user?.id);
}
```

(Match existing `@CurrentUser` / createdBy pattern in this controller.)

- [ ] **Step 6: Manual API smoke** — create with invoice fields → get shows them; put update changes shipTo/amountPaid; 21 items → 400.

---

### Task 4: Frontend types + invoice util

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`
- Create: `frontend/src/app/admin/pages/inventory/sales-invoice.util.ts`
- Create: `frontend/src/app/admin/pages/inventory/sales-invoice.util.spec.ts` (if frontend Jest configured for page utils; otherwise skip FE spec and rely on backend util + manual UI — **prefer** colocated FE helper without test if no FE jest for pages; backend already covers math)

**Interfaces:**
- Produces FE:
  - `SO_INVOICE_MAX_ITEMS = 20`
  - `SALES_INVOICE_TERMS: string[]` — 7 strings copied from reference image during implementation
  - `SALES_INVOICE_LETTERHEAD` — re-export or duplicate `JO_FORM_LETTERHEAD_FALLBACK` values (import from `job-order-intake.util` to DRY)
  - `computeInvoicePaymentSummary(...)` — same formula as backend (copy logic; keep in sync)
  - `padInvoiceRows<T>(items: T[], size = 20): Array<T | null>`
- Admin API:
  - Extend `CreateSalesOrderPayload` / detail types with invoice fields
  - `updateSalesOrder(id: number, payload: CreateSalesOrderPayload): Observable<...>` → `PUT /admin/inventory/sales-orders/:id`

- [ ] **Step 1: Extend types + `updateSalesOrder` method.**

- [ ] **Step 2: Add `sales-invoice.util.ts`** with max items, letterhead import, payment helper, `padInvoiceRows`, terms array (exact copy from image).

---

### Task 5: Create/edit UI

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html`

**Behavior:**
- Rename mental model: `isViewMode` → still true when `orderId` set, but **form stays enabled** unless voided (or `isVoid`). Remove `this.form.disable()` in `populateFromOrder` (or re-enable after populate). Show Save / add-item controls when not void.
- On existing order: **Save** calls `updateSalesOrder`; on new: `createSalesOrder`.
- Default `salesperson` from session display name on new orders.
- Default `salesType` = `cash`; `unit` = material unit or `PCS`.
- New form controls for all invoice header fields; line controls `serialNo`, `unit`.
- Payment preview using `computeInvoicePaymentSummary` + effective total (manual total wins — same as existing total display).
- Cap items: before push, if `items.length >= 20`, `AdminAlertService` warn and return.
- Button: **Print Sales Invoice** → `/admin/sales-order/:id/receipt` (unchanged path).
- Title/copy: “Edit Sales Order” when `orderId` set.

- [ ] **Step 1: Form controls + template intake section** (Sold To / Ship To / Other Details / Payment).

- [ ] **Step 2: Unlock edit + update submit path.**

- [ ] **Step 3: Line Serial/Unit + 20-cap alert.**

- [ ] **Step 4: Manual UI smoke** — create → reopen → edit TIN/ship-to/serial → save → get reflects.

---

### Task 6: A4 Sales Invoice print page

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.html`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.css`
- Modify: `frontend/src/app/admin/admin.routes.ts` (title: `Sales Invoice`)

**Behavior:**
- Remove thermal receipt layout, template picker, barcode, thanks, discount/warranty columns, promotion line.
- Build A4 layout mirroring JO Form page structure / invoice reference:
  1. Letterhead (`SALES_INVOICE_LETTERHEAD` + logo)
  2. Blue **SALES INVOICE** bar
  3. Meta: Invoice No., Date, Time, Cash/Charge marks from `salesType`
  4. Ship To / Other Details / Sold To
  5. Table 20 rows via `padInvoiceRows` (first 20 items only)
  6. Remarks + Payment Summary (`computeInvoicePaymentSummary` with effective total)
  7. Three signature blocks; Cashier printed name = `salesperson` or session name
  8. Terms + red/gray notice banners
- Keep VOID / REPRINTED banners when applicable.
- `@page { size: A4 portrait; margin: 8mm; }` + compact CSS; screen preview + Print button (`?print=1` auto-print OK).
- Line Amount = `applyPhSpecialDiscount(qty * unitPrice, discountType).net` (existing helper).
- Description = material description or name / customItemName; Code = materialCode.

- [ ] **Step 1: Replace HTML structure** with invoice sections (no leftover receipt chrome).

- [ ] **Step 2: Rewrite CSS** for A4 single-page (use JO form page CSS as density reference).

- [ ] **Step 3: Wire TS** computed rows, payment summary, sales type checks, letterhead.

- [ ] **Step 4: Update route title** to Sales Invoice.

- [ ] **Step 5: Print preview smoke** — Chrome print preview one page; empty fields blank; 3 items → 17 empty rows; Cash vs Charge; CWT/paid math; manual total → Total Sales.

---

### Task 7: End-to-end verification

**Files:** none (checklist)

- [ ] Create SO with full invoice fields + 2 lines (serial/unit) → Print Sales Invoice shows all.
- [ ] Create with empty optionals → blanks for handwriting.
- [ ] Edit after create → reprint reflects changes.
- [ ] Try 21st line → alert; API rejects if forced.
- [ ] Always 20 rows visually.
- [ ] Payment: Total Sales 1000, CWT 100, Paid 500 → Due 900, Change 0, Balance 400.
- [ ] Manual total overrides Total Sales on invoice.
- [ ] Voided order shows VOID; update blocked.
- [ ] Old thermal receipt chrome gone.
- [ ] JO Form + JO receipt still unchanged.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Migration + ensure header/line fields | 1 |
| Payment/sales-type helpers | 2 |
| Create persist + update API + 20-cap server | 3 |
| FE types/util/terms/letterhead | 4 |
| Intake UI + edit unlock + 20-cap UI | 5 |
| Replace receipt with A4 invoice | 6 |
| E2E checklist | 7 |
| Terms exact from image | 4 + 6 |
| Void/REPRINTED banners | 6 |
| Manual total in Total Sales | 5 + 6 |
| Stock-safe update / refund block | 3 |

---

## Execution handoff

Plan complete. Choose execution:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session, executing-plans with checkpoints  
