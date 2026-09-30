### Task 3: Merge local hits into parts price search

**Files:**
- Modify: `backend/src/admin/parts-price-search/parts-price-search.service.ts`
- Modify: `backend/src/admin/parts-price-search/parts-price-search.module` wiring if needed (inject `LocalPriceListsService` via `AdminModule` providers â€” same module is fine)

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


