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
  - `GET .../items/import/template` â†’ CSV text
  - `POST .../items/import` multipart `file` â†’ replace all items for store
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


