# PC Concept Local Price Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync PC Concept’s public `products-data.js` catalog into an active local price store named “PC Concept” (manual Refresh + daily job) so quotation parts search can find those items at regular price.

**Architecture:** Pure parse/map helpers → `LocalPriceListsService.syncPcConceptCatalog()` fetches URL, replaces store items in a transaction, sets `last_synced_at`, clears parts-search cache. Nest `@Cron` at 02:00 Asia/Manila. Admin Local Price Lists UI shows Refresh + last synced.

**Tech Stack:** NestJS, PostgreSQL, Angular local-price-lists page, `@nestjs/schedule` (add dependency).

**Spec:** `docs/superpowers/specs/2026-10-12-pc-concept-local-price-sync-design.md`

## Global Constraints

- Store name exactly **PC Concept** (auto-create if missing; keep active).
- Price: always regular **`price`** (ignore `sale`).
- Skip `hidden === true` and `price` missing/≤ 0.
- Full **replace** of that store’s items on successful sync only.
- Fail if zero importable products (do not wipe store).
- Duplicate SKUs in source: **first-wins**.
- Default URL: `https://pcconcept.com.ph/assets/js/products-data.js` (override via `PC_CONCEPT_PRODUCTS_URL`).
- Do not `eval` the remote script; extract JSON for `PCC_DATA` safely.
- Daily cron ~**02:00 Asia/Manila**.

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/sql/migrations/078_local_price_store_last_synced.sql` | `last_synced_at` column |
| `backend/src/admin/local-price-lists/pc-concept-catalog.util.ts` | Parse + map products |
| `backend/src/admin/local-price-lists/pc-concept-catalog.util.spec.ts` | Unit tests |
| `backend/src/admin/local-price-lists/local-price-lists.service.ts` | Sync orchestration |
| `backend/src/admin/local-price-lists/local-price-lists.controller.ts` | Sync endpoint |
| `backend/src/admin/local-price-lists/pc-concept-sync.scheduler.ts` | Daily cron |
| `backend/src/admin/admin.module.ts` | Register ScheduleModule + scheduler |
| `frontend/.../admin-api.service.ts` | `syncPcConceptLocalPrices()` |
| `frontend/.../local-price-lists-page.component.*` | Refresh UI |

---

### Task 1: Migration — `last_synced_at`

**Files:**
- Create: `backend/src/sql/migrations/078_local_price_store_last_synced.sql`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE pcmazing_local_price_stores
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/sql/migrations/078_local_price_store_last_synced.sql
git commit -m "feat(local-prices): add last_synced_at on price stores"
```

---

### Task 2: Parse / map helpers (TDD)

**Files:**
- Create: `backend/src/admin/local-price-lists/pc-concept-catalog.util.ts`
- Test: `backend/src/admin/local-price-lists/pc-concept-catalog.util.spec.ts`

**Interfaces:**
- Produces:

```ts
export type PcConceptMappedItem = {
  title: string;
  sku: string;
  pricePhp: number;
  notes: string | null;
};

export function extractPccDataJson(jsText: string): unknown;
export function mapPcConceptProducts(data: unknown): PcConceptMappedItem[];
```

- [ ] **Step 1: Failing tests**

