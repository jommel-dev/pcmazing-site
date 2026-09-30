# Task 6 Report: Quotation create/edit/detail UI + mark spec

## Status
**DONE**

## Summary
Extended quotation create/edit forms with base price + topup mode/value (server derives charged `unitPrice`), live charged/line-topup previews, and admin detail breakdown including optional quote `totalTopup`. Spec marked Implemented. Print page untouched.

## Implementation

### Helper (`quotation-topup.util.ts`)
- Mirrors backend math: `computeChargedUnitPrice`, `computeLineTopupTotal`, `normalizeTopupMode`

### API types (`admin-api.service.ts`)
- `QuotationItem`: optional `baseUnitPrice`, `topupMode`, `topupValue`, `lineTopupTotal`
- `QuotationDetail`: optional `totalTopup`
- `CreateQuotationPayload` items accept base/mode/value

### Create / edit (`quotation-create-page.*`)
- Line fields: `baseUnitPrice`, `topupMode`, `topupValue` (replaced free charged `unitPrice`)
- Inventory / web / local select seeds base; resets topup to `none` / `0`
- Live charged unit + line topup under each row; summary shows staff total topup
- Submit sends `baseUnitPrice`, `topupMode`, `topupValue` (no conflicting charged `unitPrice`)
- Edit load populates base/mode/value from detail

### Detail (`quotation-detail-page.*`)
- Staff columns: Base, Topup, Charged, Line topup (+ existing qty/discount/line total)
- Optional quote-level total topup in summary

### Spec
- `docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md` → **Status: Implemented**

## Verification
```powershell
cd frontend; npx ng build --configuration=development
```
- **Result:** exit 0

## Manual smoke
**Skipped** — no admin credentials available in this session.

## Commit
- `5b3d833` — Add quotation topup UI and mark local prices spec implemented.
- Staged: quotations pages + topup util, admin-api types, design spec
- Not committed: `env.generated.ts`, `.superpowers/**`

## Concerns / follow-ups
- FE topup util must stay in sync with `backend/.../quotation-topup.util.ts`
- Manual smoke still needed for fixed/% topup, public `/q/:token`, and print (no topup columns)

---

## Final-review fix: parts-search cache invalidation

### Finding
Parts-search in-memory cache (8 min TTL) could serve stale local price hits after local list CRUD/CSV writes.

### Fix
- Added `PartsPriceSearchService.clearCache()` (`this.cache.clear()`).
- `LocalPriceListsService` calls it after successful writes: create/update store, create/update/delete item, `replaceItemsFromCsv`.
- Circular DI avoided with `@Inject(forwardRef(...))` on both services.

### Verification
```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```
- **Result:** exit 0 (no output)

### Commit
- `249dd1b` — Invalidate parts search cache after local price list writes.
