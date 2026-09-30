BASE: aa93877
HEAD: 405c904621e2d4e704ce5807b623407f65db4741


## Commits

405c904 Add local price list migration and topup/CSV helpers.

## Stat

 .../local-price-list-csv.util.spec.ts              | 41 ++++++++++
 .../local-price-lists/local-price-list-csv.util.ts | 93 ++++++++++++++++++++++
 .../admin/quotation/quotation-topup.util.spec.ts   | 16 ++++
 .../src/admin/quotation/quotation-topup.util.ts    | 31 ++++++++
 .../072_local_price_lists_and_quotation_topup.sql  | 44 ++++++++++
 5 files changed, 225 insertions(+)

## Diff

diff --git a/backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts b/backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts
new file mode 100644
index 0000000..fe53735
--- /dev/null
+++ b/backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts
@@ -0,0 +1,41 @@
+import {
+  LOCAL_PRICE_LIST_TEMPLATE_CSV,
+  parseLocalPriceListCsv,
+} from './local-price-list-csv.util';
+
+describe('local-price-list-csv.util', () => {
+  it('parses the exported template', () => {
+    expect(parseLocalPriceListCsv(LOCAL_PRICE_LIST_TEMPLATE_CSV)).toEqual([
+      {
+        title: 'Sample GPU 8GB',
+        pricePhp: 12500,
+        sku: 'SKU-1',
+        notes: 'optional note',
+      },
+    ]);
+  });
+
+  it('accepts case-insensitive headers', () => {
+    const csv = 'Title,PRICE,SKU,Notes\nWidget,99.5,,';
+    expect(parseLocalPriceListCsv(csv)).toEqual([
+      { title: 'Widget', pricePhp: 99.5, sku: null, notes: null },
+    ]);
+  });
+
+  it('skips rows with blank title', () => {
+    const csv = 'title,price\n,500\nReal item,100\n';
+    expect(parseLocalPriceListCsv(csv)).toEqual([
+      { title: 'Real item', pricePhp: 100, sku: null, notes: null },
+    ]);
+  });
+
+  it('throws when required headers are missing', () => {
+    expect(() => parseLocalPriceListCsv('sku,notes\nx,y')).toThrow(/title/i);
+    expect(() => parseLocalPriceListCsv('title,sku\nx,y')).toThrow(/price/i);
+  });
+
+  it('throws on non-numeric price', () => {
+    const csv = 'title,price\nItem,not-a-number';
+    expect(() => parseLocalPriceListCsv(csv)).toThrow(/price/i);
+  });
+});
diff --git a/backend/src/admin/local-price-lists/local-price-list-csv.util.ts b/backend/src/admin/local-price-lists/local-price-list-csv.util.ts
new file mode 100644
index 0000000..67be43e
--- /dev/null
+++ b/backend/src/admin/local-price-lists/local-price-list-csv.util.ts
@@ -0,0 +1,93 @@
+export const LOCAL_PRICE_LIST_TEMPLATE_CSV =
+  'title,price,sku,notes\n"Sample GPU 8GB",12500,SKU-1,"optional note"\n';
+
+export interface LocalPriceListCsvRow {
+  title: string;
+  pricePhp: number;
+  sku: string | null;
+  notes: string | null;
+}
+
+export function parseLocalPriceListCsv(csvText: string): LocalPriceListCsvRow[] {
+  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
+  if (lines.length === 0) {
+    throw new Error('CSV must include a header row with title and price columns');
+  }
+
+  const headers = parseDelimitedLine(lines[0]).map((header) => normalizeHeader(header));
+  const titleIndex = findColumnIndex(headers, ['title']);
+  const priceIndex = findColumnIndex(headers, ['price']);
+  if (titleIndex < 0) {
+    throw new Error('CSV header must include a title column');
+  }
+  if (priceIndex < 0) {
+    throw new Error('CSV header must include a price column');
+  }
+  const skuIndex = findColumnIndex(headers, ['sku']);
+  const notesIndex = findColumnIndex(headers, ['notes']);
+
+  const rows: LocalPriceListCsvRow[] = [];
+  for (let i = 1; i < lines.length; i += 1) {
+    const values = parseDelimitedLine(lines[i]);
+    const title = (values[titleIndex] ?? '').trim();
+    if (!title) {
+      continue;
+    }
+
+    const priceRaw = (values[priceIndex] ?? '').trim().replace(/,/g, '');
+    const pricePhp = Number(priceRaw);
+    if (!Number.isFinite(pricePhp) || pricePhp < 0) {
+      throw new Error(`Invalid price on row ${i + 1}`);
+    }
+
+    const skuRaw = skuIndex >= 0 ? (values[skuIndex] ?? '').trim() : '';
+    const notesRaw = notesIndex >= 0 ? (values[notesIndex] ?? '').trim() : '';
+
+    rows.push({
+      title,
+      pricePhp,
+      sku: skuRaw || null,
+      notes: notesRaw || null,
+    });
+  }
+
+  return rows;
+}
+
+function normalizeHeader(value: string): string {
+  return value.trim().toLowerCase();
+}
+
+function findColumnIndex(headers: string[], names: string[]): number {
+  for (const name of names) {
+    const index = headers.indexOf(name);
+    if (index >= 0) {
+      return index;
+    }
+  }
+  return -1;
+}
+
+function parseDelimitedLine(line: string): string[] {
+  const delimiter = line.includes('\t') ? '\t' : ',';
+  const values: string[] = [];
+  let current = '';
+  let inQuotes = false;
+
+  for (let i = 0; i < line.length; i += 1) {
+    const char = line[i];
+    if (char === '"') {
+      inQuotes = !inQuotes;
+      continue;
+    }
+    if (char === delimiter && !inQuotes) {
+      values.push(current);
+      current = '';
+      continue;
+    }
+    current += char;
+  }
+
+  values.push(current);
+  return values.map((value) => value.trim());
+}
diff --git a/backend/src/admin/quotation/quotation-topup.util.spec.ts b/backend/src/admin/quotation/quotation-topup.util.spec.ts
new file mode 100644
index 0000000..5647fe1
--- /dev/null
+++ b/backend/src/admin/quotation/quotation-topup.util.spec.ts
@@ -0,0 +1,16 @@
+import { computeChargedUnitPrice, computeLineTopupTotal } from './quotation-topup.util';
+
+describe('quotation-topup.util', () => {
+  it('none returns base', () => {
+    expect(computeChargedUnitPrice(1000, 'none', 50)).toBe(1000);
+  });
+  it('fixed adds pesos', () => {
+    expect(computeChargedUnitPrice(1000, 'fixed', 150)).toBe(1150);
+  });
+  it('percent applies markup', () => {
+    expect(computeChargedUnitPrice(1000, 'percent', 10)).toBe(1100);
+  });
+  it('line topup total uses qty', () => {
+    expect(computeLineTopupTotal(1000, 1150, 2)).toBe(300);
+  });
+});
diff --git a/backend/src/admin/quotation/quotation-topup.util.ts b/backend/src/admin/quotation/quotation-topup.util.ts
new file mode 100644
index 0000000..3abfa8e
--- /dev/null
+++ b/backend/src/admin/quotation/quotation-topup.util.ts
@@ -0,0 +1,31 @@
+export type TopupMode = 'none' | 'fixed' | 'percent';
+
+function roundMoney(n: number): number {
+  return Math.round((n + Number.EPSILON) * 100) / 100;
+}
+
+export function computeChargedUnitPrice(
+  baseUnitPrice: number,
+  mode: TopupMode,
+  topupValue: number,
+): number {
+  const base = Number(baseUnitPrice);
+  const topup = Number(topupValue);
+  if (!Number.isFinite(base) || base < 0) {
+    throw new Error('baseUnitPrice must be a non-negative number');
+  }
+  if (!Number.isFinite(topup) || topup < 0) {
+    throw new Error('topupValue must be a non-negative number');
+  }
+  if (mode === 'fixed') return roundMoney(base + topup);
+  if (mode === 'percent') return roundMoney(base * (1 + topup / 100));
+  return roundMoney(base);
+}
+
+export function computeLineTopupTotal(
+  baseUnitPrice: number,
+  chargedUnitPrice: number,
+  quantity: number,
+): number {
+  return roundMoney((Number(chargedUnitPrice) - Number(baseUnitPrice)) * Number(quantity));
+}
diff --git a/backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql b/backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql
new file mode 100644
index 0000000..a35c0ea
--- /dev/null
+++ b/backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql
@@ -0,0 +1,44 @@
+-- 072_local_price_lists_and_quotation_topup.sql
+
+CREATE TABLE IF NOT EXISTS pcmazing_local_price_stores (
+  id BIGSERIAL PRIMARY KEY,
+  name TEXT NOT NULL,
+  active BOOLEAN NOT NULL DEFAULT TRUE,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE TABLE IF NOT EXISTS pcmazing_local_price_items (
+  id BIGSERIAL PRIMARY KEY,
+  store_id BIGINT NOT NULL REFERENCES pcmazing_local_price_stores(id) ON DELETE CASCADE,
+  title TEXT NOT NULL,
+  sku TEXT NULL,
+  price_php NUMERIC(14, 2) NOT NULL CHECK (price_php >= 0),
+  notes TEXT NULL,
+  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
+  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
+);
+
+CREATE INDEX IF NOT EXISTS idx_local_price_items_store ON pcmazing_local_price_items(store_id);
+CREATE INDEX IF NOT EXISTS idx_local_price_items_title ON pcmazing_local_price_items (lower(title));
+CREATE UNIQUE INDEX IF NOT EXISTS uq_local_price_items_store_sku
+  ON pcmazing_local_price_items(store_id, sku)
+  WHERE sku IS NOT NULL AND btrim(sku) <> '';
+
+ALTER TABLE pcmazing_quotation_items
+  ADD COLUMN IF NOT EXISTS base_unit_price NUMERIC(14, 2),
+  ADD COLUMN IF NOT EXISTS topup_mode TEXT NOT NULL DEFAULT 'none',
+  ADD COLUMN IF NOT EXISTS topup_value NUMERIC(14, 2) NOT NULL DEFAULT 0;
+
+UPDATE pcmazing_quotation_items
+SET base_unit_price = unit_price
+WHERE base_unit_price IS NULL;
+
+ALTER TABLE pcmazing_quotation_items
+  ALTER COLUMN base_unit_price SET NOT NULL;
+
+ALTER TABLE pcmazing_quotation_items
+  DROP CONSTRAINT IF EXISTS chk_quotation_items_topup_mode;
+ALTER TABLE pcmazing_quotation_items
+  ADD CONSTRAINT chk_quotation_items_topup_mode
+  CHECK (topup_mode IN ('none', 'fixed', 'percent'));
