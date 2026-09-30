BASE: 36b7feb
HEAD: 5b3d83385acf91f3f4df088c14772de42d909437

5b3d833 Add quotation topup UI and mark local prices spec implemented.
 ...9-30-quotation-local-prices-and-topup-design.md |  2 +-
 .../quotation-create-page.component.html           | 74 ++++++++++++----
 .../quotations/quotation-create-page.component.ts  | 99 +++++++++++++++++-----
 .../quotation-detail-page.component.html           | 20 ++++-
 .../quotations/quotation-detail-page.component.ts  | 38 +++++++++
 .../admin/pages/quotations/quotation-topup.util.ts | 37 ++++++++
 .../src/app/admin/services/admin-api.service.ts    |  8 ++
 7 files changed, 240 insertions(+), 38 deletions(-)

## Diff

diff --git a/docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md b/docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md
index 181b49f..00d01cb 100644
--- a/docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md
+++ b/docs/superpowers/specs/2026-09-30-quotation-local-prices-and-topup-design.md
@@ -1,9 +1,9 @@
 # Quotation Local Price Lists + Per-Item Topup
 
 **Date:** 2026-09-30  
-**Status:** Approved design ΓÇö pending implementation  
+**Status:** Implemented  
 **Approach:** Staff-managed Cabanatuan local price lists (CRUD + CSV) alongside existing web sources; per-line topup (`fixed` or `percent`) with customer-safe final prices only
 
 ## Goal
 
 1. Let staff maintain **local Cabanatuan PC store** price lists (in-app + CSV) and surface those hits in quotation parts search **together with** todayΓÇÖs web sources (unchanged).
diff --git a/frontend/src/app/admin/pages/quotations/quotation-create-page.component.html b/frontend/src/app/admin/pages/quotations/quotation-create-page.component.html
index b82addc..4d8a2e8 100644
--- a/frontend/src/app/admin/pages/quotations/quotation-create-page.component.html
+++ b/frontend/src/app/admin/pages/quotations/quotation-create-page.component.html
@@ -112,11 +112,12 @@
         <div class="rounded-2xl border border-slate-200 p-4">
           <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
             <div>
               <p class="text-sm font-semibold text-slate-800">Quoted items</p>
               <p class="text-xs text-slate-500">
-                Search inventory or web stores, or type a description and choose ΓÇ£Use as custom itemΓÇ¥ for labor and services.
+                Search inventory or web/local stores, or type a description and choose ΓÇ£Use as custom itemΓÇ¥ for labor and services.
+                Set a per-line topup; customers only see the charged price.
               </p>
             </div>
             <div class="flex flex-wrap gap-2">
               <button type="button" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" (click)="addMaterialItem()">
                 Add item
@@ -124,23 +125,28 @@
             </div>
           </div>
 
           <div formArrayName="items" class="space-y-2">
             @if (itemsArray.length > 0) {
-              <div class="hidden gap-3 px-3 sm:grid sm:grid-cols-[minmax(0,1fr)_90px_120px_140px_auto]">
+              <div class="hidden gap-3 px-3 lg:grid lg:grid-cols-[minmax(0,1.2fr)_72px_100px_110px_90px_130px_auto]">
                 <p class="text-xs font-semibold uppercase text-slate-700">Item</p>
                 <p class="text-xs font-semibold uppercase text-slate-700">Qty</p>
-                <p class="text-xs font-semibold uppercase text-slate-700">Price</p>
+                <p class="text-xs font-semibold uppercase text-slate-700">Base</p>
+                <p class="text-xs font-semibold uppercase text-slate-700">Topup</p>
+                <p class="text-xs font-semibold uppercase text-slate-700">Value</p>
                 <p class="text-xs font-semibold uppercase text-slate-700">Discount</p>
                 <span></span>
               </div>
             }
 
             @for (item of itemsArray.controls; track $index; let itemIndex = $index) {
-              <div class="grid items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_90px_120px_140px_auto]" [formGroupName]="itemIndex">
+              <div
+                class="grid items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[minmax(0,1.2fr)_72px_100px_110px_90px_130px_auto]"
+                [formGroupName]="itemIndex"
+              >
                 <div class="relative min-w-0">
-                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 sm:hidden">Item</label>
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Item</label>
                   <input
                     type="text"
                     class="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
                     [value]="partQuery(itemIndex)"
                     (input)="onPartQueryInput(itemIndex, $any($event.target).value)"
@@ -184,25 +190,25 @@
                           </button>
                         }
                       }
 
                       <div class="border-t border-slate-100 px-3 py-2">
