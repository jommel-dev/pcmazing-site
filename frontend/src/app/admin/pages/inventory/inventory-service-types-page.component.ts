import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ServiceTypeItem } from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';
import { formatInventoryMoney } from './inventory-stock.util';

@Component({
  selector: 'app-inventory-service-types-page',
  imports: [ReactiveFormsModule, InventorySubnavComponent],
  templateUrl: './inventory-service-types-page.component.html',
})
export class InventoryServiceTypesPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly success = signal('');
  readonly items = signal<ServiceTypeItem[]>([]);
  readonly editingId = signal<number | null>(null);
  readonly search = signal('');
  readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  readonly usageFilter = signal<'all' | 'used' | 'unused'>('all');
  readonly formatMoney = formatInventoryMoney;

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: ['', [Validators.maxLength(2000)]],
    laborPrice: [0, [Validators.required, Validators.min(0)]],
    isActive: [true],
  });

  readonly isEditing = computed(() => this.editingId() !== null);

  readonly filteredItems = computed(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const usage = this.usageFilter();

    return this.items().filter((item) => {
      if (status === 'active' && !item.isActive) {
        return false;
      }
      if (status === 'inactive' && item.isActive) {
        return false;
      }
      if (usage === 'used' && !(item.usageCount > 0)) {
        return false;
      }
      if (usage === 'unused' && item.usageCount > 0) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query)
      );
    });
  });

  readonly hasActiveFilters = computed(
    () =>
      this.search().trim().length > 0 ||
      this.statusFilter() !== 'all' ||
      this.usageFilter() !== 'all',
  );

  readonly totals = computed(() => {
    const rows = this.items();
    return {
      types: rows.length,
      usage: rows.reduce((sum, item) => sum + (item.usageCount || 0), 0),
      laborCollected: rows.reduce((sum, item) => sum + (item.totalLaborCollected || 0), 0),
    };
  });

  readonly pendingDelete = signal<ServiceTypeItem | null>(null);
  readonly deleting = signal(false);

  ngOnInit(): void {
    void this.loadTypes();
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('all');
    this.usageFilter.set('all');
  }

  setStatusFilter(value: string): void {
    if (value === 'active' || value === 'inactive' || value === 'all') {
      this.statusFilter.set(value);
    }
  }

  setUsageFilter(value: string): void {
    if (value === 'used' || value === 'unused' || value === 'all') {
      this.usageFilter.set(value);
    }
  }

  async loadTypes(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.listServiceTypes(false));
      this.items.set(response.data);
    } catch {
      this.error.set('Unable to load service types.');
    } finally {
      this.loading.set(false);
    }
  }

  startEdit(item: ServiceTypeItem): void {
    this.formError.set('');
    this.success.set('');
    this.editingId.set(item.id);
    this.form.reset({
      name: item.name,
      description: item.description || '',
      laborPrice: item.laborPrice || 0,
      isActive: item.isActive,
    });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '', laborPrice: 0, isActive: true });
    this.formError.set('');
  }

  async submit(): Promise<void> {
    this.formError.set('');
    this.success.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fill in the required fields.');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      const payload = {
        name: value.name.trim(),
        description: value.description.trim(),
        laborPrice: Number(value.laborPrice) || 0,
        isActive: value.isActive,
      };
      const editId = this.editingId();

      if (editId !== null) {
        await firstValueFrom(this.adminApi.updateServiceType(editId, payload));
        this.success.set(`Updated "${payload.name}".`);
      } else {
        await firstValueFrom(this.adminApi.createServiceType(payload));
        this.success.set('Service type added.');
      }

      this.cancelEdit();
      await this.loadTypes();
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(
        this.isEditing()
          ? `Unable to update service type: ${detail}`
          : `Unable to add service type: ${detail}`,
      );
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(item: ServiceTypeItem): Promise<void> {
    this.formError.set('');
    this.success.set('');

    try {
      await firstValueFrom(
        this.adminApi.updateServiceType(item.id, { isActive: !item.isActive }),
      );
      if (this.editingId() === item.id) {
        this.form.controls.isActive.setValue(!item.isActive);
      }
      await this.loadTypes();
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(`Unable to update service type status: ${detail}`);
    }
  }

  requestRemove(item: ServiceTypeItem): void {
    this.formError.set('');
    this.success.set('');
    this.pendingDelete.set(item);
  }

  cancelRemove(): void {
    if (this.deleting()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  async confirmRemove(): Promise<void> {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }

    this.deleting.set(true);
    this.formError.set('');
    this.success.set('');

    try {
      await firstValueFrom(this.adminApi.deleteServiceType(item.id));
      this.pendingDelete.set(null);
      if (this.editingId() === item.id) {
        this.cancelEdit();
      }
      this.success.set('Service type deleted.');
      await this.loadTypes();
    } catch {
      this.formError.set('Unable to delete service type.');
      this.pendingDelete.set(null);
    } finally {
      this.deleting.set(false);
    }
  }
}
