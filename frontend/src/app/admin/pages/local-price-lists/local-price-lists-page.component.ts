import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  LocalPriceItem,
  LocalPriceStore,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-local-price-lists-page',
  imports: [ReactiveFormsModule],
  templateUrl: './local-price-lists-page.component.html',
})
export class LocalPriceListsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly loadingStores = signal(true);
  readonly loadingItems = signal(false);
  readonly savingStore = signal(false);
  readonly savingItem = signal(false);
  readonly importLoading = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly importMessage = signal('');

  readonly stores = signal<LocalPriceStore[]>([]);
  readonly items = signal<LocalPriceItem[]>([]);
  readonly selectedStoreId = signal<number | null>(null);
  readonly editingStoreId = signal<number | null>(null);
  readonly editingItemId = signal<number | null>(null);
  readonly itemSearch = signal('');

  readonly storeForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    active: [true],
  });

  readonly itemForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(500)]],
    pricePhp: [0, [Validators.required, Validators.min(0)]],
    sku: ['', [Validators.maxLength(120)]],
    notes: ['', [Validators.maxLength(2000)]],
  });

  readonly selectedStore = computed(() => {
    const id = this.selectedStoreId();
    if (id == null) {
      return null;
    }
    return this.stores().find((store) => store.id === id) ?? null;
  });

  readonly isEditingStore = computed(() => this.editingStoreId() !== null);
  readonly isEditingItem = computed(() => this.editingItemId() !== null);

  readonly filteredItems = computed(() => {
    const query = this.itemSearch().trim().toLowerCase();
    if (!query) {
      return this.items();
    }
    return this.items().filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        (item.sku || '').toLowerCase().includes(query) ||
        (item.notes || '').toLowerCase().includes(query),
    );
  });

  ngOnInit(): void {
    void this.loadStores();
  }

  async loadStores(preferStoreId?: number | null): Promise<void> {
    this.loadingStores.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.listLocalPriceStores());
      this.stores.set(response.data);

      const preferred =
        preferStoreId ?? this.selectedStoreId() ?? response.data[0]?.id ?? null;
      if (preferred != null && response.data.some((store) => store.id === preferred)) {
        await this.selectStore(preferred);
      } else if (response.data.length === 0) {
        this.selectedStoreId.set(null);
        this.items.set([]);
      } else {
        await this.selectStore(response.data[0].id);
      }
    } catch {
      this.error.set('Unable to load local price stores.');
    } finally {
      this.loadingStores.set(false);
    }
  }

  async selectStore(storeId: number): Promise<void> {
    const sameStore = this.selectedStoreId() === storeId;
    this.selectedStoreId.set(storeId);
    if (!sameStore) {
      this.cancelItemEdit();
      this.importMessage.set('');
    }
    if (!sameStore || this.items().length === 0) {
      await this.loadItems(storeId);
    }
  }

  async loadItems(storeId: number): Promise<void> {
    this.loadingItems.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.listLocalPriceItems(storeId));
      this.items.set(response.data);
    } catch {
      this.error.set('Unable to load items for this store.');
      this.items.set([]);
    } finally {
      this.loadingItems.set(false);
    }
  }

  startEditStore(store: LocalPriceStore): void {
    this.editingStoreId.set(store.id);
    this.storeForm.reset({
      name: store.name,
      active: store.active,
    });
    this.error.set('');
    this.success.set('');
  }

  cancelStoreEdit(): void {
    this.editingStoreId.set(null);
    this.storeForm.reset({ name: '', active: true });
  }

  async submitStore(): Promise<void> {
    this.error.set('');
    this.success.set('');

    if (this.storeForm.invalid) {
      this.storeForm.markAllAsTouched();
      this.error.set('Store name is required.');
      return;
    }

    this.savingStore.set(true);
    try {
      const value = this.storeForm.getRawValue();
      const payload = {
        name: value.name.trim(),
        active: value.active,
      };
      const editId = this.editingStoreId();

      if (editId != null) {
        await firstValueFrom(this.adminApi.updateLocalPriceStore(editId, payload));
        this.success.set(`Updated store "${payload.name}".`);
        this.cancelStoreEdit();
        await this.loadStores(editId);
      } else {
        const response = await firstValueFrom(this.adminApi.createLocalPriceStore(payload));
        this.success.set(`Created store "${payload.name}".`);
        this.cancelStoreEdit();
        await this.loadStores(response.data.id);
      }
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to save store.'));
    } finally {
      this.savingStore.set(false);
    }
  }

  async toggleStoreActive(store: LocalPriceStore): Promise<void> {
    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(
        this.adminApi.updateLocalPriceStore(store.id, { active: !store.active }),
      );
      this.success.set(
        store.active ? `"${store.name}" deactivated.` : `"${store.name}" activated.`,
      );
      await this.loadStores(store.id);
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to update store status.'));
    }
  }

  startEditItem(item: LocalPriceItem): void {
    this.editingItemId.set(item.id);
    this.itemForm.reset({
      title: item.title,
      pricePhp: item.pricePhp,
      sku: item.sku || '',
      notes: item.notes || '',
    });
    this.error.set('');
    this.success.set('');
  }

  cancelItemEdit(): void {
    this.editingItemId.set(null);
    this.itemForm.reset({ title: '', pricePhp: 0, sku: '', notes: '' });
  }

  async submitItem(): Promise<void> {
    const storeId = this.selectedStoreId();
    if (storeId == null) {
      this.error.set('Select a store first.');
      return;
    }

    this.error.set('');
    this.success.set('');

    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      this.error.set('Item title and price are required.');
      return;
    }

    this.savingItem.set(true);
    try {
      const value = this.itemForm.getRawValue();
      const payload = {
        title: value.title.trim(),
        pricePhp: Number(value.pricePhp) || 0,
        sku: value.sku.trim() || null,
        notes: value.notes.trim() || null,
      };
      const editId = this.editingItemId();

      if (editId != null) {
        await firstValueFrom(this.adminApi.updateLocalPriceItem(storeId, editId, payload));
        this.success.set(`Updated item "${payload.title}".`);
      } else {
        await firstValueFrom(this.adminApi.createLocalPriceItem(storeId, payload));
        this.success.set(`Added item "${payload.title}".`);
      }

      this.cancelItemEdit();
      await this.loadItems(storeId);
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to save item.'));
    } finally {
      this.savingItem.set(false);
    }
  }

  async deleteItem(item: LocalPriceItem): Promise<void> {
    const storeId = this.selectedStoreId();
    if (storeId == null) {
      return;
    }

    if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) {
      return;
    }

    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(this.adminApi.deleteLocalPriceItem(storeId, item.id));
      if (this.editingItemId() === item.id) {
        this.cancelItemEdit();
      }
      this.success.set(`Deleted "${item.title}".`);
      await this.loadItems(storeId);
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Unable to delete item.'));
    }
  }

  async downloadImportTemplate(): Promise<void> {
    const storeId = this.selectedStoreId();
    if (storeId == null) {
      this.error.set('Select a store first.');
      return;
    }

    this.error.set('');
    try {
      const blob = await firstValueFrom(this.adminApi.getLocalPriceListTemplate(storeId));
      this.downloadBlob(blob, 'local-price-list-import-template.csv');
    } catch {
      this.error.set('Unable to download the import template.');
    }
  }

  async onImportSelected(event: Event): Promise<void> {
    const storeId = this.selectedStoreId();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file || storeId == null) {
      return;
    }

    const store = this.selectedStore();
    const storeLabel = store?.name ?? 'this store';
    if (!window.confirm(`Replace all items for this store?\n\n"${storeLabel}" will lose its current list and be replaced by the CSV.`)) {
      return;
    }

    this.importLoading.set(true);
    this.error.set('');
    this.importMessage.set('');
    this.success.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.importLocalPriceListCsv(storeId, file),
      );
      this.importMessage.set(
        response.message ||
          `${response.data.imported} item(s) imported (store list replaced).`,
      );
      this.cancelItemEdit();
      await this.loadItems(storeId);
    } catch (err: unknown) {
      this.error.set(this.readError(err, 'Import failed. Fix the file and try again.'));
    } finally {
      this.importLoading.set(false);
    }
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    return Number(value).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private readError(err: unknown, fallback: string): string {
    const httpErr = err as { error?: { message?: string | string[] } };
    const msg = httpErr?.error?.message;
    if (Array.isArray(msg)) {
      return msg.join(', ');
    }
    return msg || fallback;
  }
}
