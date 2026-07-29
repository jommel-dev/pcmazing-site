import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryServiceFilterOption,
  InventoryServiceItem,
  InventoryServiceSummary,
  PaginationMeta,
} from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';
import { formatInventoryMoney } from './inventory-stock.util';

type ServiceColumnKey =
  | 'image'
  | 'customer'
  | 'serviceName'
  | 'personInCharge'
  | 'type'
  | 'partsUsed'
  | 'interval'
  | 'cost'
  | 'labor'
  | 'totalCosting'
  | 'totalSales';

@Component({
  selector: 'app-inventory-services-page',
  imports: [FormsModule, RouterLink, InventorySubnavComponent],
  templateUrl: './inventory-services-page.component.html',
})
export class InventoryServicesPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = 50;
  readonly items = signal<InventoryServiceItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly summary = signal<InventoryServiceSummary | null>(null);
  readonly serviceTypes = signal<InventoryServiceFilterOption[]>([]);
  readonly statuses = signal<InventoryServiceFilterOption[]>([]);
  readonly selectedType = signal('');
  readonly selectedStatus = signal('');
  readonly columnOptions: Array<{ key: ServiceColumnKey; label: string }> = [
    { key: 'image', label: 'Image' },
    { key: 'customer', label: 'Customer' },
    { key: 'serviceName', label: 'Service Name' },
    { key: 'personInCharge', label: 'Person In Charge' },
    { key: 'type', label: 'Type' },
    { key: 'partsUsed', label: 'Parts Used' },
    { key: 'interval', label: 'Interval' },
    { key: 'cost', label: 'Cost' },
    { key: 'labor', label: 'Labor' },
    { key: 'totalCosting', label: 'T.Costing' },
    { key: 'totalSales', label: 'T.Sales' },
  ];
  readonly visibleColumns = signal<Record<ServiceColumnKey, boolean>>({
    image: true,
    customer: true,
    serviceName: true,
    personInCharge: true,
    type: true,
    partsUsed: true,
    interval: true,
    cost: true,
    labor: true,
    totalCosting: true,
    totalSales: true,
  });

  readonly formatMoney = formatInventoryMoney;

  ngOnInit(): void {
    void this.loadServices();
  }

  async loadServices(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listInventoryServices(
          this.page(),
          this.pageSize,
          this.search(),
          this.selectedType(),
          this.selectedStatus(),
        ),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
      this.summary.set(response.summary);
      this.serviceTypes.set(response.filters.types);
      this.statuses.set(response.filters.statuses);
    } catch {
      this.error.set('Unable to load service catalog.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchServices(): Promise<void> {
    this.page.set(1);
    await this.loadServices();
  }

  async filterByType(type: string): Promise<void> {
    this.selectedType.set(type);
    this.page.set(1);
    await this.loadServices();
  }

  async filterByStatus(status: string): Promise<void> {
    this.selectedStatus.set(status);
    this.page.set(1);
    await this.loadServices();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.loadServices();
  }

  sectionTitle(): string {
    const count = this.summary()?.itemCount ?? this.meta()?.total ?? 0;
    const typeLabel = this.selectedType() || 'All Types';
    const statusLabel = this.selectedStatus() || 'All Statuses';
    return `${typeLabel} · ${statusLabel} (${count} services)`;
  }

  imageAlt(item: InventoryServiceItem): string {
    return item.serviceName || 'Service image';
  }

  serviceImageUrl(item: InventoryServiceItem): string | null {
    return this.adminApi.resolveServiceImageUrl(item.imageUrl);
  }

  partsUsedLabel(item: InventoryServiceItem): string {
    return item.partsUsed.length ? item.partsUsed.join(', ') : 'No parts linked';
  }

  columnVisible(key: ServiceColumnKey): boolean {
    return this.visibleColumns()[key];
  }

  toggleColumn(key: ServiceColumnKey): void {
    this.visibleColumns.update((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  statusPillClass(status: string): string {
    switch (status.trim().toLowerCase()) {
      case 'done':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  }

  serviceIntervalLabel(item: InventoryServiceItem): string {
    const start = this.formatDateTime(item.startedAt);
    const end = this.formatDateTime(item.endedAt);

    if (start && end) {
      return `${start} -> ${end}`;
    }

    return start || end || 'Not scheduled';
  }

  serviceDurationLabel(item: InventoryServiceItem): string {
    const minutes = item.durationMinutes;
    if (minutes == null) {
      return 'Duration pending';
    }

    if (minutes < 60) {
      return `${minutes} min`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  private formatDateTime(value: string | null): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}
