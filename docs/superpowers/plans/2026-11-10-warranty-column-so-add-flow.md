# Warranty Column + SO Add-Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Warranty selection column with bulk Set warranty on JO parts and SO items, and change Sales Order create to JO-style type-to-search add (inventory + stores + Enter) with Add item removed.

**Architecture:** Frontend-only. Selection state lives in component signals (`Set<number>` of row indices). Warranty popup gains a bulk mode (`warrantyPopupMode: 'single' | 'bulk'`) that patches one index or all selected indices. SO create drops per-row search inputs and the Add item button; one top-level search adds completed lines like JO Parts Used.

**Tech Stack:** Angular reactive forms + signals, existing `item-warranty.util.ts`, existing `AdminApiService.searchPartsPrices` / `listMaterials`.

**Spec:** `docs/superpowers/specs/2026-11-10-warranty-column-so-add-flow-design.md`

## Global Constraints

- Checkbox in Warranty column = **selection only**; does not clear warranty on uncheck.
- Header checkbox = select/deselect all editable rows.
- **Set warranty** appears when `selectedCount >= 1`; Save applies to all selected; Cancel leaves rows unchanged.
- Per-row duration / Set link still opens single-row popup.
- After successful bulk Save, clear selection.
- SO: remove Add item; no empty starter row; rows show name as text after add.
- Non-Inventory always selectable; stocked materials require stock; allow add-as-new when exact match is not selectable.
- No backend / migration changes.
- Do not commit unless the user explicitly asks (plan commit steps are optional).

## File map

| File | Role |
| --- | --- |
| `frontend/.../inventory-service-create-page.component.ts` | JO selection signals, bulk popup mode, layout handlers |
| `frontend/.../inventory-service-create-page.component.html` | Warranty column + bulk bar; keep search as-is |
| `frontend/.../sales-order-create-page.component.ts` | Top-level add search (materials + web), selection, bulk warranty, remove Add item seed |
| `frontend/.../sales-order-create-page.component.html` | JO-like search + Warranty column + bulk bar; text name rows |

---

### Task 1: JO Warranty column + bulk Set warranty

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.html`

**Interfaces:**
- Produces (component methods):
  - `warrantySelectedIndices = signal<Set<number>>(new Set())`
  - `warrantyPopupMode = signal<'single' | 'bulk'>('single')`
  - `togglePartWarrantySelect(index: number): void`
  - `toggleSelectAllPartWarranties(): void`
  - `allPartWarrantiesSelected(): boolean`
  - `partWarrantySelectedCount(): number`
  - `openBulkPartWarrantyPopup(): void`
  - `openPartWarrantyPopup(index: number): void` (single; mode=`single`)
  - `savePartWarrantyPopup(): void` (applies to one or all selected)
  - `cancelPartWarrantyPopup(): void` (bulk: close only; single: keep prior clear-on-cancel-first-set behavior)

- [ ] **Step 1: Replace warranty-checkbox-as-on/off with selection signals**

Add signals next to existing warranty drafts:

```ts
readonly warrantySelectedIndices = signal<Set<number>>(new Set());
readonly warrantyPopupMode = signal<'single' | 'bulk'>('single');
```

Remove / stop using `onPartWarrantyCheckboxClick` for enable/clear. New handlers:

```ts
isPartWarrantySelected(index: number): boolean {
  return this.warrantySelectedIndices().has(index);
}

togglePartWarrantySelect(index: number): void {
  if (this.isDoneStatus()) return;
  const next = new Set(this.warrantySelectedIndices());
  if (next.has(index)) next.delete(index);
  else next.add(index);
  this.warrantySelectedIndices.set(next);
}

toggleSelectAllPartWarranties(): void {
  if (this.isDoneStatus()) return;
  if (this.allPartWarrantiesSelected()) {
    this.warrantySelectedIndices.set(new Set());
    return;
  }
  this.warrantySelectedIndices.set(new Set(this.partsArray.controls.map((_, i) => i)));
}

allPartWarrantiesSelected(): boolean {
  const n = this.partsArray.length;
  return n > 0 && this.warrantySelectedIndices().size === n;
}