```ts
describe('pc-concept-catalog.util', () => {
  const sample = `/* gen */\nwindow.PCC_DATA=${JSON.stringify({
    settings: { markup: 15 },
    products: [
      { id: 'a', sku: 'SKU-A', name: 'Item A', brand: 'X', cat: 'storage', specs: 'SATA', price: 1000, sale: 900, stock: { cab: 1, pam: 0 }, hidden: false },
      { id: 'b', sku: 'SKU-B', name: 'Hidden', brand: 'X', cat: 'ram', specs: '', price: 50, sale: 0, stock: { cab: 0, pam: 0 }, hidden: true },
      { id: 'c', sku: '', name: 'No sku', brand: 'Y', cat: 'ram', specs: '', price: 0, sale: 0, stock: { cab: 0, pam: 0 }, hidden: false },
      { id: 'd', sku: 'SKU-A', name: 'Dup sku second', brand: 'Z', cat: 'ram', specs: '', price: 200, sale: 0, stock: { cab: 0, pam: 0 }, hidden: false },
    ],
  })};`;

  it('extracts PCC_DATA JSON', () => {
    const data = extractPccDataJson(sample) as { products: unknown[] };
    expect(data.products).toHaveLength(4);
  });

  it('maps regular price, skips hidden/invalid, first-wins SKU', () => {
    const items = mapPcConceptProducts(extractPccDataJson(sample));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Item A',
      sku: 'SKU-A',
      pricePhp: 1000,
    });
    expect(items[0].notes).toContain('X');
    expect(items[0].notes).toMatch(/Cab:\s*1/i);
  });

  it('throws on missing PCC_DATA', () => {
    expect(() => extractPccDataJson('window.FOO={}'))
      .toThrow(/PCC_DATA/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`cd backend && npx jest src/admin/local-price-lists/pc-concept-catalog.util.spec.ts --no-cache`

- [ ] **Step 3: Implement util**

Parse strategy (safe):
1. Find `window.PCC_DATA=` or `PCC_DATA=`
2. Take substring from first `{` after `=`
3. Use a brace-balanced scan to extract JSON text (or `JSON.parse` after trimming trailing `;`)
4. Do **not** use `eval` / `new Function` on remote text

Map:
- skip hidden / non-finite price / price ≤ 0
- sku = trimmed sku or id
- first-wins on sku (case-sensitive as source)
- notes: `[brand] · [cat] · [specs] · Cab:n Pam:m` (omit empty parts)

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/local-price-lists/pc-concept-catalog.util.ts backend/src/admin/local-price-lists/pc-concept-catalog.util.spec.ts
git commit -m "feat(local-prices): parse and map PC Concept catalog"
```

---

### Task 3: Sync service + HTTP endpoint

**Files:**
- Modify: `backend/src/admin/local-price-lists/local-price-lists.service.ts`
- Modify: `backend/src/admin/local-price-lists/local-price-lists.controller.ts`
- Extend: `LocalPriceStore` type with `lastSyncedAt: string | null`
- Ensure `ensureTables` / SELECT maps `last_synced_at` (document that migration 078 must be applied)

**Interfaces:**
- Consumes: Task 2 helpers; `fetch` / `undici` / Node `https` (use existing project HTTP pattern if any — otherwise `fetch` in Node 18+)
- Produces:

```ts
async syncPcConceptCatalog(): Promise<{
  storeId: number;
  imported: number;
  lastSyncedAt: string;
}>
```

**Behavior:**
1. `ensureTables()`
2. `GET` catalog URL from `process.env.PC_CONCEPT_PRODUCTS_URL` or default
3. Parse + map; if `mapped.length === 0` → `BadRequestException('No importable PC Concept products.')`
4. Find store by exact name `PC Concept`; if missing, `INSERT` active store
5. Transaction: `DELETE FROM items WHERE store_id`; insert all mapped; `UPDATE stores SET last_synced_at = NOW(), updated_at = NOW()`
6. `partsPriceSearch.clearCache()`
7. Return counts + ISO lastSyncedAt

**Controller** (register **before** `:id` routes that could conflict — use static path):

```ts
@Post('sync/pc-concept')
syncPcConcept() {
  return this.localPriceListsService.syncPcConceptCatalog().then((data) => ({
    success: true,
    message: `PC Concept sync complete: ${data.imported} item(s).`,
    data,
  }));
}
```

Place this method **above** `@Patch(':id')` / `@Get(':id/items')` so `sync` is not parsed as an id.

- [ ] **Step 1: Extend store mapping for `lastSyncedAt`**

- [ ] **Step 2: Implement `syncPcConceptCatalog`**

- [ ] **Step 3: Add controller route**

- [ ] **Step 4: Focused test** — unit-test mapping already covers parse; optional service test with mocked `fetch` + mocked DB if easy; otherwise manual smoke after UI.

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/local-price-lists/local-price-lists.service.ts backend/src/admin/local-price-lists/local-price-lists.controller.ts
git commit -m "feat(local-prices): sync PC Concept catalog into local store"
```

---

### Task 4: Daily schedule

**Files:**
- Create: `backend/src/admin/local-price-lists/pc-concept-sync.scheduler.ts`
- Modify: `backend/src/admin/admin.module.ts`
- Modify: `backend/package.json` — add `@nestjs/schedule` if missing

**Interfaces:**
- Consumes: `LocalPriceListsService.syncPcConceptCatalog`

```ts
@Injectable()
export class PcConceptSyncScheduler {
  private readonly logger = new Logger(PcConceptSyncScheduler.name);
  constructor(private readonly localPriceLists: LocalPriceListsService) {}

  @Cron('0 2 * * *', { timeZone: 'Asia/Manila' })
  async handleDailySync(): Promise<void> {
    try {
      const result = await this.localPriceLists.syncPcConceptCatalog();
      this.logger.log(`PC Concept sync: ${result.imported} items`);
    } catch (err) {
      this.logger.warn(
        `PC Concept sync failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
```

- [ ] **Step 1:** `cd backend && npm install @nestjs/schedule`

- [ ] **Step 2:** `ScheduleModule.forRoot()` in `AdminModule` imports; provide `PcConceptSyncScheduler`

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/admin/admin.module.ts backend/src/admin/local-price-lists/pc-concept-sync.scheduler.ts
git commit -m "feat(local-prices): schedule daily PC Concept catalog sync"
```

---

### Task 5: Frontend — Refresh UI + API

**Files:**
- Modify: `frontend/src/app/admin/services/admin-api.service.ts`
- Modify: `frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts`
- Modify: `frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.html`

**Interfaces:**
- Extend store type with `lastSyncedAt?: string | null`
- API:

```ts
syncPcConceptLocalPrices() {
  return this.http.post<ItemResponse<{ storeId: number; imported: number; lastSyncedAt: string }>>(
    `${APP_CONFIG.apiUrl}/admin/local-price-stores/sync/pc-concept`,
    {},
    { headers: this.headers() },
  );
}
```

**UI:**
- Card or toolbar button **Refresh from PC Concept**
- While selected store is PC Concept (or always show the card at top): last synced formatted Manila time; disable button while `syncing`
- On success: reload stores + items; show success message with count

- [ ] **Step 1: API client**

- [ ] **Step 2: Page methods + template**

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/services/admin-api.service.ts frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.html
git commit -m "feat(admin): PC Concept refresh on local price lists"
```

---

### Task 6: Verification

- [ ] **Step 1:** Apply migration `078` on local/staging DB

- [ ] **Step 2:** `cd backend && npx jest src/admin/local-price-lists/pc-concept-catalog.util.spec.ts --no-cache` — PASS

- [ ] **Step 3:** Manual: POST sync or UI Refresh → item count > 0; quotation search finds a known product labeled **PC Concept**

- [ ] **Step 4:** Optional: mark plan checkboxes + commit `docs: mark PC Concept sync plan complete`

---

## Spec coverage (self-review)

| Spec item | Task |
| --- | --- |
| `last_synced_at` | 1 |
| Safe parse + map (regular price, skip hidden) | 2 |
| Sync replace + endpoint | 3 |
| Daily 02:00 Manila | 4 |
| Admin Refresh UI | 5 |
| Quotation search (existing local merge) | 3–5 (no quotation UI change) |
| Verification | 6 |
