# Quotation Local Price Lists + Per-Item Topup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add staff-managed Cabanatuan local store price lists (CRUD + CSV) into parts search alongside existing web sources, and per-line quotation topup (`fixed` or `percent`) visible only to staff on create/edit/detail.

**Architecture:** New `local-price-lists` Nest feature (stores/items + CSV replace). `PartsPriceSearchService.search` merges local DB hits with web adapters. Quotation items gain `base_unit_price` / `topup_mode` / `topup_value`; server derives charged `unit_price`. Public share strips topup fields; admin print stays customer-safe.

**Tech Stack:** NestJS + PostgreSQL migrations; Angular admin; Jest for pure helpers; existing inventory CSV upload patterns.

**Spec:** `docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md`

## Global Constraints

- Keep existing web sources (pcx, dynaquest, octagon, unipc, pchub) unchanged.
- Local lists are not imported into `tblmaterials`.
- CSV upload **replaces** that store’s items (confirm in UI).
- Local hits mixed into the same search results; `sourceId` = `local:<storeId>`, `sourceLabel` = store name.
- Topup modes per line: `none` | `fixed` | `percent` (not both fixed and % on one line).
- Charged `unitPrice` is **derived** from base + topup; server recomputes on save.
- Staff see topup on create/edit + admin detail only; public `/q/:token` and admin print omit topup.
- PowerShell: use `;` not `&&`.
- Prefer thin helpers + existing admin patterns over new frameworks.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql` | Tables + quotation item columns |
| `backend/src/admin/local-price-lists/*` | Stores/items CRUD + CSV replace |
| `backend/src/admin/local-price-lists/local-price-list-csv.util.ts` | Parse/validate CSV |
| `backend/src/admin/quotation/quotation-topup.util.ts` | Derive charged unit price + topup totals |
| `backend/src/admin/parts-price-search/parts-price-search.service.ts` | Merge local hits |
| `backend/src/admin/quotation/dto/create-quotation.dto.ts` | Item topup fields |
| `backend/src/admin/quotation/quotation.service.ts` | Normalize/insert/map detail; strip public |
| `frontend/.../pages/local-price-lists/*` | Admin UI |
| `frontend/.../admin-modules.data.ts`, `admin-roles.ts`, `admin.routes.ts` | Nav + route |
| `frontend/.../quotations/quotation-create-page.*` | Topup inputs |
| `frontend/.../quotations/quotation-detail-page.*` | Staff breakdown |
| Spec status → Implemented | |

---

### Task 1: Migration + pure helpers (topup math + CSV parse)

**Files:**
- Create: `backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql`
- Create: `backend/src/admin/quotation/quotation-topup.util.ts`
- Create: `backend/src/admin/quotation/quotation-topup.util.spec.ts`
- Create: `backend/src/admin/local-price-lists/local-price-list-csv.util.ts`
- Create: `backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts`

**Interfaces:**
- Produces:
  - `export type TopupMode = 'none' | 'fixed' | 'percent'`
  - `computeChargedUnitPrice(baseUnitPrice: number, mode: TopupMode, topupValue: number): number`
  - `computeLineTopupTotal(baseUnitPrice: number, chargedUnitPrice: number, quantity: number): number`
  - `parseLocalPriceListCsv(csvText: string): { title: string; pricePhp: number; sku: string | null; notes: string | null }[]`

- [ ] **Step 1: Write failing topup tests**

```typescript
// quotation-topup.util.spec.ts
import { computeChargedUnitPrice, computeLineTopupTotal } from './quotation-topup.util';

describe('quotation-topup.util', () => {
  it('none returns base', () => {
    expect(computeChargedUnitPrice(1000, 'none', 50)).toBe(1000);
  });
  it('fixed adds pesos', () => {
    expect(computeChargedUnitPrice(1000, 'fixed', 150)).toBe(1150);
  });
  it('percent applies markup', () => {
    expect(computeChargedUnitPrice(1000, 'percent', 10)).toBe(1100);
  });
  it('line topup total uses qty', () => {
    expect(computeLineTopupTotal(1000, 1150, 2)).toBe(300);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```powershell
cd backend; npx jest src/admin/quotation/quotation-topup.util.spec.ts --no-cache
```

- [ ] **Step 3: Implement topup util**

```typescript
export type TopupMode = 'none' | 'fixed' | 'percent';

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeChargedUnitPrice(
  baseUnitPrice: number,
  mode: TopupMode,
  topupValue: number,
): number {
  const base = Number(baseUnitPrice);
  const topup = Number(topupValue);
  if (!Number.isFinite(base) || base < 0) {
    throw new Error('baseUnitPrice must be a non-negative number');
  }
  if (!Number.isFinite(topup) || topup < 0) {
    throw new Error('topupValue must be a non-negative number');
  }
  if (mode === 'fixed') return roundMoney(base + topup);
  if (mode === 'percent') return roundMoney(base * (1 + topup / 100));
  return roundMoney(base);
}

export function computeLineTopupTotal(
  baseUnitPrice: number,
  chargedUnitPrice: number,
  quantity: number,
): number {
  return roundMoney((Number(chargedUnitPrice) - Number(baseUnitPrice)) * Number(quantity));
}
```

- [ ] **Step 4: Write failing CSV tests + implement parser**

CSV rules: header row required with at least `title` and `price` (case-insensitive). Optional `sku`, `notes`. Skip blank title rows. Throw on missing headers or non-numeric price.

```typescript
// Minimal expected API
export function parseLocalPriceListCsv(csvText: string): Array<{
  title: string;
  pricePhp: number;
  sku: string | null;
  notes: string | null;
}>;
```

Also export a template string:

```typescript
export const LOCAL_PRICE_LIST_TEMPLATE_CSV =
  'title,price,sku,notes\n"Sample GPU 8GB",12500,SKU-1,"optional note"\n';
```

- [ ] **Step 5: Write migration**

```sql
-- 072_local_price_lists_and_quotation_topup.sql

CREATE TABLE IF NOT EXISTS pcmazing_local_price_stores (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pcmazing_local_price_items (
  id BIGSERIAL PRIMARY KEY,
  store_id BIGINT NOT NULL REFERENCES pcmazing_local_price_stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sku TEXT NULL,
  price_php NUMERIC(14, 2) NOT NULL CHECK (price_php >= 0),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_local_price_items_store ON pcmazing_local_price_items(store_id);
CREATE INDEX IF NOT EXISTS idx_local_price_items_title ON pcmazing_local_price_items (lower(title));
CREATE UNIQUE INDEX IF NOT EXISTS uq_local_price_items_store_sku
  ON pcmazing_local_price_items(store_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';

ALTER TABLE pcmazing_quotation_items
  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS topup_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS topup_value NUMERIC(14, 2) NOT NULL DEFAULT 0;

UPDATE pcmazing_quotation_items
SET base_unit_price = unit_price
WHERE base_unit_price IS NULL;

ALTER TABLE pcmazing_quotation_items
  ALTER COLUMN base_unit_price SET NOT NULL;

ALTER TABLE pcmazing_quotation_items
  DROP CONSTRAINT IF EXISTS chk_quotation_items_topup_mode;
ALTER TABLE pcmazing_quotation_items
  ADD CONSTRAINT chk_quotation_items_topup_mode
  CHECK (topup_mode IN ('none', 'fixed', 'percent'));
```

- [ ] **Step 6: Run Jest — expect PASS**

```powershell
cd backend; npx jest src/admin/quotation/quotation-topup.util.spec.ts src/admin/local-price-lists/local-price-list-csv.util.spec.ts --no-cache
```

- [ ] **Step 7: Commit**

```powershell
git add backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql backend/src/admin/quotation/quotation-topup.util.ts backend/src/admin/quotation/quotation-topup.util.spec.ts backend/src/admin/local-price-lists/local-price-list-csv.util.ts backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts
git commit -m "Add local price list migration and topup/CSV helpers."
```

---

### Task 2: Local price lists backend API

**Files:**
- Create: `backend/src/admin/local-price-lists/local-price-lists.service.ts`
- Create: `backend/src/admin/local-price-lists/local-price-lists.controller.ts`
- Create: `backend/src/admin/local-price-lists/dto/*.ts` (create/update store + item)
- Modify: `backend/src/admin/admin.module.ts` (register controller + service)

**Interfaces:**
- Consumes: `parseLocalPriceListCsv`, `LOCAL_PRICE_LIST_TEMPLATE_CSV`, `DatabaseService`
- Produces HTTP (JWT admin):
  - `GET/POST /admin/local-price-stores`
  - `PATCH /admin/local-price-stores/:id` (name, active)
  - `GET /admin/local-price-stores/:id/items`
  - `POST/PATCH/DELETE .../items[/:itemId]`
  - `GET .../items/import/template` → CSV text
  - `POST .../items/import` multipart `file` → replace all items for store
  - Service method for search: `searchActiveItems(query: string, limit: number): Promise<PartsPriceHit-like[]>`

- [ ] **Step 1: Implement service + controller** following inventory CSV pattern (`FileInterceptor('file', memoryStorage, 5MB)`), `BadRequestException` on bad CSV.

Replace import flow:

```typescript
async replaceItemsFromCsv(storeId: number, csvText: string): Promise<{ imported: number }> {
  await this.assertStore(storeId);
  const rows = parseLocalPriceListCsv(csvText);
  // transaction: DELETE FROM pcmazing_local_price_items WHERE store_id = $1; bulk INSERT
  return { imported: rows.length };
}
```

Search helper (used in Task 3):

```typescript
async searchActiveItems(query: string, limit: number): Promise<Array<{
  sourceId: string;
  sourceLabel: string;
  title: string;
  pricePhp: number;
  currency: 'PHP';
  url: string;
  sku?: string | null;
}>> {
  const q = `%${query.trim()}%`;
  // JOIN stores WHERE active; ILIKE title OR sku; LIMIT
  // sourceId = `local:${store.id}`, sourceLabel = store.name, url = ''
}
```

- [ ] **Step 2: Register in `admin.module.ts`**

- [ ] **Step 3: Typecheck**

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```powershell
git add backend/src/admin/local-price-lists backend/src/admin/admin.module.ts
git commit -m "Add local price lists admin API and CSV replace."
```

---

### Task 3: Merge local hits into parts price search

**Files:**
- Modify: `backend/src/admin/parts-price-search/parts-price-search.service.ts`
- Modify: `backend/src/admin/parts-price-search/parts-price-search.module` wiring if needed (inject `LocalPriceListsService` via `AdminModule` providers — same module is fine)

**Interfaces:**
- Consumes: `LocalPriceListsService.searchActiveItems`
- Produces: `search()` returns web + local hits sorted by `pricePhp`

- [ ] **Step 1: After web `Promise.all`, also fetch local hits**

Even when `PARTS_SEARCH_ENABLED=false`, still return local hits (do not hard-fail the whole search). Pattern:

```typescript
const localPromise = this.localPriceLists
  .searchActiveItems(query, limit)
  .catch((error) => {
    sourceErrors.push({
      sourceId: 'local',
      sourceLabel: 'Local price lists',
      message: error instanceof Error ? error.message : String(error),
    });
    return [] as PartsPriceHit[];
  });

// If web disabled: settled = []; still await localPromise and merge
// If web enabled: merge settled.flat() with local hits, then dedupe/sort/slice as today
```

Ensure `PartsPriceHit.url` can be `''` for local (type allows string).

- [ ] **Step 2: Typecheck + commit**

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
git add backend/src/admin/parts-price-search backend/src/admin/local-price-lists backend/src/admin/admin.module.ts
git commit -m "Merge local price list hits into parts price search."
```

---

### Task 4: Admin UI for local price lists

**Files:**
- Create: `frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts` (+ `.html`)
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` (CRUD + import methods)
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts` — key `local_price_lists`, route `/admin/local-price-lists`, put near quotations in nav
- Modify: `frontend/src/app/admin/rbac/admin-roles.ts` — add key; grant to same roles as `quotation`
- Modify: `frontend/src/app/admin/admin.routes.ts` — lazy/standalone page with `data: { module: 'local_price_lists' }`

**Interfaces:**
- Consumes admin API endpoints from Task 2
- Produces: store list, item table, add/edit, CSV file input with confirm “Replace all items for this store?”

- [ ] **Step 1: Wire API client methods** mirroring inventory import naming (`getLocalPriceListTemplate`, `importLocalPriceListCsv`, etc.)

- [ ] **Step 2: Build page UI** — keep consistent with existing admin list/edit pages (tables, forms). No marketing hero redesign.

- [ ] **Step 3: Register module key + route + roles**

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/app/admin/pages/local-price-lists frontend/src/app/admin/services/admin-api.service.ts frontend/src/app/admin/data/admin-modules.data.ts frontend/src/app/admin/rbac/admin-roles.ts frontend/src/app/admin/admin.routes.ts
git commit -m "Add admin UI for local price lists and CSV import."
```

---

### Task 5: Quotation backend topup + public strip

**Files:**
- Modify: `backend/src/admin/quotation/dto/create-quotation.dto.ts`
- Modify: `backend/src/admin/quotation/quotation.service.ts` (`NormalizedQuoteItem`, `normalizeItems`, `insertItems`, detail mapping, `getByShareToken`)

**Interfaces:**
- Consumes: `computeChargedUnitPrice`, `computeLineTopupTotal`, `TopupMode`
- Item DTO adds optional `baseUnitPrice`, `topupMode`, `topupValue` (ignore client charged `unitPrice` for math — recompute; keep `unitPrice` optional only as legacy seed for base when base omitted)

Normalize rules:

```typescript
const topupMode = normalizeTopupMode(item.topupMode); // default 'none'
const topupValue = Number(item.topupValue ?? 0);
let baseUnitPrice = item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice ?? 0);
// material fallback: if base missing, use sellPrice as today
const unitPrice = computeChargedUnitPrice(baseUnitPrice, topupMode, topupValue);
```

`insertItems` writes `base_unit_price`, `topup_mode`, `topup_value`, `unit_price`, `line_total`.

Admin detail item payload includes:

```typescript
{
  ...,
  baseUnitPrice,
  topupMode,
  topupValue,
  unitPrice, // charged
  lineTopupTotal: computeLineTopupTotal(baseUnitPrice, unitPrice, quantity),
}
```

`getByShareToken`: map detail then strip per item: delete/omit `baseUnitPrice`, `topupMode`, `topupValue`, `lineTopupTotal`; omit quote-level `totalTopup` if present.

- [ ] **Step 1: Extend DTO + normalize/insert/detail/public strip**

- [ ] **Step 2: Typecheck**

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```

- [ ] **Step 3: Commit**

```powershell
git add backend/src/admin/quotation
git commit -m "Persist quotation line topup and strip it from public share."
```

---

### Task 6: Quotation create/edit/detail UI + mark spec

**Files:**
- Modify: `frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts` (+ `.html`)
- Modify: `frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts` (+ `.html`)
- Do **not** add topup columns to `quotation-print-page.*`
- Modify: `docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md` → Status **Implemented**
- Optionally share a tiny FE helper duplicating math, or inline the same formulas as the util (keep in sync with server)

**Interfaces:**
- Line form fields: `baseUnitPrice`, `topupMode`, `topupValue`; display charged unit + line topup total
- On inventory/web/local select: set `baseUnitPrice` from seed; `topupMode='none'`; `topupValue=0`
- Submit payload includes base/mode/value (not a conflicting free charged price)
- Detail page shows breakdown + optional quote total topup

- [ ] **Step 1: Extend line model + UI on create/edit**

- [ ] **Step 2: Detail breakdown**

- [ ] **Step 3: Mark spec Implemented**

- [ ] **Step 4: Frontend build**

```powershell
cd frontend; npx ng build --configuration=development
```

Expected: exit 0.

- [ ] **Step 5: Manual smoke**

1. Create store + items; search on quotation create — local hit labeled by store, mixed with web.
2. CSV replace works.
3. Fixed and % topup update charged price; detail shows topup; `/q/:token` and print do not.
4. Old quotes still open.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/app/admin/pages/quotations docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md
git commit -m "Add quotation topup UI and mark local prices spec implemented."
```
