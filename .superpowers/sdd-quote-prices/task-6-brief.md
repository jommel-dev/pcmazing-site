### Task 6: Quotation create/edit/detail UI + mark spec

**Files:**
- Modify: `frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts` (+ `.html`)
- Modify: `frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts` (+ `.html`)
- Do **not** add topup columns to `quotation-print-page.*`
- Modify: `docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md` â†’ Status **Implemented**
- Optionally share a tiny FE helper duplicating math, or inline the same formulas as the util (keep in sync with server)

**Interfaces:**
- Line form fields: `baseUnitPrice`, `topupMode`, `topupValue`; display charged unit + line topup total
- On inventory/web/local select: set `baseUnitPrice` from seed; `topupMode='none'`; `topupValue=0`
- Submit payload includes base/mode/value (not a conflicting free charged price)
- Detail page shows breakdown + optional quote total topup

- [ ] **Step 1: Extend line model + UI on create/edit**

- [ ] **Step 2: Detail breakdown**

- [ ] **Step 3: Mark spec Implemented**

- [ ] **Step 4: Frontend build**

```powershell
cd frontend; npx ng build --configuration=development
```

Expected: exit 0.

- [ ] **Step 5: Manual smoke**

1. Create store + items; search on quotation create â€” local hit labeled by store, mixed with web.
2. CSV replace works.
3. Fixed and % topup update charged price; detail shows topup; `/q/:token` and print do not.
4. Old quotes still open.

- [ ] **Step 6: Commit**

```powershell
git add frontend/src/app/admin/pages/quotations docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md
git commit -m "Add quotation topup UI and mark local prices spec implemented."
```

