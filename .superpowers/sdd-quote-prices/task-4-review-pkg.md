BASE: 611bde4
HEAD: be377cacac5bcef550f1da5adb90d13ca6d66841

be377ca Add admin UI for local price lists and CSV import.
 frontend/src/app/admin/admin.routes.ts             |   8 +
 frontend/src/app/admin/data/admin-modules.data.ts  |  42 ++-
 .../local-price-lists-page.component.html          | 391 +++++++++++++++++++++
 .../local-price-lists-page.component.ts            | 361 +++++++++++++++++++
 frontend/src/app/admin/rbac/admin-roles.ts         |   2 +
 .../src/app/admin/services/admin-api.service.ts    | 104 ++++++
 6 files changed, 900 insertions(+), 8 deletions(-)

## Diff

diff --git a/frontend/src/app/admin/admin.routes.ts b/frontend/src/app/admin/admin.routes.ts
index 90a0f9a..da1d31e 100644
--- a/frontend/src/app/admin/admin.routes.ts
+++ b/frontend/src/app/admin/admin.routes.ts
@@ -33,10 +33,11 @@ import { ProductCreatePageComponent } from './pages/inventory/product-create-pag
 import { ProductEditPageComponent } from './pages/inventory/product-edit-page.component';
 import { QuotationsPageComponent } from './pages/quotations/quotations-page.component';
 import { QuotationDetailPageComponent } from './pages/quotations/quotation-detail-page.component';
 import { QuotationCreatePageComponent } from './pages/quotations/quotation-create-page.component';
 import { QuotationPrintPageComponent } from './pages/quotations/quotation-print-page.component';
+import { LocalPriceListsPageComponent } from './pages/local-price-lists/local-price-lists-page.component';
 import { UserManagementPageComponent } from './pages/user-management/user-management-page.component';
 import { LeadGenerationPageComponent } from './pages/marketing/lead-generation-page.component';
 import { LeadProspectViewPageComponent } from './pages/marketing/lead-prospect-view-page.component';
 import { LeadProspectEditPageComponent } from './pages/marketing/lead-prospect-edit-page.component';
 import { LeadProspectUpdatePageComponent } from './pages/marketing/lead-prospect-update-page.component';
@@ -331,10 +332,17 @@ export const adminRoutes: Routes = [
         component: QuotationDetailPageComponent,
         title: 'Quotation Detail | PCMazing Admin',
         canActivate: [adminRoleGuard],
         data: { module: 'quotation' },
       },
