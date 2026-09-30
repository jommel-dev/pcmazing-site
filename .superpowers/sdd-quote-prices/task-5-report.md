# Task 5 Report: Quotation backend topup + public strip

## Status
**DONE**

## Summary
Extended quotation item DTO and service so charged `unitPrice` is derived server-side from base + topup mode/value, persisted on create/update/duplicate, returned on admin detail (with topup breakdown), and stripped from public share responses.

## Implementation

### DTO (`create-quotation.dto.ts`)
- Optional item fields: `baseUnitPrice`, `topupMode` (`IsIn(['none','fixed','percent'])`), `topupValue`
- Existing `unitPrice` kept as optional legacy seed for base when `baseUnitPrice` omitted

### Service (`quotation.service.ts`)
- Imports `computeChargedUnitPrice`, `computeLineTopupTotal`, `TopupMode`
- `NormalizedQuoteItem` / `QuotationItem` / `QuotationDetail` carry topup fields (`totalTopup` on admin detail)
- `normalizeItems`: derive base (client base → legacy unitPrice → material sellPrice), normalize mode, recompute charged `unitPrice` (ignore client charged price)
- `insertItems`: writes `base_unit_price`, `topup_mode`, `topup_value`, `unit_price`, `line_total`
- Owned detail SELECT maps topup columns + `lineTopupTotal`; sums `totalTopup`
- `getByShareToken`: omits per-item topup fields and quote-level `totalTopup`
- `duplicate` preserves topup fields when re-inserting lines
- `normalizeTopupMode` private helper (default `'none'`)

## Verification
```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```
- **Result:** exit 0

## Commit
- `36b7feb` — Persist quotation line topup and strip it from public share.
- Staged only: `backend/src/admin/quotation/**`
- Not committed: `env.generated.ts`, `.superpowers/**`

## Interfaces delivered
- Admin create/update/detail: base + mode + value → server charged price; admin sees topup breakdown
- Public share: charged prices only (no topup metadata)

## Concerns / follow-ups
- Runtime needs migration 072 applied (owned detail SELECT/INSERT now reference topup columns).
- Frontend quotation create/edit UI for topup fields is out of this task.
