# Task 4 Report: Admin UI for local price lists

## Status
**DONE**

## Summary
Added admin module/page for local price stores and items: CRUD forms, item table, CSV template download, and CSV import with replace confirmation. Wired API client, nav module key, RBAC, and route next to quotations.

## Implementation

### API client (`admin-api.service.ts`)
- Types: `LocalPriceStore`, `LocalPriceItem`
- Methods: `listLocalPriceStores`, `createLocalPriceStore`, `updateLocalPriceStore`, `listLocalPriceItems`, `createLocalPriceItem`, `updateLocalPriceItem`, `deleteLocalPriceItem`, `getLocalPriceListTemplate`, `importLocalPriceListCsv` (multipart field `file`)

### Page (`local-price-lists-page.component.ts` + `.html`)
- Standalone Angular page matching admin table/form styling
- Left: add/edit store form + store list (select, edit, activate/deactivate)
- Right: selected store header, item form (add/edit), searchable items table, delete confirm
- CSV: Download template + Import CSV; confirm “Replace all items for this store?” before upload

### Registration
- `admin-modules.data.ts` — key `local_price_lists`, route `/admin/local-price-lists`, Sales Operations nav (near quotation)
- `admin-roles.ts` — module key; granted with `quotation` to operations/sales roles (super admin still `all`)
- `admin.routes.ts` — `/admin/local-price-lists` → `LocalPriceListsPageComponent`, `data: { module: 'local_price_lists' }`

## Verification
```powershell
cd frontend; npx ng build --configuration=development
```
- **Result:** exit 0 (build ~25s)

## Commit
- `be377ca` — Add admin UI for local price lists and CSV import.
- Staged only: local-price-lists page, admin-api.service.ts, admin-modules.data.ts, admin-roles.ts, admin.routes.ts
- Not committed: `env.generated.ts`, `.superpowers/**`

## Interfaces delivered
- Admin UI at `/admin/local-price-lists` consuming Task 2 JWT API
- Store list + item CRUD + CSV replace import with confirm

## Concerns / follow-ups
- Runtime needs migration 072 applied (API 503 otherwise).
- No browser e2e in this task; UI verified via production Angular build only.
- CSV replace is destructive by design (confirm dialog before POST).