+      {
+        path: 'local-price-lists',
+        component: LocalPriceListsPageComponent,
+        title: 'Local Price Lists | PCMazing Admin',
+        canActivate: [adminRoleGuard],
+        data: { module: 'local_price_lists' },
+      },
       {
         path: 'users',
         component: UserManagementPageComponent,
         title: 'User Management | PCMazing Admin',
         canActivate: [adminRoleGuard],
diff --git a/frontend/src/app/admin/data/admin-modules.data.ts b/frontend/src/app/admin/data/admin-modules.data.ts
index 42ef81d..1e8ffe6 100644
--- a/frontend/src/app/admin/data/admin-modules.data.ts
+++ b/frontend/src/app/admin/data/admin-modules.data.ts
@@ -95,10 +95,18 @@ export const ADMIN_MODULES: AdminModuleItem[] = [
     route: '/admin/quotations',
     description: 'Create and manage customer quotations.',
     status: 'active',
     referenceMenu: 'quotation',
   },
+  {
+    key: 'local_price_lists',
+    label: 'Local Price Lists',
+    route: '/admin/local-price-lists',
+    description: 'Maintain Cabanatuan store price lists for quotation parts search.',
+    status: 'active',
+    referenceMenu: 'quotation',
+  },
   {
     key: 'inventory',
     label: 'Inventory',
     route: '/admin/inventory',
     description: 'Material stock levels, purchase orders, and warehouse movement.',
@@ -211,13 +219,19 @@ export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
   },
   {
     key: 'sales_operations',
     title: 'Sales Operations',
     items: ADMIN_MODULES.filter((item) =>
-      ['sales_order', 'job_order', 'quotation', 'inventory', 'customers', 'company_expenses'].includes(
-        item.key,
-      ),
+      [
+        'sales_order',
+        'job_order',
+        'quotation',
+        'local_price_lists',
+        'inventory',
+        'customers',
+        'company_expenses',
+      ].includes(item.key),
     ),
   },
   {
     key: 'marketing',
     title: 'Marketing',
@@ -276,13 +290,19 @@ export function filterNavSectionsForRole(
       },
       {
         key: 'sales_operations',
         title: 'Sales Operations',
         items: ADMIN_MODULES.filter((item) =>
-          ['sales_order', 'job_order', 'quotation', 'inventory', 'customers', 'company_expenses'].includes(
-        item.key,
-      ),
+          [
+            'sales_order',
+            'job_order',
+            'quotation',
+            'local_price_lists',
+            'inventory',
+            'customers',
+            'company_expenses',
+          ].includes(item.key),
         ),
       },
       {
         key: 'marketing',
         title: 'Marketing',
@@ -336,12 +356,18 @@ export function filterNavSectionsForRole(
     (item) =>
       ['contact_inquiries', 'customer_reviews'].includes(item.key) && allowed.has(item.key),
   );
   const salesOps = ADMIN_MODULES.filter(
     (item) =>
-      ['sales_order', 'job_order', 'quotation', 'inventory', 'company_expenses'].includes(item.key) &&
-      allowed.has(item.key),
+      [
+        'sales_order',
+        'job_order',
+        'quotation',
+        'local_price_lists',
+        'inventory',
+        'company_expenses',
+      ].includes(item.key) && allowed.has(item.key),
   );
   if (salesHome.length) {
     sections.push({ key: 'sales_home', title: 'Sales', items: salesHome });
   }
   if (salesWebsite.length) {
diff --git a/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.html b/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.html
new file mode 100644
index 0000000..03fc82d
--- /dev/null
+++ b/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.html
@@ -0,0 +1,391 @@
+<section class="min-w-0 max-w-full">
+  <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
+    <div class="min-w-0">
+      <h2 class="text-2xl font-bold text-slate-900">Local Price Lists</h2>
+      <p class="mt-1 text-sm text-slate-500">
+        Maintain Cabanatuan store price lists used in quotation parts search. CSV import replaces all
+        items for the selected store.
+      </p>
+    </div>
+  </div>
+
+  @if (error()) {
+    <div class="mb-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
+      {{ error() }}
+    </div>
+  }
+  @if (success()) {
+    <div
+      class="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700"
+    >
+      {{ success() }}
+    </div>
+  }
+  @if (importMessage()) {
+    <div class="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
+      {{ importMessage() }}
+    </div>
+  }
+
+  <div class="grid min-w-0 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
+    <!-- Stores -->
+    <div class="min-w-0 space-y-4">
+      <form
+        class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
+        [formGroup]="storeForm"
+        (ngSubmit)="submitStore()"
+      >
+        <div class="flex items-start justify-between gap-3">
+          <div>
+            <h3 class="text-base font-bold text-slate-900">
+              @if (isEditingStore()) {
+                Edit Store
+              } @else {
+                Add Store
+              }
+            </h3>
+            <p class="mt-1 text-xs text-slate-500">Store name appears as the source label in parts search.</p>
+          </div>
+          @if (isEditingStore()) {
+            <button
+              type="button"
+              class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
+              (click)="cancelStoreEdit()"
+            >
+              Cancel
+            </button>
+          }
+        </div>
+
+        <div class="mt-4 space-y-4">
+          <div>
+            <label class="mb-2 block text-sm font-semibold text-slate-800">Store name *</label>
+            <input
+              type="text"
+              class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
+              formControlName="name"
+              placeholder="e.g. PC Hub Cabanatuan"
+            />
+          </div>
+          <div
+            class="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
+          >
+            <div>
+              <p class="text-sm font-semibold text-slate-800">Active</p>
+              <p class="text-xs text-slate-500">Inactive stores are excluded from parts search.</p>
+            </div>
+            <label class="relative inline-flex cursor-pointer items-center">
+              <input type="checkbox" class="peer sr-only" formControlName="active" />
+              <span
+                class="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-pcmazing-500"
+              ></span>
+              <span
+                class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5"
+              ></span>
+            </label>
+          </div>
+          <button
+            type="submit"
+            class="w-full rounded-xl bg-pcmazing-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-pcmazing-600 disabled:opacity-50"
+            [disabled]="savingStore()"
+          >
+            @if (savingStore()) {
+              Saving...
+            } @else if (isEditingStore()) {
+              Save Store
+            } @else {
+              Add Store
+            }
+          </button>
+        </div>
+      </form>
+
+      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
+        <div class="border-b border-slate-100 px-4 py-3">
+          <h3 class="text-sm font-bold text-slate-900">Stores</h3>
+        </div>
+        @if (loadingStores()) {
+          <div class="px-4 py-8 text-center text-sm text-slate-500">Loading stores...</div>
+        } @else if (stores().length === 0) {
+          <div class="px-4 py-8 text-center text-sm text-slate-500">No stores yet. Add one above.</div>
+        } @else {
+          <ul class="divide-y divide-slate-100">
+            @for (store of stores(); track store.id) {
+              <li>
+                <button
+                  type="button"
+                  class="flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition hover:bg-slate-50"
+                  [class.bg-pcmazing-50]="selectedStoreId() === store.id"
+                  [class.border-l-4]="selectedStoreId() === store.id"
+                  [class.border-pcmazing-500]="selectedStoreId() === store.id"
+                  (click)="selectStore(store.id)"
+                >
+                  <div class="min-w-0">
+                    <p class="truncate text-sm font-semibold text-slate-900">{{ store.name }}</p>
+                    <p class="mt-0.5 text-xs text-slate-500">
+                      @if (store.active) {
+                        Active
+                      } @else {
+                        Inactive
+                      }
+                    </p>
+                  </div>
+                  <span
+                    class="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase"
+                    [class.bg-emerald-50]="store.active"
+                    [class.text-emerald-700]="store.active"
+                    [class.bg-slate-100]="!store.active"
+                    [class.text-slate-500]="!store.active"
+                  >
+                    @if (store.active) {
+                      On
+                    } @else {
+                      Off
+                    }
+                  </span>
+                </button>
+                @if (selectedStoreId() === store.id) {
+                  <div class="flex gap-2 border-t border-slate-50 bg-slate-50/80 px-4 py-2">
+                    <button
+                      type="button"
+                      class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
+                      (click)="startEditStore(store)"
+                    >
+                      Edit
+                    </button>
+                    <button
+                      type="button"
+                      class="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-white"
+                      (click)="toggleStoreActive(store)"
+                    >
+                      @if (store.active) {
+                        Deactivate
+                      } @else {
+                        Activate
+                      }
+                    </button>
+                  </div>
+                }
+              </li>
+            }
+          </ul>
+        }
+      </div>
+    </div>
+
+    <!-- Items -->
+    <div class="min-w-0 space-y-4">
+      @if (selectedStore(); as store) {
+        <div
+          class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
+        >
+          <div class="min-w-0">
+            <h3 class="truncate text-lg font-bold text-slate-900">{{ store.name }}</h3>
+            <p class="mt-1 text-sm text-slate-500">
+              {{ items().length }} item(s)
+              @if (!store.active) {
+                ┬╖ inactive (hidden from search)
+              }
+            </p>
+          </div>
+          <div class="flex flex-wrap items-center gap-2">
+            <button
+              type="button"
+              class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
+              (click)="downloadImportTemplate()"
+            >
+              Download template
+            </button>
+            <button
+              type="button"
+              class="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
+              [disabled]="importLoading()"
+              (click)="importFileInput.click()"
+            >
+              @if (importLoading()) {
+                Importing...
+              } @else {
+                Import CSV
+              }
+            </button>
+            <input
+              #importFileInput
+              type="file"
+              accept=".csv,.txt,.tsv"
+              class="hidden"
+              (change)="onImportSelected($event)"
+            />
+          </div>
+        </div>
+
+        <form
+          class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
+          [formGroup]="itemForm"
+          (ngSubmit)="submitItem()"
+        >
+          <div class="flex items-start justify-between gap-3">
+            <div>
+              <h3 class="text-base font-bold text-slate-900">
+                @if (isEditingItem()) {
+                  Edit Item
+                } @else {
+                  Add Item
+                }
+              </h3>
+              <p class="mt-1 text-xs text-slate-500">
+                Columns: title and price required; SKU and notes optional.
+              </p>
+            </div>
+            @if (isEditingItem()) {
+              <button
+                type="button"
+                class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
+                (click)="cancelItemEdit()"
+              >
+                Cancel
+              </button>
+            }
+          </div>
+
+          <div class="mt-4 grid gap-4 sm:grid-cols-2">
+            <div class="sm:col-span-2">
+              <label class="mb-2 block text-sm font-semibold text-slate-800">Title *</label>
+              <input
+                type="text"
+                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
+                formControlName="title"
+                placeholder="e.g. Ryzen 5 5600"
+              />
+            </div>
+            <div>
+              <label class="mb-2 block text-sm font-semibold text-slate-800">Price (PHP) *</label>
+              <input
+                type="number"
+                min="0"
+                step="0.01"
+                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
+                formControlName="pricePhp"
+                placeholder="0.00"
+              />
+            </div>
+            <div>
+              <label class="mb-2 block text-sm font-semibold text-slate-800">SKU</label>
+              <input
+                type="text"
+                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
+                formControlName="sku"
+                placeholder="Optional"
+              />
+            </div>
+            <div class="sm:col-span-2">
+              <label class="mb-2 block text-sm font-semibold text-slate-800">Notes</label>
+              <textarea
+                rows="2"
+                class="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-pcmazing-500 focus:outline-none"
+                formControlName="notes"
+                placeholder="Optional notes"
+              ></textarea>
+            </div>
+          </div>
+
+          <div class="mt-4">
+            <button
+              type="submit"
+              class="rounded-xl bg-pcmazing-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-pcmazing-600 disabled:opacity-50"
+              [disabled]="savingItem()"
+            >
+              @if (savingItem()) {
+                Saving...
+              } @else if (isEditingItem()) {
+                Save Item
+              } @else {
+                Add Item
+              }
+            </button>
+          </div>
+        </form>
+
+        <div class="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
+          <div
+            class="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
+          >
+            <h3 class="text-sm font-bold text-slate-900">Items</h3>
+            <input
+              type="search"
+              class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-pcmazing-500 focus:outline-none sm:max-w-xs"
+              placeholder="Search title, SKU, notes..."
+              [value]="itemSearch()"
+              (input)="itemSearch.set($any($event.target).value)"
+            />
+          </div>
+
+          @if (loadingItems()) {
+            <div class="px-4 py-10 text-center text-sm text-slate-500">Loading items...</div>
+          } @else if (filteredItems().length === 0) {
+            <div class="px-4 py-10 text-center text-sm text-slate-500">
+              @if (items().length === 0) {
+                No items yet. Add one above or import a CSV.
+              } @else {
+                No items match your search.
+              }
+            </div>
+          } @else {
+            <div class="overflow-x-auto">
+              <table class="min-w-full text-left text-sm">
+                <thead class="bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
+                  <tr>
+                    <th class="px-4 py-3">Title</th>
+                    <th class="px-4 py-3">SKU</th>
+                    <th class="px-4 py-3 text-right">Price</th>
+                    <th class="px-4 py-3">Notes</th>
+                    <th class="px-4 py-3 text-right">Actions</th>
+                  </tr>
+                </thead>
+                <tbody class="divide-y divide-slate-100">
+                  @for (item of filteredItems(); track item.id) {
+                    <tr class="hover:bg-slate-50/80">
+                      <td class="max-w-[240px] px-4 py-3 font-medium text-slate-900">
+                        {{ item.title }}
+                      </td>
+                      <td class="px-4 py-3 text-slate-600">{{ item.sku || 'ΓÇö' }}</td>
+                      <td class="px-4 py-3 text-right font-semibold text-slate-900">
+                        Γé▒{{ formatMoney(item.pricePhp) }}
+                      </td>
+                      <td class="max-w-[200px] truncate px-4 py-3 text-slate-500">
+                        {{ item.notes || 'ΓÇö' }}
+                      </td>
+                      <td class="px-4 py-3 text-right">
+                        <div class="flex justify-end gap-2">
+                          <button
+                            type="button"
+                            class="rounded-lg px-2.5 py-1 text-xs font-semibold text-pcmazing-600 hover:bg-pcmazing-50"
+                            (click)="startEditItem(item)"
+                          >
+                            Edit
+                          </button>
+                          <button
+                            type="button"
+                            class="rounded-lg px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
+                            (click)="deleteItem(item)"
+                          >
+                            Delete
+                          </button>
+                        </div>
+                      </td>
+                    </tr>
+                  }
+                </tbody>
+              </table>
+            </div>
+          }
+        </div>
+      } @else {
+        <div
+          class="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500"
+        >
+          Select or create a store to manage its price list.
+        </div>
+      }
+    </div>
+  </div>
+</section>
diff --git a/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts b/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts
new file mode 100644
index 0000000..90369e9
--- /dev/null
+++ b/frontend/src/app/admin/pages/local-price-lists/local-price-lists-page.component.ts
@@ -0,0 +1,361 @@
+import { Component, computed, inject, OnInit, signal } from '@angular/core';
+import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
+import { firstValueFrom } from 'rxjs';
+import {
+  AdminApiService,
+  LocalPriceItem,
+  LocalPriceStore,
+} from '../../services/admin-api.service';
+
+@Component({
+  selector: 'app-local-price-lists-page',
+  imports: [ReactiveFormsModule],
+  templateUrl: './local-price-lists-page.component.html',
+})
+export class LocalPriceListsPageComponent implements OnInit {
+  private readonly adminApi = inject(AdminApiService);
+  private readonly formBuilder = inject(FormBuilder);
+
+  readonly loadingStores = signal(true);
+  readonly loadingItems = signal(false);
+  readonly savingStore = signal(false);
+  readonly savingItem = signal(false);
+  readonly importLoading = signal(false);
+  readonly error = signal('');
+  readonly success = signal('');
+  readonly importMessage = signal('');
+
+  readonly stores = signal<LocalPriceStore[]>([]);
+  readonly items = signal<LocalPriceItem[]>([]);
+  readonly selectedStoreId = signal<number | null>(null);
+  readonly editingStoreId = signal<number | null>(null);
+  readonly editingItemId = signal<number | null>(null);
+  readonly itemSearch = signal('');
+
+  readonly storeForm = this.formBuilder.nonNullable.group({
+    name: ['', [Validators.required, Validators.maxLength(200)]],
+    active: [true],
+  });
+
+  readonly itemForm = this.formBuilder.nonNullable.group({
+    title: ['', [Validators.required, Validators.maxLength(500)]],
+    pricePhp: [0, [Validators.required, Validators.min(0)]],
+    sku: ['', [Validators.maxLength(120)]],
+    notes: ['', [Validators.maxLength(2000)]],
+  });
+
+  readonly selectedStore = computed(() => {
+    const id = this.selectedStoreId();
+    if (id == null) {
+      return null;
+    }
+    return this.stores().find((store) => store.id === id) ?? null;
+  });
+
+  readonly isEditingStore = computed(() => this.editingStoreId() !== null);
+  readonly isEditingItem = computed(() => this.editingItemId() !== null);
+
+  readonly filteredItems = computed(() => {
+    const query = this.itemSearch().trim().toLowerCase();
+    if (!query) {
+      return this.items();
+    }
+    return this.items().filter(
+      (item) =>
+        item.title.toLowerCase().includes(query) ||
+        (item.sku || '').toLowerCase().includes(query) ||
+        (item.notes || '').toLowerCase().includes(query),
+    );
+  });
+
+  ngOnInit(): void {
+    void this.loadStores();
+  }
+
+  async loadStores(preferStoreId?: number | null): Promise<void> {
+    this.loadingStores.set(true);
+    this.error.set('');
+
+    try {
+      const response = await firstValueFrom(this.adminApi.listLocalPriceStores());
+      this.stores.set(response.data);
+
+      const preferred =
+        preferStoreId ?? this.selectedStoreId() ?? response.data[0]?.id ?? null;
+      if (preferred != null && response.data.some((store) => store.id === preferred)) {
+        await this.selectStore(preferred);
+      } else if (response.data.length === 0) {
+        this.selectedStoreId.set(null);
+        this.items.set([]);
+      } else {
+        await this.selectStore(response.data[0].id);
+      }
+    } catch {
+      this.error.set('Unable to load local price stores.');
+    } finally {
+      this.loadingStores.set(false);
+    }
+  }
+
+  async selectStore(storeId: number): Promise<void> {
+    const sameStore = this.selectedStoreId() === storeId;
+    this.selectedStoreId.set(storeId);
+    if (!sameStore) {
+      this.cancelItemEdit();
+      this.importMessage.set('');
+    }
+    if (!sameStore || this.items().length === 0) {
+      await this.loadItems(storeId);
+    }
+  }
+
+  async loadItems(storeId: number): Promise<void> {
+    this.loadingItems.set(true);
+    this.error.set('');
+
+    try {
+      const response = await firstValueFrom(this.adminApi.listLocalPriceItems(storeId));
+      this.items.set(response.data);
+    } catch {
+      this.error.set('Unable to load items for this store.');
+      this.items.set([]);
+    } finally {
+      this.loadingItems.set(false);
+    }
+  }
+
+  startEditStore(store: LocalPriceStore): void {
+    this.editingStoreId.set(store.id);
+    this.storeForm.reset({
+      name: store.name,
+      active: store.active,
+    });
+    this.error.set('');
+    this.success.set('');
+  }
+
+  cancelStoreEdit(): void {
+    this.editingStoreId.set(null);
+    this.storeForm.reset({ name: '', active: true });
+  }
+
+  async submitStore(): Promise<void> {
+    this.error.set('');
+    this.success.set('');
+
+    if (this.storeForm.invalid) {
+      this.storeForm.markAllAsTouched();
+      this.error.set('Store name is required.');
+      return;
+    }
+
+    this.savingStore.set(true);
+    try {
+      const value = this.storeForm.getRawValue();
+      const payload = {
+        name: value.name.trim(),
+        active: value.active,
+      };
+      const editId = this.editingStoreId();
+
+      if (editId != null) {
+        await firstValueFrom(this.adminApi.updateLocalPriceStore(editId, payload));
+        this.success.set(`Updated store "${payload.name}".`);
+        this.cancelStoreEdit();
+        await this.loadStores(editId);
+      } else {
+        const response = await firstValueFrom(this.adminApi.createLocalPriceStore(payload));
+        this.success.set(`Created store "${payload.name}".`);
+        this.cancelStoreEdit();
+        await this.loadStores(response.data.id);
+      }
+    } catch (err: unknown) {
+      this.error.set(this.readError(err, 'Unable to save store.'));
+    } finally {
+      this.savingStore.set(false);
+    }
+  }
+
+  async toggleStoreActive(store: LocalPriceStore): Promise<void> {
+    this.error.set('');
+    this.success.set('');
+    try {
+      await firstValueFrom(
+        this.adminApi.updateLocalPriceStore(store.id, { active: !store.active }),
+      );
+      this.success.set(
+        store.active ? `"${store.name}" deactivated.` : `"${store.name}" activated.`,
+      );
+      await this.loadStores(store.id);
+    } catch (err: unknown) {
+      this.error.set(this.readError(err, 'Unable to update store status.'));
+    }
+  }
+
+  startEditItem(item: LocalPriceItem): void {
+    this.editingItemId.set(item.id);
+    this.itemForm.reset({
+      title: item.title,
+      pricePhp: item.pricePhp,
+      sku: item.sku || '',
+      notes: item.notes || '',
+    });
+    this.error.set('');
+    this.success.set('');
+  }
+
+  cancelItemEdit(): void {
+    this.editingItemId.set(null);
+    this.itemForm.reset({ title: '', pricePhp: 0, sku: '', notes: '' });
+  }
+
+  async submitItem(): Promise<void> {
+    const storeId = this.selectedStoreId();
+    if (storeId == null) {
+      this.error.set('Select a store first.');
+      return;
+    }
+
+    this.error.set('');
+    this.success.set('');
+
+    if (this.itemForm.invalid) {
+      this.itemForm.markAllAsTouched();
+      this.error.set('Item title and price are required.');
+      return;
+    }
+
+    this.savingItem.set(true);
+    try {
+      const value = this.itemForm.getRawValue();
+      const payload = {
+        title: value.title.trim(),
+        pricePhp: Number(value.pricePhp) || 0,
+        sku: value.sku.trim() || null,
+        notes: value.notes.trim() || null,
+      };
+      const editId = this.editingItemId();
+
+      if (editId != null) {
+        await firstValueFrom(this.adminApi.updateLocalPriceItem(storeId, editId, payload));
+        this.success.set(`Updated item "${payload.title}".`);
+      } else {
+        await firstValueFrom(this.adminApi.createLocalPriceItem(storeId, payload));
+        this.success.set(`Added item "${payload.title}".`);
+      }
+
+      this.cancelItemEdit();
+      await this.loadItems(storeId);
+    } catch (err: unknown) {
+      this.error.set(this.readError(err, 'Unable to save item.'));
+    } finally {
+      this.savingItem.set(false);
+    }
+  }
+
+  async deleteItem(item: LocalPriceItem): Promise<void> {
+    const storeId = this.selectedStoreId();
+    if (storeId == null) {
+      return;
+    }
+
+    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
+      return;
+    }
+
+    this.error.set('');
+    this.success.set('');
+    try {
+      await firstValueFrom(this.adminApi.deleteLocalPriceItem(storeId, item.id));
+      if (this.editingItemId() === item.id) {
+        this.cancelItemEdit();
+      }
+      this.success.set(`Deleted "${item.title}".`);
+      await this.loadItems(storeId);
+    } catch (err: unknown) {
+      this.error.set(this.readError(err, 'Unable to delete item.'));
+    }
+  }
+
+  async downloadImportTemplate(): Promise<void> {
+    const storeId = this.selectedStoreId();
+    if (storeId == null) {
+      this.error.set('Select a store first.');
+      return;
+    }
+
+    this.error.set('');
+    try {
+      const blob = await firstValueFrom(this.adminApi.getLocalPriceListTemplate(storeId));
+      this.downloadBlob(blob, 'local-price-list-import-template.csv');
+    } catch {
+      this.error.set('Unable to download the import template.');
+    }
+  }
+
+  async onImportSelected(event: Event): Promise<void> {
+    const storeId = this.selectedStoreId();
+    const input = event.target as HTMLInputElement;
+    const file = input.files?.[0];
+    input.value = '';
+
+    if (!file || storeId == null) {
+      return;
+    }
+
+    const store = this.selectedStore();
+    const storeLabel = store?.name ?? 'this store';
+    if (!window.confirm(`Replace all items for this store?\n\n"${storeLabel}" will lose its current list and be replaced by the CSV.`)) {
+      return;
+    }
+
+    this.importLoading.set(true);
+    this.error.set('');
+    this.importMessage.set('');
+    this.success.set('');
+
+    try {
+      const response = await firstValueFrom(
+        this.adminApi.importLocalPriceListCsv(storeId, file),
+      );
+      this.importMessage.set(
+        response.message ||
+          `${response.data.imported} item(s) imported (store list replaced).`,
+      );
+      this.cancelItemEdit();
+      await this.loadItems(storeId);
+    } catch (err: unknown) {
+      this.error.set(this.readError(err, 'Import failed. Fix the file and try again.'));
+    } finally {
+      this.importLoading.set(false);
+    }
+  }
+
+  formatMoney(value: number | null | undefined): string {
+    if (value == null || Number.isNaN(Number(value))) {
+      return 'ΓÇö';
+    }
+    return Number(value).toLocaleString('en-PH', {
+      minimumFractionDigits: 2,
+      maximumFractionDigits: 2,
+    });
+  }
+
+  private downloadBlob(blob: Blob, filename: string): void {
+    const url = URL.createObjectURL(blob);
+    const anchor = document.createElement('a');
+    anchor.href = url;
+    anchor.download = filename;
+    anchor.click();
+    URL.revokeObjectURL(url);
+  }
+
+  private readError(err: unknown, fallback: string): string {
+    const httpErr = err as { error?: { message?: string | string[] } };
+    const msg = httpErr?.error?.message;
+    if (Array.isArray(msg)) {
+      return msg.join(', ');
+    }
+    return msg || fallback;
+  }
+}
diff --git a/frontend/src/app/admin/rbac/admin-roles.ts b/frontend/src/app/admin/rbac/admin-roles.ts
index 10a9ed1..fc11a81 100644
--- a/frontend/src/app/admin/rbac/admin-roles.ts
+++ b/frontend/src/app/admin/rbac/admin-roles.ts
@@ -25,10 +25,11 @@ export type AdminModuleKey =
   | 'customer_reviews'
   | 'demo_requests'
   | 'sales_order'
   | 'job_order'
   | 'quotation'
+  | 'local_price_lists'
   | 'inventory'
   | 'customers'
   | 'company_expenses'
   | 'lead_generation'
   | 'organization_team'
@@ -197,10 +198,11 @@ export function getAllowedModuleKeys(role?: string | null): Set<AdminModuleKey>
       'contact_inquiries',
       'customer_reviews',
       'sales_order',
       'job_order',
       'quotation',
+      'local_price_lists',
       'inventory',
       'company_expenses',
       'profile',
       'time_clock',
     ]);
diff --git a/frontend/src/app/admin/services/admin-api.service.ts b/frontend/src/app/admin/services/admin-api.service.ts
index b0247ee..e3a5feb 100644
--- a/frontend/src/app/admin/services/admin-api.service.ts
+++ b/frontend/src/app/admin/services/admin-api.service.ts
@@ -633,10 +633,29 @@ export interface PartsPriceSearchResult {
   query: string;
   items: PartsPriceHit[];
   sourceErrors: PartsPriceSourceError[];
 }
 
+export interface LocalPriceStore {
+  id: number;
+  name: string;
+  active: boolean;
+  createdAt: string | null;
+  updatedAt: string | null;
+}
+
+export interface LocalPriceItem {
+  id: number;
+  storeId: number;
+  title: string;
+  sku: string | null;
+  pricePhp: number;
+  notes: string | null;
+  createdAt: string | null;
+  updatedAt: string | null;
+}
+
 export interface AdminUser {
   id: number;
   username: string;
   fullName: string;
   email: string | null;
@@ -1968,10 +1987,95 @@ export class AdminApiService {
       `${APP_CONFIG.apiUrl}/admin/parts-price-search`,
       { headers: this.headers(), params },
     );
   }
 
+  listLocalPriceStores() {
+    return this.http.get<ItemResponse<LocalPriceStore[]>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores`,
+      { headers: this.headers() },
+    );
+  }
+
+  createLocalPriceStore(payload: { name: string; active?: boolean }) {
+    return this.http.post<MessageResponse<LocalPriceStore>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores`,
+      payload,
+      { headers: this.headers() },
+    );
+  }
+
+  updateLocalPriceStore(id: number, payload: { name?: string; active?: boolean }) {
+    return this.http.patch<MessageResponse<LocalPriceStore>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${id}`,
+      payload,
+      { headers: this.headers() },
+    );
+  }
+
+  listLocalPriceItems(storeId: number) {
+    return this.http.get<ItemResponse<LocalPriceItem[]>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items`,
+      { headers: this.headers() },
+    );
+  }
+
+  createLocalPriceItem(
+    storeId: number,
+    payload: { title: string; pricePhp: number; sku?: string | null; notes?: string | null },
+  ) {
+    return this.http.post<MessageResponse<LocalPriceItem>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items`,
+      payload,
+      { headers: this.headers() },
+    );
+  }
+
+  updateLocalPriceItem(
+    storeId: number,
+    itemId: number,
+    payload: {
+      title?: string;
+      pricePhp?: number;
+      sku?: string | null;
+      notes?: string | null;
+    },
+  ) {
+    return this.http.patch<MessageResponse<LocalPriceItem>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items/${itemId}`,
+      payload,
+      { headers: this.headers() },
+    );
+  }
+
+  deleteLocalPriceItem(storeId: number, itemId: number) {
+    return this.http.delete<{ success: boolean; message?: string }>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items/${itemId}`,
+      { headers: this.headers() },
+    );
+  }
+
+  getLocalPriceListTemplate(storeId: number) {
+    return this.http.get(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items/import/template`,
+      {
+        headers: this.headers(),
+        responseType: 'blob',
+      },
+    );
+  }
+
+  importLocalPriceListCsv(storeId: number, file: File) {
+    const formData = new FormData();
+    formData.append('file', file);
+    return this.http.post<MessageResponse<{ imported: number }>>(
+      `${APP_CONFIG.apiUrl}/admin/local-price-stores/${storeId}/items/import`,
+      formData,
+      { headers: this.headers() },
+    );
+  }
+
   getDashboardOverview(options: {
     period?: DashboardPeriod;
     startDate?: string;
     endDate?: string;
   } = {}) {
