### Task 4: Admin UI for local price lists

**Files:**
- Create: `frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts` (+ `.html`)
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` (CRUD + import methods)
- Modify: `frontend/src/app/admin/data/admin-modules.data.ts` â€” key `local_price_lists`, route `/admin/local-price-lists`, put near quotations in nav
- Modify: `frontend/src/app/admin/rbac/admin-roles.ts` â€” add key; grant to same roles as `quotation`
- Modify: `frontend/src/app/admin/admin.routes.ts` â€” lazy/standalone page with `data: { module: 'local_price_lists' }`

**Interfaces:**
- Consumes admin API endpoints from Task 2
- Produces: store list, item table, add/edit, CSV file input with confirm â€œReplace all items for this store?â€

- [ ] **Step 1: Wire API client methods** mirroring inventory import naming (`getLocalPriceListTemplate`, `importLocalPriceListCsv`, etc.)

- [ ] **Step 2: Build page UI** â€” keep consistent with existing admin list/edit pages (tables, forms). No marketing hero redesign.

- [ ] **Step 3: Register module key + route + roles**

- [ ] **Step 4: Commit**

```powershell
git add frontend/src/app/admin/pages/local-price-lists frontend/src/app/admin/services/admin-api.service.ts frontend/src/app/admin/data/admin-modules.data.ts frontend/src/app/admin/rbac/admin-roles.ts frontend/src/app/admin/admin.routes.ts
git commit -m "Add admin UI for local price lists and CSV import."
```

---


