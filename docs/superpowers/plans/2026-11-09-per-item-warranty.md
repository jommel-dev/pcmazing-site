# Per-Item Warranty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff attach an optional day/week/month/year warranty to Sales Order line items and Job Order parts, show it in a receipt Warranty column, and hide the old global warranty block by default (renamed Terms & Condition).

**Architecture:** Store nullable `warranty_value` + `warranty_unit` on `pcmazing_sales_order_items` and `pcmazing_service_parts`. Shared normalize/format helpers; create/edit checkbox opens a preset+custom popup; receipts add a Warranty column; `showWarrantyPolicy === true` only shows the global block.

**Tech Stack:** NestJS + PostgreSQL (migration 086 + ensure helper), Angular reactive forms + modal overlay, Jest for backend util tests.

**Spec:** `docs/superpowers/specs/2026-11-09-per-item-warranty-design.md`

## Global Constraints

- Warranty applies only to SO items and JO **parts** (never JO service/labor receipt rows).
- Units: exactly `day` | `week` | `month` | `year`.
- Both columns null, or both set with `warranty_value >= 1`.
- Receipt label examples: `1 Year`, `7 Days`.
- Global block title: `PCmazing Warranty Terms & Condition`.
- Global block shows only when `showWarrantyPolicy === true` (default off).

## File map

| File | Role |
| --- | --- |
| `backend/src/sql/migrations/086_item_warranty.sql` | Add warranty columns |
| `backend/src/admin/inventory/item-warranty.schema.ts` | Ensure columns exist at runtime |
| `backend/src/admin/inventory/item-warranty.util.ts` | Normalize + format warranty |
| `backend/src/admin/inventory/item-warranty.util.spec.ts` | Jest unit tests |
| `backend/src/admin/inventory/dto/create-sales-order.dto.ts` | Item warranty fields |
| `backend/src/admin/inventory/dto/create-service.dto.ts` | Part warranty fields |
| `backend/src/admin/inventory/sales-orders.service.ts` | Persist/read SO item warranty |
| `backend/src/admin/inventory/inventory-services.service.ts` | Persist/read JO part warranty |
| `frontend/src/app/admin/pages/inventory/item-warranty.util.ts` | Frontend format/normalize + presets |
| `frontend/src/app/admin/services/admin-api.service.ts` | Types + payloads |
| `frontend/.../sales-order-create-page.component.*` | Checkbox + popup on SO lines |
| `frontend/.../inventory-service-create-page.component.*` | Checkbox + popup on JO parts |
| `frontend/.../sales-order-receipt-page.component.*` | Warranty column + hide/rename terms |
| `frontend/.../inventory-service-receipt-page.component.*` | Warranty column + hide/rename terms |
| `frontend/.../printing-receipt-content.defaults.ts` | Rename default title |
| `frontend/.../printing-generator-page.component.ts` | Default `showWarrantyPolicy` false |
| `frontend/.../printing-fields.data.ts` | Sample text update |

---

### Task 1: Migration + ensure schema

**Files:**
- Create: `backend/src/sql/migrations/086_item_warranty.sql`
- Create: `backend/src/admin/inventory/item-warranty.schema.ts`
- Modify: call sites in `sales-orders.service.ts` and `inventory-services.service.ts` (ensure on create/get; full wire-up of columns is Task 3–4)

**Interfaces:**
- Produces: `ensureSalesOrderItemWarrantyColumns(db)`, `ensureJobOrderPartWarrantyColumns(db)`

- [ ] **Step 1: Create migration**

```sql
-- Optional per-line warranty on sales order items and job order parts.

ALTER TABLE pcmazing_sales_order_items
  ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);

ALTER TABLE pcmazing_service_parts
  ADD COLUMN IF NOT EXISTS warranty_value INTEGER,
  ADD COLUMN IF NOT EXISTS warranty_unit VARCHAR(10);
```

- [ ] **Step 2: Create ensure helper** (mirror `order-promotion.schema.ts` pattern with two ready flags and `ADD COLUMN IF NOT EXISTS` for both tables).

- [ ] **Step 3: Commit**

```bash
git add backend/src/sql/migrations/086_item_warranty.sql backend/src/admin/inventory/item-warranty.schema.ts
git commit -m "chore: add item warranty columns migration and ensure helper"
```

---

### Task 2: Backend warranty util (TDD)

**Files:**
- Create: `backend/src/admin/inventory/item-warranty.util.ts`
- Create: `backend/src/admin/inventory/item-warranty.util.spec.ts`

