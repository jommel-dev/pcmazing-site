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

- [ ] **Step 2: Run tests â€” expect FAIL**

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

- [ ] **Step 6: Run Jest â€” expect PASS**

```powershell
cd backend; npx jest src/admin/quotation/quotation-topup.util.spec.ts src/admin/local-price-lists/local-price-list-csv.util.spec.ts --no-cache
```

- [ ] **Step 7: Commit**

```powershell
git add backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql backend/src/admin/quotation/quotation-topup.util.ts backend/src/admin/quotation/quotation-topup.util.spec.ts backend/src/admin/local-price-lists/local-price-list-csv.util.ts backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts
git commit -m "Add local price list migration and topup/CSV helpers."
```

---


