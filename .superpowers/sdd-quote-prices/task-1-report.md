# Task 1 Report: Migration + pure helpers (topup math + CSV parse)

## Status
**DONE**

## Summary
Added migration `072` for local price stores/items and quotation item topup columns, plus pure helpers for charged-unit topup math and local price list CSV parsing with template export.

## TDD flow
1. Wrote `quotation-topup.util.spec.ts` (4 cases from brief).
2. Ran Jest — failed with module-not-found (expected).
3. Implemented `quotation-topup.util.ts` exactly per brief (`TopupMode`, `roundMoney`, `computeChargedUnitPrice`, `computeLineTopupTotal`).
4. Wrote `local-price-list-csv.util.spec.ts` (template parse, case-insensitive headers, skip blank titles, missing headers, invalid price).
5. Implemented `local-price-list-csv.util.ts` with `LOCAL_PRICE_LIST_TEMPLATE_CSV`, quoted-field CSV line parser (aligned with prospect import pattern), case-insensitive `title`/`price`/`sku`/`notes` columns.
6. Added migration SQL verbatim from brief.

## Files created
| File | Purpose |
|------|---------|
| `backend/src/sql/migrations/072_local_price_lists_and_quotation_topup.sql` | Stores, items, indexes, quotation topup columns + backfill |
| `backend/src/admin/quotation/quotation-topup.util.ts` | Topup charged price + line topup total |
| `backend/src/admin/quotation/quotation-topup.util.spec.ts` | Topup unit tests |
| `backend/src/admin/local-price-lists/local-price-list-csv.util.ts` | CSV parse + template constant |
| `backend/src/admin/local-price-lists/local-price-list-csv.util.spec.ts` | CSV unit tests |

## Verification
```powershell
cd backend; npx jest src/admin/quotation/quotation-topup.util.spec.ts src/admin/local-price-lists/local-price-list-csv.util.spec.ts --no-cache
```
- **Result:** 2 suites, 9 tests passed.

Initial failing run (topup only, before impl):
- Module not found `./quotation-topup.util` — expected.

## Commit
- `405c904` — Add local price list migration and topup/CSV helpers.
- Only the five task files staged; `env.generated.ts` and `.superpowers` not committed.

## Interfaces delivered
- `TopupMode`, `computeChargedUnitPrice`, `computeLineTopupTotal`
- `parseLocalPriceListCsv`, `LOCAL_PRICE_LIST_TEMPLATE_CSV`, `LocalPriceListCsvRow`

## Concerns / follow-ups
- Migration not applied in this task; run via existing migration runner before Task 2+.
- CSV parser throws on empty file (no header); acceptable for replace-upload flow; no data-only rows test required by brief.
- No Nest module wiring yet (Task 2).