**Interfaces:**
- Produces:
  - `export type WarrantyUnit = 'day' | 'week' | 'month' | 'year'`
  - `export type NormalizedWarranty = { warrantyValue: number; warrantyUnit: WarrantyUnit } | null`
  - `normalizeWarranty(value?: number | null, unit?: string | null): NormalizedWarranty` — throws `BadRequestException` on partial/invalid
  - `formatWarrantyLabel(value?: number | null, unit?: string | null): string` — `''` if incomplete; else `1 Year` / `7 Days`

- [ ] **Step 1: Write failing tests**

```typescript
import { BadRequestException } from '@nestjs/common';
import { formatWarrantyLabel, normalizeWarranty } from './item-warranty.util';

describe('normalizeWarranty', () => {
  it('returns null when both empty', () => {
    expect(normalizeWarranty(null, null)).toBeNull();
    expect(normalizeWarranty(undefined, undefined)).toBeNull();
  });

  it('accepts value + unit', () => {
    expect(normalizeWarranty(1, 'year')).toEqual({ warrantyValue: 1, warrantyUnit: 'year' });
  });

  it('rejects partial or invalid', () => {
    expect(() => normalizeWarranty(1, null)).toThrow(BadRequestException);
    expect(() => normalizeWarranty(null, 'day')).toThrow(BadRequestException);
    expect(() => normalizeWarranty(0, 'day')).toThrow(BadRequestException);
    expect(() => normalizeWarranty(1, 'hour')).toThrow(BadRequestException);
  });
});

describe('formatWarrantyLabel', () => {
  it('formats singular and plural', () => {
    expect(formatWarrantyLabel(1, 'year')).toBe('1 Year');
    expect(formatWarrantyLabel(7, 'day')).toBe('7 Days');
    expect(formatWarrantyLabel(3, 'month')).toBe('3 Months');
    expect(formatWarrantyLabel(null, null)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd backend && npx jest src/admin/inventory/item-warranty.util.spec.ts -v`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement util**

```typescript
import { BadRequestException } from '@nestjs/common';

export type WarrantyUnit = 'day' | 'week' | 'month' | 'year';

const UNITS = new Set<WarrantyUnit>(['day', 'week', 'month', 'year']);

export type NormalizedWarranty = {
  warrantyValue: number;
  warrantyUnit: WarrantyUnit;
} | null;

export function normalizeWarranty(
  value?: number | null,
  unit?: string | null,
): NormalizedWarranty {
  const hasValue = value != null && value !== ('' as unknown);
  const rawUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  const hasUnit = rawUnit.length > 0;

  if (!hasValue && !hasUnit) {
    return null;
  }
  if (!hasValue || !hasUnit) {
    throw new BadRequestException('Warranty requires both a value and a unit.');
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException('Warranty value must be a whole number of at least 1.');
  }
  if (!UNITS.has(rawUnit as WarrantyUnit)) {
    throw new BadRequestException('Warranty unit must be day, week, month, or year.');
  }
  return { warrantyValue: n, warrantyUnit: rawUnit as WarrantyUnit };
}

export function formatWarrantyLabel(
  value?: number | null,
  unit?: string | null,
): string {
  try {
    const normalized = normalizeWarranty(
      value == null || value === ('' as unknown) ? null : Number(value),
      unit,
    );
    if (!normalized) {
      return '';
    }
    const labels: Record<WarrantyUnit, [string, string]> = {
      day: ['Day', 'Days'],
      week: ['Week', 'Weeks'],
      month: ['Month', 'Months'],
      year: ['Year', 'Years'],
    };
    const [one, many] = labels[normalized.warrantyUnit];
    return `${normalized.warrantyValue} ${normalized.warrantyValue === 1 ? one : many}`;
  } catch {
    return '';
  }
}
```

Note: `normalizeWarranty` used for API validation should throw; `formatWarrantyLabel` must not throw for display — keep the try/catch as above, or split a non-throwing parser. Prefer: `formatWarrantyLabel` only formats when both valid without throwing (duplicate light check) so API validation stays strict.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd backend && npx jest src/admin/inventory/item-warranty.util.spec.ts -v`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/inventory/item-warranty.util.ts backend/src/admin/inventory/item-warranty.util.spec.ts
git commit -m "feat: add warranty normalize and format helpers"
```

---

### Task 3: Sales Order API (DTO + persist + read)

**Files:**
- Modify: `backend/src/admin/inventory/dto/create-sales-order.dto.ts`
- Modify: `backend/src/admin/inventory/sales-orders.service.ts`

**Interfaces:**
- Consumes: `normalizeWarranty`, `ensureSalesOrderItemWarrantyColumns`
- Produces: `SalesOrderItem.warrantyValue`, `SalesOrderItem.warrantyUnit` on list/detail items

- [ ] **Step 1: Extend `CreateSalesOrderItemDto`**