-                        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Web stores</p>
-                        <p class="mt-0.5 text-[11px] text-slate-400">Third-party prices ΓÇö verify before finalizing. Gilmore is not a single online catalog.</p>
+                        <p class="text-[11px] font-bold uppercase tracking-wide text-slate-500">Web &amp; local stores</p>
+                        <p class="mt-0.5 text-[11px] text-slate-400">Third-party and local list prices ΓÇö verify before finalizing.</p>
                       </div>
                       @if (webSearchLoading()) {
-                        <p class="px-4 py-3 text-sm text-slate-500">Searching web stores...</p>
+                        <p class="px-4 py-3 text-sm text-slate-500">Searching stores...</p>
                       } @else if (webPartsFor(itemIndex).length === 0) {
                         <p class="px-4 py-3 text-sm text-slate-500">
                           @if (partQuery(itemIndex).trim().length < 3) {
-                            Type at least 3 characters to search web stores.
+                            Type at least 3 characters to search stores.
                           } @else {
-                            No web matches found.
+                            No store matches found.
                           }
                         </p>
                       } @else {
-                        @for (hit of webPartsFor(itemIndex); track hit.sourceId + ':' + hit.url) {
+                        @for (hit of webPartsFor(itemIndex); track hit.sourceId + ':' + (hit.url || hit.title)) {
                           <button
                             type="button"
                             class="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                             (mousedown)="onWebPartSuggestionPointerDown($event, itemIndex, hit)"
                           >
@@ -229,25 +235,55 @@
                     </div>
                   }
                   @if (item.get('materialId')?.value) {
                     <p class="mt-1 text-xs text-slate-500">{{ materialStockLabel(item.get('materialId')?.value) }}</p>
                   }
+                  <p class="mt-1 text-xs text-slate-500">
+                    Charged
+                    <span class="font-semibold text-slate-700">{{ itemChargedUnitPrice(itemIndex) | number:'1.2-2' }}</span>
+                    @if (itemLineTopupTotal(itemIndex) > 0) {
+                      <span class="text-slate-400">┬╖</span>
+                      Topup
+                      <span class="font-semibold text-slate-700">{{ itemLineTopupTotal(itemIndex) | number:'1.2-2' }}</span>
+                    }
+                  </p>
                 </div>
 
                 <div>
-                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 sm:hidden">Qty</label>
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Qty</label>
                   <input type="number" min="0.01" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="quantity" />
                 </div>
 
                 <div>
-                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 sm:hidden">Price</label>
-                  <input type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="unitPrice" />
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Base</label>
+                  <input type="number" min="0" step="0.01" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="baseUnitPrice" />
+                </div>
+
+                <div>
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Topup</label>
+                  <select class="w-full rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="topupMode">
+                    @for (option of topupOptions; track option.value) {
+                      <option [value]="option.value">{{ option.label }}</option>
+                    }
+                  </select>
                 </div>
 
                 <div>
-                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 sm:hidden">Discount</label>
-                  <select class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="discountType">
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Value</label>
+                  <input
+                    type="number"
+                    min="0"
+                    step="0.01"
+                    class="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-pcmazing-500 focus:outline-none read-only:bg-slate-100 read-only:text-slate-400"
+                    formControlName="topupValue"
+                    [readOnly]="item.get('topupMode')?.value === 'none'"
+                  />
+                </div>
+
+                <div>
+                  <label class="mb-1 block text-xs font-semibold uppercase text-slate-700 lg:hidden">Discount</label>
+                  <select class="w-full rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm focus:border-pcmazing-500 focus:outline-none" formControlName="discountType">
                     @for (option of discountOptions; track option.value) {
                       <option [value]="option.value">{{ option.label }}</option>
                     }
                   </select>
                 </div>
@@ -270,10 +306,16 @@
           </div>
           <div class="flex items-center justify-between">
             <span>Items subtotal</span>
             <span class="font-medium text-slate-800">{{ itemsNetSubtotal() | number:'1.2-2' }}</span>
           </div>
+          @if (totalTopupAmount() > 0) {
+            <div class="flex items-center justify-between text-slate-500">
+              <span>Total topup (staff)</span>
+              <span class="font-medium text-slate-700">{{ totalTopupAmount() | number:'1.2-2' }}</span>
+            </div>
+          }
           @if (lineDiscountTotal() > 0) {
             <div class="flex items-center justify-between text-emerald-700">
               <span>SC/PWD savings</span>
               <span class="font-medium">-{{ lineDiscountTotal() | number:'1.2-2' }}</span>
             </div>
diff --git a/frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts b/frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts
index a1133a8..5d43699 100644
--- a/frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts
+++ b/frontend/src/app/admin/pages/quotations/quotation-create-page.component.ts
@@ -14,19 +14,42 @@ import {
 import {
   applyPhSpecialDiscount,
   normalizePhDiscountType,
   type PhDiscountType,
 } from '../inventory/ph-discount.util';
+import {
+  computeChargedUnitPrice,
+  computeLineTopupTotal,
+  normalizeTopupMode,
+  type TopupMode,
+} from './quotation-topup.util';
 
 const DISCOUNT_OPTIONS: Array<{ value: PhDiscountType; label: string }> = [
   { value: 'none', label: 'No discount' },
   { value: 'senior', label: 'Senior Citizen (20%)' },
   { value: 'pwd', label: 'PWD (20%)' },
 ];
 
+const TOPUP_OPTIONS: Array<{ value: TopupMode; label: string }> = [
+  { value: 'none', label: 'No topup' },
+  { value: 'fixed', label: 'Fixed Γé▒' },
+  { value: 'percent', label: 'Percent %' },
+];
+
 type QuoteItemKind = 'material' | 'custom';
 
+type QuoteLineFormValue = {
+  itemKind?: QuoteItemKind;
+  materialId: string;
+  description: string;
+  quantity: number | string;
+  baseUnitPrice: number | string;
+  topupMode: TopupMode | string;
+  topupValue: number | string;
+  discountType?: PhDiscountType;
+};
+
 @Component({
   selector: 'app-quotation-create-page',
   imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
   templateUrl: './quotation-create-page.component.html',
 })
@@ -39,10 +62,11 @@ export class QuotationCreatePageComponent implements OnInit {
   private partSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
   private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;
   private customerSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
 
   readonly discountOptions = DISCOUNT_OPTIONS;
+  readonly topupOptions = TOPUP_OPTIONS;
   readonly loading = signal(true);
   readonly saving = signal(false);
   readonly error = signal('');
   readonly formError = signal('');
   readonly formSuccess = signal('');
@@ -129,17 +153,21 @@ export class QuotationCreatePageComponent implements OnInit {
     });
     this.itemsArray.clear();
     this.partQueries.set([]);
     for (const item of quote.items) {
       const isCustom = !item.materialId;
+      const baseUnitPrice =
+        item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice) || 0;
       this.itemsArray.push(
         this.formBuilder.nonNullable.group({
           itemKind: [isCustom ? 'custom' : 'material'],
           materialId: [item.materialId ? String(item.materialId) : ''],
           description: [item.description || ''],
           quantity: [item.quantity, [Validators.required, Validators.min(0.01)]],
-          unitPrice: [item.unitPrice, [Validators.required, Validators.min(0)]],
+          baseUnitPrice: [baseUnitPrice, [Validators.required, Validators.min(0)]],
+          topupMode: [normalizeTopupMode(item.topupMode)],
+          topupValue: [Number(item.topupValue ?? 0), [Validators.required, Validators.min(0)]],
           discountType: [normalizePhDiscountType(item.discountType)],
         }),
       );
       this.partQueries.update((queries) => [...queries, item.materialName || item.description || '']);
     }
@@ -150,11 +178,13 @@ export class QuotationCreatePageComponent implements OnInit {
       this.formBuilder.nonNullable.group({
         itemKind: ['material' as QuoteItemKind],
         materialId: [''],
         description: [''],
         quantity: [1, [Validators.required, Validators.min(0.01)]],
-        unitPrice: [0, [Validators.required, Validators.min(0)]],
+        baseUnitPrice: [0, [Validators.required, Validators.min(0)]],
+        topupMode: ['none' as TopupMode],
+        topupValue: [0, [Validators.required, Validators.min(0)]],
         discountType: ['none' as PhDiscountType],
       }),
     );
     this.partQueries.update((queries) => [...queries, '']);
   }
@@ -207,11 +237,13 @@ export class QuotationCreatePageComponent implements OnInit {
           group.patchValue(
             {
               itemKind: 'custom' as QuoteItemKind,
               materialId: '',
               description: value.trim().slice(0, 500),
-              unitPrice: 0,
+              baseUnitPrice: 0,
+              topupMode: 'none' as TopupMode,
+              topupValue: 0,
             },
             { emitEvent: false },
           );
         }
       } else {
@@ -298,11 +330,13 @@ export class QuotationCreatePageComponent implements OnInit {
     }
     group.patchValue(
       {
         itemKind: 'material' as QuoteItemKind,
         materialId: String(item.id),
-        unitPrice: this.resolveMaterialUnitPrice(item),
+        baseUnitPrice: this.resolveMaterialUnitPrice(item),
+        topupMode: 'none' as TopupMode,
+        topupValue: 0,
         description: item.materialName,
       },
       { emitEvent: false },
     );
     this.partQueries.update((items) => {
@@ -327,11 +361,13 @@ export class QuotationCreatePageComponent implements OnInit {
     group.patchValue(
       {
         itemKind: 'custom' as QuoteItemKind,
         materialId: '',
         description,
-        unitPrice: Number(hit.pricePhp) || 0,
+        baseUnitPrice: Number(hit.pricePhp) || 0,
+        topupMode: 'none' as TopupMode,
+        topupValue: 0,
       },
       { emitEvent: false },
     );
 
     this.partQueries.update((items) => {
@@ -507,28 +543,51 @@ export class QuotationCreatePageComponent implements OnInit {
     event.preventDefault();
     event.stopPropagation();
     this.selectCustomer(customer);
   }
 
+  itemChargedUnitPrice(index: number): number {
+    const group = this.itemsArray.at(index);
+    if (!group) {
+      return 0;
+    }
+    const item = group.getRawValue() as QuoteLineFormValue;
+    return computeChargedUnitPrice(
+      Number(item.baseUnitPrice) || 0,
+      normalizeTopupMode(item.topupMode),
+      Number(item.topupValue) || 0,
+    );
+  }
+
+  itemLineTopupTotal(index: number): number {
+    const group = this.itemsArray.at(index);
+    if (!group) {
+      return 0;
+    }
+    const item = group.getRawValue() as QuoteLineFormValue;
+    return computeLineTopupTotal(
+      Number(item.baseUnitPrice) || 0,
+      this.itemChargedUnitPrice(index),
+      Number(item.quantity) || 0,
+    );
+  }
+
   itemSubtotal(index: number): number {
     const group = this.itemsArray.at(index);
     if (!group) {
       return 0;
     }
-    const { quantity, unitPrice } = group.getRawValue() as {
-      quantity: number | string;
-      unitPrice: number | string;
-    };
-    return (Number(quantity) || 0) * (Number(unitPrice) || 0);
+    const { quantity } = group.getRawValue() as QuoteLineFormValue;
+    return (Number(quantity) || 0) * this.itemChargedUnitPrice(index);
   }
 
   itemDiscountType(index: number): PhDiscountType {
     const group = this.itemsArray.at(index);
     if (!group) {
       return 'none';
     }
-    return normalizePhDiscountType((group.getRawValue() as { discountType?: string }).discountType);
+    return normalizePhDiscountType((group.getRawValue() as QuoteLineFormValue).discountType);
   }
 
   itemNetAmount(index: number): number {
     return applyPhSpecialDiscount(this.itemSubtotal(index), this.itemDiscountType(index)).net;
   }
@@ -543,10 +602,14 @@ export class QuotationCreatePageComponent implements OnInit {
 
   lineDiscountTotal(): number {
     return this.itemsArray.controls.reduce((total, _, index) => total + this.itemDiscountAmount(index), 0);
   }
 
+  totalTopupAmount(): number {
+    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemLineTopupTotal(index), 0);
+  }
+
   customDiscountAmount(): number {
     return Math.max(0, Number(this.form.controls.customDiscount.value) || 0);
   }
 
   grandTotal(): number {
@@ -626,26 +689,22 @@ export class QuotationCreatePageComponent implements OnInit {
       customDiscount: Number(value.customDiscount) || 0,
       quoteDate: value.quoteDate ? new Date(value.quoteDate).toISOString() : undefined,
       validityDays: Number(value.validityDays) || 7,
       status,
       items: this.itemsArray.controls.map((control, index) => {
-        const item = control.getRawValue() as {
-          itemKind?: QuoteItemKind;
-          materialId: string;
-          description: string;
-          quantity: number | string;
-          unitPrice: number | string;
-          discountType?: PhDiscountType;
-        };
+        const item = control.getRawValue() as QuoteLineFormValue;
         const materialId = Number(item.materialId);
         const hasMaterial = Number.isFinite(materialId) && materialId > 0;
         const description = (item.description || this.partQuery(index) || '').trim();
+        const topupMode = normalizeTopupMode(item.topupMode);
         return {
           ...(hasMaterial ? { materialId } : {}),
           description: description || undefined,
           quantity: Number(item.quantity),
-          unitPrice: Number(item.unitPrice),
+          baseUnitPrice: Number(item.baseUnitPrice) || 0,
+          topupMode,
+          topupValue: topupMode === 'none' ? 0 : Number(item.topupValue) || 0,
           discountType: normalizePhDiscountType(item.discountType),
         };
       }),
     };
 
diff --git a/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.html b/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.html
index 15273cb..29f5d3c 100644
--- a/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.html
+++ b/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.html
@@ -101,22 +101,34 @@
         <table class="min-w-full divide-y divide-slate-200 text-sm">
           <thead class="bg-slate-50">
             <tr>
               <th class="px-4 py-3 text-left font-bold text-slate-600">Description</th>
               <th class="px-4 py-3 text-left font-bold text-slate-600">Qty</th>
-              <th class="px-4 py-3 text-left font-bold text-slate-600">Rate</th>
+              <th class="px-4 py-3 text-left font-bold text-slate-600">Base</th>
+              <th class="px-4 py-3 text-left font-bold text-slate-600">Topup</th>
+              <th class="px-4 py-3 text-left font-bold text-slate-600">Charged</th>
               <th class="px-4 py-3 text-left font-bold text-slate-600">Discount</th>
+              <th class="px-4 py-3 text-right font-bold text-slate-600">Line topup</th>
               <th class="px-4 py-3 text-right font-bold text-slate-600">Line total</th>
             </tr>
           </thead>
           <tbody class="divide-y divide-slate-100">
             @for (item of quote.items; track item.id) {
               <tr>
                 <td class="px-4 py-3 text-slate-800">{{ lineDescription(item) }}</td>
                 <td class="px-4 py-3 text-slate-600">{{ lineQuantity(item) }}</td>
+                <td class="px-4 py-3 text-slate-600">{{ formatMoney(lineBaseUnitPrice(item)) }}</td>
+                <td class="px-4 py-3 text-slate-600">{{ lineTopupLabel(item) }}</td>
                 <td class="px-4 py-3 text-slate-600">{{ formatMoney(item.unitPrice) }}</td>
                 <td class="px-4 py-3 text-slate-600">{{ discountLabel(item.discountType) }}</td>
+                <td class="px-4 py-3 text-right text-slate-600">
+                  @if (lineTopupTotal(item) > 0) {
+                    {{ formatMoney(lineTopupTotal(item)) }}
+                  } @else {
+                    ΓÇö
+                  }
+                </td>
                 <td class="px-4 py-3 text-right text-slate-600">{{ formatMoney(item.lineTotal) }}</td>
               </tr>
             }
           </tbody>
         </table>
@@ -125,10 +137,16 @@
       <div class="mt-6 ml-auto max-w-xs space-y-2 text-sm text-slate-600">
         <div class="flex items-center justify-between">
           <span>Subtotal</span>
           <span class="font-medium text-slate-800">{{ formatMoney(quote.subtotal ?? quote.totalAmount) }}</span>
         </div>
+        @if (quoteTotalTopup(quote) > 0) {
+          <div class="flex items-center justify-between text-slate-500">
+            <span>Total topup (staff)</span>
+            <span class="font-medium text-slate-700">{{ formatMoney(quoteTotalTopup(quote)) }}</span>
+          </div>
+        }
         @if ((quote.discountTotal ?? 0) > 0) {
           <div class="flex items-center justify-between text-emerald-700">
             <span>Discounts</span>
             <span class="font-medium">-{{ formatMoney(quote.discountTotal) }}</span>
           </div>
diff --git a/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts b/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts
index fd20ffb..263e946 100644
--- a/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts
+++ b/frontend/src/app/admin/pages/quotations/quotation-detail-page.component.ts
@@ -1,10 +1,11 @@
 import { Component, inject, OnInit, signal } from '@angular/core';
 import { ActivatedRoute, RouterLink } from '@angular/router';
 import { firstValueFrom } from 'rxjs';
 import { AdminApiService, QuotationDetail, QuotationSource } from '../../services/admin-api.service';
 import { phDiscountLabel } from '../inventory/ph-discount.util';
+import { normalizeTopupMode, type TopupMode } from './quotation-topup.util';
 
 @Component({
   selector: 'app-quotation-detail-page',
   imports: [RouterLink],
   templateUrl: './quotation-detail-page.component.html',
@@ -131,10 +132,47 @@ export class QuotationDetailPageComponent implements OnInit {
 
   lineQuantity(item: QuotationDetail['items'][number]): number | string {
     return item.quantity || item.totalSetQty || 'ΓÇö';
   }
 
+  lineBaseUnitPrice(item: QuotationDetail['items'][number]): number {
+    return item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice) || 0;
+  }
+
+  lineTopupMode(item: QuotationDetail['items'][number]): TopupMode {
+    return normalizeTopupMode(item.topupMode);
+  }
+
+  lineTopupLabel(item: QuotationDetail['items'][number]): string {
+    const mode = this.lineTopupMode(item);
+    const value = Number(item.topupValue ?? 0);
+    if (mode === 'fixed') {
+      return `Fixed +${this.formatMoney(value)}`;
+    }
+    if (mode === 'percent') {
+      return `${value}%`;
+    }
+    return 'None';
+  }
+
+  lineTopupTotal(item: QuotationDetail['items'][number]): number {
+    if (item.lineTopupTotal != null) {
+      return Number(item.lineTopupTotal) || 0;
+    }
+    const base = this.lineBaseUnitPrice(item);
+    const charged = Number(item.unitPrice) || 0;
+    const qty = Number(item.quantity) || 0;
+    return Math.round((charged - base) * qty * 100) / 100;
+  }
+
+  quoteTotalTopup(quote: QuotationDetail): number {
+    if (quote.totalTopup != null) {
+      return Number(quote.totalTopup) || 0;
+    }
+    return quote.items.reduce((sum, item) => sum + this.lineTopupTotal(item), 0);
+  }
+
   discountLabel(value: string | null | undefined): string {
     return phDiscountLabel(value === 'senior' || value === 'pwd' ? value : 'none');
   }
 
   formatDate(value: string | null | undefined): string {
diff --git a/frontend/src/app/admin/pages/quotations/quotation-topup.util.ts b/frontend/src/app/admin/pages/quotations/quotation-topup.util.ts
new file mode 100644
index 0000000..05f053f
--- /dev/null
+++ b/frontend/src/app/admin/pages/quotations/quotation-topup.util.ts
@@ -0,0 +1,37 @@
+export type TopupMode = 'none' | 'fixed' | 'percent';
+
+function roundMoney(n: number): number {
+  return Math.round((n + Number.EPSILON) * 100) / 100;
+}
+
+export function normalizeTopupMode(value: string | null | undefined): TopupMode {
+  if (value === 'fixed' || value === 'percent') {
+    return value;
+  }
+  return 'none';
+}
+
+/** Mirror backend `quotation-topup.util` charged unit price. */
+export function computeChargedUnitPrice(
+  baseUnitPrice: number,
+  mode: TopupMode,
+  topupValue: number,
+): number {
+  const base = Number(baseUnitPrice) || 0;
+  const topup = Math.max(0, Number(topupValue) || 0);
+  if (mode === 'fixed') {
+    return roundMoney(base + topup);
+  }
+  if (mode === 'percent') {
+    return roundMoney(base * (1 + topup / 100));
+  }
+  return roundMoney(base);
+}
+
+export function computeLineTopupTotal(
+  baseUnitPrice: number,
+  chargedUnitPrice: number,
+  quantity: number,
+): number {
+  return roundMoney((Number(chargedUnitPrice) - Number(baseUnitPrice)) * (Number(quantity) || 0));
+}
diff --git a/frontend/src/app/admin/services/admin-api.service.ts b/frontend/src/app/admin/services/admin-api.service.ts
index e3a5feb..3381f12 100644
--- a/frontend/src/app/admin/services/admin-api.service.ts
+++ b/frontend/src/app/admin/services/admin-api.service.ts
@@ -562,10 +562,14 @@ export interface QuotationItem {
   materialName: string | null;
   productId: number | null;
   description: string;
   quantity: number;
   unitPrice: number;
+  baseUnitPrice?: number;
+  topupMode?: 'none' | 'fixed' | 'percent';
+  topupValue?: number;
+  lineTopupTotal?: number;
   sellPrice: number | null;
   discountType: 'none' | 'senior' | 'pwd';
   discountPrice: number | null;
   totalSetQty: number | null;
   lineTotal: number;
@@ -581,10 +585,11 @@ export interface QuotationDetail extends QuotationListItem {
   validityDays?: number | null;
   remarks?: string | null;
   customDiscount?: number;
   subtotal?: number;
   discountTotal?: number;
+  totalTopup?: number;
   items: QuotationItem[];
   hasShareToken?: boolean;
 }
 
 export interface QuotationShareLink {
@@ -606,10 +611,13 @@ export interface CreateQuotationPayload {
   items: Array<{
     materialId?: number | null;
     description?: string;
     quantity: number;
     unitPrice?: number;
+    baseUnitPrice?: number;
+    topupMode?: 'none' | 'fixed' | 'percent';
+    topupValue?: number;
     discountType?: 'none' | 'senior' | 'pwd';
   }>;
 }
 
 export interface PartsPriceHit {