partWarrantySelectedCount(): number {
  return this.warrantySelectedIndices().size;
}
```

When removing a part, rebuild selection: drop removed index and decrement indices `> removed`.

- [ ] **Step 2: Bulk + single popup save**

```ts
openBulkPartWarrantyPopup(): void {
  if (this.isDoneStatus() || this.partWarrantySelectedCount() < 1) return;
  this.warrantyPopupMode.set('bulk');
  this.warrantyPopupHadPrior.set(true); // cancel must not clear
  this.warrantyDraftValue.set(1);
  this.warrantyDraftUnit.set('day');
  this.warrantyPopupIndex.set(-1); // sentinel: popup open in bulk mode
}

openPartWarrantyPopup(index: number): void {
  // existing load draft from row…
  this.warrantyPopupMode.set('single');
  this.warrantyPopupIndex.set(index);
}

savePartWarrantyPopup(): void {
  const normalized = normalizeWarrantyInput(this.warrantyDraftValue(), this.warrantyDraftUnit());
  if (!normalized) {
    this.formError.set('Enter a warranty of at least 1 day, week, month, or year.');
    return;
  }
  if (this.warrantyPopupMode() === 'bulk') {
    for (const index of this.warrantySelectedIndices()) {
      this.partsArray.at(index)?.patchValue({
        warrantyValue: normalized.warrantyValue,
        warrantyUnit: normalized.warrantyUnit,
      });
    }
    this.warrantySelectedIndices.set(new Set());
  } else {
    const index = this.warrantyPopupIndex();
    if (index == null || index < 0) return;
    this.partsArray.at(index)?.patchValue({
      warrantyValue: normalized.warrantyValue,
      warrantyUnit: normalized.warrantyUnit,
    });
  }
  this.warrantyPopupIndex.set(null);
  this.formError.set('');
}

cancelPartWarrantyPopup(): void {
  if (this.warrantyPopupMode() === 'bulk') {
    this.warrantyPopupIndex.set(null);
    return;
  }
  // existing single-row cancel (clear if no prior)
  …
}
```

Popup open condition: `warrantyPopupIndex() !== null` (bulk uses `-1`).

- [ ] **Step 3: Update JO HTML layout**

Grid columns become roughly:

`44px | minmax(0,1.2fr) | 140px | 72px | 110px | 110px | 110px | 44px`

Header row: checkbox + **Warranty** | Material | Brand | Qty | Unit Price | Discount | Net | (trash)

Above `formArrayName="parts"`, when editable and `partWarrantySelectedCount() > 0`:

```html
<div class="mb-3 flex flex-wrap items-center gap-3">
  <p class="text-sm text-slate-600">{{ partWarrantySelectedCount() }} selected</p>
  <button type="button" class="…" (click)="openBulkPartWarrantyPopup()">Set warranty</button>
</div>
```

Per row Warranty cell:

```html
<div class="flex flex-col items-start gap-1">
  <input type="checkbox" [checked]="isPartWarrantySelected(partIndex)" (change)="togglePartWarrantySelect(partIndex)" />
  @if (partHasWarranty(partIndex)) {
    <button type="button" class="text-xs font-semibold text-pcmazing-600" (click)="openPartWarrantyPopup(partIndex)">
      {{ partWarrantyLabel(partIndex) }}
    </button>
  } @else if (!isDoneStatus()) {
    <button type="button" class="text-xs font-semibold text-slate-500 hover:text-pcmazing-600" (click)="openPartWarrantyPopup(partIndex)">
      Set
    </button>
  }
</div>
```

Remove the old Warranty checkbox under the material name.

- [ ] **Step 4: Manual verify JO**

Create/edit JO with 3 parts: select 2 → Set warranty → both get `7 Days`; third unchanged; per-row Set still works; uncheck selection does not clear warranty.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.ts frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.html
git commit -m "feat: add JO parts warranty selection column and bulk set"
```

---