```typescript
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warrantyValue?: number | null;

  @IsOptional()
  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  warrantyUnit?: 'day' | 'week' | 'month' | 'year' | null;
```

- [ ] **Step 2: In `normalizeItems` / create loop**, call `normalizeWarranty(item.warrantyValue, item.warrantyUnit)` and include columns in `INSERT INTO pcmazing_sales_order_items`. Call `ensureSalesOrderItemWarrantyColumns` at start of create + getById/loadItems.

- [ ] **Step 3: Extend `SalesOrderItem` interface + `loadItems` SELECT/map** to return `warrantyValue` / `warrantyUnit` (null when unset).

- [ ] **Step 4: Smoke-check** — create SO via API or existing UI still works; Nest reload has no SQL errors on getById.

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/inventory/dto/create-sales-order.dto.ts backend/src/admin/inventory/sales-orders.service.ts
git commit -m "feat: persist sales order item warranty"
```

---

### Task 4: Job Order parts API (DTO + persist + read)

**Files:**
- Modify: `backend/src/admin/inventory/dto/create-service.dto.ts` (`CreateServicePartDto`)
- Modify: `backend/src/admin/inventory/inventory-services.service.ts`

**Interfaces:**
- Consumes: `normalizeWarranty`, `ensureJobOrderPartWarrantyColumns`
- Produces: part objects include `warrantyValue` / `warrantyUnit`

- [ ] **Step 1: Add same optional `warrantyValue` / `warrantyUnit` fields to `CreateServicePartDto`.**

- [ ] **Step 2: On create and update part INSERT/replace**, normalize warranty and write columns. Call ensure on create/update/get paths that touch parts.

- [ ] **Step 3: SELECT parts queries + mappers** include `sp.warranty_value`, `sp.warranty_unit` → `warrantyValue` / `warrantyUnit`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/admin/inventory/dto/create-service.dto.ts backend/src/admin/inventory/inventory-services.service.ts
git commit -m "feat: persist job order part warranty"
```

---

### Task 5: Frontend util + API types

**Files:**
- Create: `frontend/src/app/admin/pages/inventory/item-warranty.util.ts`
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`

**Interfaces:**
- Produces:
  - `WarrantyUnit`, `WARRANTY_PRESETS: { label: string; value: number; unit: WarrantyUnit }[]`
  - `formatWarrantyLabel(value, unit): string`
  - `normalizeWarrantyInput(value, unit): { warrantyValue: number; warrantyUnit: WarrantyUnit } | null`

Preset list (exact):

```typescript
export const WARRANTY_PRESETS = [
  { label: '7 Days', value: 7, unit: 'day' as const },
  { label: '1 Month', value: 1, unit: 'month' as const },
  { label: '3 Months', value: 3, unit: 'month' as const },
  { label: '1 Year', value: 1, unit: 'year' as const },
];
```

- [ ] **Step 1: Add util** matching backend format rules (no Nest exceptions — return null for invalid).

- [ ] **Step 2: Extend API types** on sales order items, create payload items, JO parts, and create/update part payloads with optional `warrantyValue?: number | null` and `warrantyUnit?: WarrantyUnit | null`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/pages/inventory/item-warranty.util.ts frontend/src/app/admin/services/admin-api.service.ts
git commit -m "feat: add frontend warranty helpers and API types"
```

---

### Task 6: Sales Order create UI (checkbox + popup)

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html`

**Interfaces:**
- Consumes: `WARRANTY_PRESETS`, `formatWarrantyLabel`
- Form controls per item: `warrantyValue: number | null`, `warrantyUnit: WarrantyUnit | ''`
- Signals: `warrantyPopupIndex`, draft value/unit, `warrantyWasSet` flag for cancel behavior

- [ ] **Step 1: Extend `addItem()` / view-mode hydrate** form group with `warrantyValue: [null]`, `warrantyUnit: ['']`.

- [ ] **Step 2: Add popup state + methods**

Behavior (exact):
- Check Warranty → open popup for that row index; if no prior warranty, mark as first-set
- Uncheck → clear value/unit, close popup
- Preset click → set draft number+unit
- Save → write controls, close
- Cancel → if first-set with no prior saved warranty, uncheck/clear; else restore previous

- [ ] **Step 3: HTML** — under each item row (edit mode): checkbox + summary label; modal overlay (same `fixed inset-0 z-50 ...` pattern as void modal) with presets, number input, unit select, Save/Cancel.

- [ ] **Step 4: Include warranty in create payload** via `normalizeWarrantyInput` (omit/null when empty).

- [ ] **Step 5: Manual check** — create page loads; check Warranty opens popup; Save shows `1 Year` summary.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html
git commit -m "feat: sales order item warranty checkbox and popup"
```

---

