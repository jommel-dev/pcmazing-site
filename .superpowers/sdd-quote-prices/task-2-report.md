# Task 2 Report: Local price lists backend API

## Status
**DONE**

## Summary
Implemented Nest admin API for local price stores/items CRUD, CSV template download, CSV replace import, and `searchActiveItems` for Task 3 parts-price merge. Registered controller + service in `admin.module.ts`.

## Implementation

### Service (`local-price-lists.service.ts`)
- Store CRUD: `listStores`, `createStore`, `updateStore` (name/active)
- Item CRUD: `listItems`, `createItem`, `updateItem`, `deleteItem`
- `replaceItemsFromCsv`: parse via `parseLocalPriceListCsv`, wrap DELETE + bulk INSERT in `withTransaction`; `BadRequestException` on parse errors / unique SKU (`23505`)
- `searchActiveItems(query, limit)`: active stores only; `ILIKE` on title/sku; maps to PartsPriceHit-like (`sourceId: local:<storeId>`, `sourceLabel: store.name`, `url: ''`)
- `ensureTables()` → `ServiceUnavailableException` if migration 072 not applied

### Controller (`local-price-lists.controller.ts`)
JWT-guarded `@Controller('admin/local-price-stores')`:
- `GET/POST /`
- `PATCH /:id`
- `GET /:id/items`
- `GET /:id/items/import/template` → CSV text (`LOCAL_PRICE_LIST_TEMPLATE_CSV`)
- `POST /:id/items/import` → `FileInterceptor('file', memoryStorage, 5MB)` replace
- `POST /:id/items`, `PATCH/DELETE /:id/items/:itemId`

### DTOs
- `dto/local-price-store.dto.ts` — create/update store
- `dto/local-price-item.dto.ts` — create/update item (`pricePhp`, optional sku/notes)

### Module
- Registered `LocalPriceListsController` + `LocalPriceListsService` in `admin.module.ts` (alongside PartsPriceSearch)

## Verification
```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```
- **Result:** exit 0

## Commit
- `e07f67c` — Add local price lists admin API and CSV replace.
- Staged only: `backend/src/admin/local-price-lists/**`, `backend/src/admin/admin.module.ts`
- Not committed: `env.generated.ts`, `.superpowers/**`

## Interfaces delivered
- HTTP admin local-price-stores API (above)
- `LocalPriceListsService.searchActiveItems(query, limit)` for Task 3

## Concerns / follow-ups
- Migration 072 still must be applied before runtime use (ensureTables will 503 otherwise).
- CSV replace rejects duplicate SKUs in one upload via unique index (clear BadRequest).
- Template route accepts store `:id` but does not require store existence (same constant for all stores).
- No automated HTTP/e2e tests in this task; Task 3 will inject this service into parts search.