### Task 2: SO type-to-search add-flow (remove Add item)

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html`

**Interfaces:**
- Produces:
  - Top-level `partQuery`, `openPartSearch`, `materialSearchResults`, `webSearchResults`, `webSearchErrors`, `webSearchLoading` (same pattern as JO)
  - `addItemFromCatalog(material)`, `addTypedCustomItem()`, `selectWebPart(hit)`
  - `itemDisplayName(index)`, `isCustomItem(index)`
  - Stop seeding `addItem()` on create load; remove Add item button from template
  - Keep `addItem()` private helper only if still used to push a fully filled group

- [ ] **Step 1: Port JO search signals + methods onto SO**

Mirror JO’s `scheduleMaterialSearch` / `searchMaterials` / `searchWebParts` / `selectWebPart` / `canCreateNewPart` / `isNonInventoryMaterial` / `isMaterialSelectable` onto `sales-order-create-page.component.ts`.

Import `PartsPriceHit` from `admin-api.service`.

Change create `ngOnInit` path: **do not** call `this.addItem()` when there is no `orderId`.

Replace per-index `partQueries` map with a single `partQuery = signal('')` used only by the top search box.

`addItemFromCatalog` / custom / web should `push` a completed group (materialId or customItemName set, qty 1, price filled) then clear the query — same as JO `addPartRow`.

- [ ] **Step 2: Rewrite SO items HTML**

- Remove **Add item** button.
- Add JO-style search input + dropdown (Inventory + Web & local stores + Add as new) above the list.
- Each row: show **text name** (+ optional New/custom badge), not an in-row search input.
- Keep qty / price / discount / remove controls.
- View mode: no search box; show loaded items as today.

Helper copy:

> Type to search inventory and connected stores, or type a new name and press Enter.

- [ ] **Step 3: Fix submit validation**

Ensure submit still requires at least one valid line (`materialId` or `customItemName`). Remove any logic that depended on empty rows or per-index Enter on unfinished rows.

- [ ] **Step 4: Manual verify SO add**

Create SO: add inventory hit, store hit (PC Concept/Express), and typed custom via Enter — three lines appear without Add item. No blank starter row on load.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html
git commit -m "feat: match sales order item add flow to job order parts search"
```

---

### Task 3: SO Warranty column + bulk Set warranty

**Files:**
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html`

**Interfaces:**
- Same selection / bulk / single pattern as Task 1, renamed for items:
  - `toggleItemWarrantySelect`, `toggleSelectAllItemWarranties`, `openBulkWarrantyPopup`, etc.
- Reuse existing SO warranty popup markup; change open condition to `warrantyPopupIndex() !== null` with bulk sentinel `-1`.

- [ ] **Step 1: Port Task 1 selection + bulk save logic to SO**

Replace `onWarrantyCheckboxClick` enable/clear behavior with selection toggles. Keep `clearItemWarranty` for any explicit clear if still needed; selection uncheck must not call it.

Default draft unit for SO can stay `'year'` for single; bulk draft may start at `1` + `'year'` to match SO prior default (or `'day'` for consistency with JO — use **`year`** on SO to minimize surprise for existing SO users).

- [ ] **Step 2: Update SO grid HTML**

Columns: `Warranty | Item | Qty | Price | Discount | remove`

Bulk bar above items when `itemWarrantySelectedCount() > 0` and not view mode.

Per-row Set / duration link like JO.

- [ ] **Step 3: Manual verify SO warranty**

Select two of three lines → Set warranty → both updated; per-row Set still works; uncheck does not clear.

- [ ] **Step 4: Commit (only if user asked)**

```bash
git add frontend/src/app/admin/pages/inventory/sales-order-create-page.component.ts frontend/src/app/admin/pages/inventory/sales-order-create-page.component.html
git commit -m "feat: add sales order warranty selection column and bulk set"
```

---

### Task 4: End-to-end smoke

**Files:** none (verification only)

- [ ] **Step 1: JO smoke** — warranty column, select all, bulk set, per-row set, Done status read-only.
- [ ] **Step 2: SO smoke** — search add (inventory/store/custom), no Add item, warranty column + bulk, create order succeeds.
- [ ] **Step 3: Confirm receipts** still show Warranty column from saved fields (no receipt code changes expected).

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Warranty column before name | 1, 3 |
| Header select all | 1, 3 |
| Set warranty bulk button | 1, 3 |
| Per-row Set / duration | 1, 3 |
| Uncheck ≠ clear warranty | 1, 3 |
| Clear selection after bulk save | 1, 3 |
| SO search inventory + stores + Enter | 2 |
| Remove Add item / no empty seed row | 2 |
| No backend changes | all |
| Receipts unchanged | 4 |

## Placeholder / consistency notes

- Bulk popup sentinel index: `-1` on both JO and SO; open check is `!== null`.
- JO default draft unit: `day`; SO: `year` (existing defaults).
- Selection index remap required on `removePart` / `removeItem`.