### Task 7: Job Order parts UI (checkbox + popup)

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.html`

**Interfaces:**
- Same popup behavior as Task 6, scoped to `partsArray` rows only (not labor-only / header service fields).

- [ ] **Step 1: Extend `addPartRow` + edit hydrate** with `warrantyValue` / `warrantyUnit`.

- [ ] **Step 2: Reuse same popup UX pattern** (can duplicate methods in this component to avoid a large shared component unless already trivial — YAGNI: duplicate thin popup logic matching SO).

- [ ] **Step 3: Include warranty on create/update parts payload.**

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.ts frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.html
git commit -m "feat: job order part warranty checkbox and popup"
```

---

### Task 8: Receipt Warranty column (SO + JO)

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.html`
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.html`
- Modify CSS only if column needs `num`/width tweaks

**Interfaces:**
- Extend `ReceiptLine` with `warrantyLabel: string`
- SO lines: from item warranty; custom-discount row → `''`
- JO lines: product/part rows get part warranty; labor rows (`… Labor`), header service labor, and discount rows → `''`

- [ ] **Step 1: Map warranty into `lines()` using `formatWarrantyLabel`.**

- [ ] **Step 2: Add `<th>Warranty</th>` and cell** in built-in tables and custom-template tables (both SO and JO). Empty display: `—` when label empty.

- [ ] **Step 3: Visual check** — receipt with warranted item shows column; labor lines show `—`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.* frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.*
git commit -m "feat: show per-item warranty column on SO and JO receipts"
```

---

### Task 9: Global terms block — default off + rename

**Files:**
- Modify: `frontend/src/app/admin/pages/printing/printing-receipt-content.defaults.ts`
- Modify: `frontend/src/app/admin/pages/printing/printing-generator-page.component.ts`
- Modify: `frontend/src/app/admin/pages/printing/printing-fields.data.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.ts` (`showWarrantyPolicy`)
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.ts` (`showWarrantyPolicy`)
- Modify receipt HTML if title is hard-coded (prefer deriving from first line of policy text / defaults)

- [ ] **Step 1: Change default constant title**

```typescript
export const DEFAULT_WARRANTY_POLICY = `"PCmazing Warranty Terms & Condition"
Major PC Parts: 1-Year Warranty, 5-Day Replacement (Factory Defects Only)
PC Accessories: 5-Day Replacement, 1-Month Warranty (Factory Defects Only)
Original Receipt Required — NO RECEIPT, NO WARRANTY
Monitor dead pixels are NOT covered under replacement/warranty.
Physical, liquid, electrical, accidental, or customer-caused damage voids the warranty.
By purchasing this product, you acknowledge that you have read, understood, and accepted the terms and conditions of this warranty policy.`;
```

- [ ] **Step 2: Printing generator form** — `showWarrantyPolicy: [false]` (was `[true]`).

- [ ] **Step 3: Receipt helpers** — change to opt-in:

```typescript
showWarrantyPolicy(): boolean {
  return this.printingSettings()?.showWarrantyPolicy === true;
}
```

- [ ] **Step 4: Update printing field sample** to use new title wording.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/admin/pages/printing/printing-receipt-content.defaults.ts frontend/src/app/admin/pages/printing/printing-generator-page.component.ts frontend/src/app/admin/pages/printing/printing-fields.data.ts frontend/src/app/admin/pages/inventory/sales-order-receipt-page.component.ts frontend/src/app/admin/pages/inventory/inventory-service-receipt-page.component.ts
git commit -m "feat: hide global warranty terms by default and rename title"
```

---

### Task 10: End-to-end verification

- [ ] **Step 1: Run util tests**

Run: `cd backend && npx jest src/admin/inventory/item-warranty.util.spec.ts -v`  
Expected: PASS

- [ ] **Step 2: Manual SO path**
  1. Create SO with one item, Warranty → `1 Year`
  2. Open receipt → Warranty column shows `1 Year`
  3. Global terms block not visible unless Printing Settings toggled on
  4. When toggled on, title shows **PCmazing Warranty Terms & Condition**

- [ ] **Step 3: Manual JO path**
  1. Create/edit JO part with Warranty → `7 Days`
  2. Receipt: part row `7 Days`; labor rows `—`

- [ ] **Step 4: Commit any leftover fixes** (only if needed)

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Columns on SO items + JO parts | 1, 3, 4 |
| Normalize/validate value+unit | 2, 3, 4 |
| Checkbox + popup presets/custom | 6, 7 |
| Receipt Warranty column | 8 |
| JO labor/service blank | 8 |
| Global block default hidden | 9 |
| Rename to Terms & Condition | 9 |
| Out of scope (claims, SO edit, JO services) | Not implemented |
