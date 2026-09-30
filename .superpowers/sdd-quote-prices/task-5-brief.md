### Task 5: Quotation backend topup + public strip

**Files:**
- Modify: `backend/src/admin/quotation/dto/create-quotation.dto.ts`
- Modify: `backend/src/admin/quotation/quotation.service.ts` (`NormalizedQuoteItem`, `normalizeItems`, `insertItems`, detail mapping, `getByShareToken`)

**Interfaces:**
- Consumes: `computeChargedUnitPrice`, `computeLineTopupTotal`, `TopupMode`
- Item DTO adds optional `baseUnitPrice`, `topupMode`, `topupValue` (ignore client charged `unitPrice` for math â€” recompute; keep `unitPrice` optional only as legacy seed for base when base omitted)

Normalize rules:

```typescript
const topupMode = normalizeTopupMode(item.topupMode); // default 'none'
const topupValue = Number(item.topupValue ?? 0);
let baseUnitPrice = item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice ?? 0);
// material fallback: if base missing, use sellPrice as today
const unitPrice = computeChargedUnitPrice(baseUnitPrice, topupMode, topupValue);
```

`insertItems` writes `base_unit_price`, `topup_mode`, `topup_value`, `unit_price`, `line_total`.

Admin detail item payload includes:

```typescript
{
  ...,
  baseUnitPrice,
  topupMode,
  topupValue,
  unitPrice, // charged
  lineTopupTotal: computeLineTopupTotal(baseUnitPrice, unitPrice, quantity),
}
```

`getByShareToken`: map detail then strip per item: delete/omit `baseUnitPrice`, `topupMode`, `topupValue`, `lineTopupTotal`; omit quote-level `totalTopup` if present.

- [ ] **Step 1: Extend DTO + normalize/insert/detail/public strip**

- [ ] **Step 2: Typecheck**

```powershell
cd backend; npx tsc --noEmit -p tsconfig.build.json
```

- [ ] **Step 3: Commit**

```powershell
git add backend/src/admin/quotation
git commit -m "Persist quotation line topup and strip it from public share."
```

---


