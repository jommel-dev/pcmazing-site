import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
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

type ServiceSortKey =
  | 'referenceNo'
  | 'customer'
  | 'serviceName'
  | 'personInCharge'
  | 'type'
  | 'interval'
  | 'cost'
  | 'labor'
  | 'totalCosting'
  | 'totalSales'
  | 'status';

type ActionToast = {
  id: number;
  type: 'success' | 'error';
  message: string;
};

@Component({
  selector: 'app-inventory-services-page',
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './inventory-services-page.component.html',
  styles: [
    `
      .job-toast {
        opacity: 0;
        transform: translate3d(18px, -10px, 0) scale(0.96);
        transition:
          opacity 220ms ease,
          transform 280ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      .job-toast.is-visible {
        opacity: 1;
        transform: translate3d(0, 0, 0) scale(1);
      }

      .job-toast.is-leaving {
        opacity: 0;
        transform: translate3d(14px, -8px, 0) scale(0.97);
        transition:
          opacity 200ms ease,
          transform 200ms ease;
      }

      .job-toast-progress {
        transform-origin: left center;
        animation: job-toast-progress 3.2s linear forwards;
      }

      @keyframes job-toast-progress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }
    `,
  ],
})
export class InventoryServicesPageComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private toastHideTimer: ReturnType<typeof setTimeout> | null = null;
  private toastClearTimer: ReturnType<typeof setTimeout> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private toastSeq = 0;
  private readonly toastDurationMs = 3200;
  private readonly toastExitMs = 220;
  private readonly searchDebounceMs = 300;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly pageSizeOptions = [10, 25, 50] as const;
  readonly sortBy = signal<ServiceSortKey>('referenceNo');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
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
    interval: false,
    cost: false,
    labor: false,
    totalCosting: false,
    totalSales: true,
  });

  readonly formatMoney = formatInventoryMoney;
  readonly statusOptions = ['Active', 'Pending', 'Cancelled', 'Done'] as const;
  readonly pendingDelete = signal<InventoryServiceItem | null>(null);
  readonly deleting = signal(false);
  readonly statusUpdatingId = signal<number | null>(null);
  readonly toast = signal<ActionToast | null>(null);
  readonly toastVisible = signal(false);
  readonly toastLeaving = signal(false);
  readonly pendingStatusChange = signal<{
    item: InventoryServiceItem;
    nextStatus: string;
  } | null>(null);
  readonly completionUpload = signal<{
    item: InventoryServiceItem;
  } | null>(null);
  readonly completionPreviewUrl = signal<string | null>(null);
  readonly completionFile = signal<File | null>(null);
  readonly completionError = signal('');
  readonly completionSaving = signal(false);
  readonly isMobileDevice = signal(false);

  ngOnInit(): void {
    this.isMobileDevice.set(this.detectMobileDevice());
    void this.loadServices();
  }

  ngOnDestroy(): void {
    this.clearToastTimers();
    this.clearSearchDebounce();
  }

  showToast(type: 'success' | 'error', message: string): void {
    this.clearToastTimers();
    this.toastLeaving.set(false);
    this.toastVisible.set(false);
    this.toast.set({ id: ++this.toastSeq, type, message });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.toastVisible.set(true));
    });

    this.toastHideTimer = setTimeout(() => this.dismissToast(), this.toastDurationMs);
  }

  dismissToast(): void {
    if (!this.toast() || this.toastLeaving()) {
      return;
    }

    this.clearToastTimers();
    this.toastLeaving.set(true);
    this.toastVisible.set(false);
    this.toastClearTimer = setTimeout(() => {
      this.toast.set(null);
      this.toastLeaving.set(false);
    }, this.toastExitMs);
  }

  private clearToastTimers(): void {
    if (this.toastHideTimer) {
      clearTimeout(this.toastHideTimer);
      this.toastHideTimer = null;
    }
    if (this.toastClearTimer) {
      clearTimeout(this.toastClearTimer);
      this.toastClearTimer = null;
    }
  }

  private detectMobileDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    return coarsePointer || mobileUa;
  }

  async loadServices(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listInventoryServices(
          this.page(),
          this.pageSize(),
          this.search(),
          this.selectedType(),
          this.selectedStatus(),
          this.sortBy(),
          this.sortDir(),
        ),
      );
      this.items.set(response.data.map((item) => this.withNormalizedStatus(item)));
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
    this.clearSearchDebounce();
    this.page.set(1);
    await this.loadServices();
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    this.clearSearchDebounce();
    this.searchDebounceTimer = setTimeout(() => {
      this.searchDebounceTimer = null;
      this.page.set(1);
      void this.loadServices();
    }, this.searchDebounceMs);
  }

  private clearSearchDebounce(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
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

  async changePageSize(size: number): Promise<void> {
    this.pageSize.set(size);
    this.page.set(1);
    await this.loadServices();
  }

  async toggleSort(key: ServiceSortKey): Promise<void> {
    if (this.sortBy() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(key);
      this.sortDir.set('asc');
    }
    this.page.set(1);
    await this.loadServices();
  }

  sortIndicator(key: ServiceSortKey): string {
    if (this.sortBy() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
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
    switch (this.normalizeJobStatus(status).toLowerCase()) {
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

  normalizeJobStatus(status: string | null | undefined): string {
    const value = String(status ?? '').trim().toLowerCase();
    const match = this.statusOptions.find((option) => option.toLowerCase() === value);
    return match ?? 'Active';
  }

  private withNormalizedStatus(item: InventoryServiceItem): InventoryServiceItem {
    return {
      ...item,
      status: this.normalizeJobStatus(item.status),
    };
  }

  onStatusChange(item: InventoryServiceItem, status: string): void {
    const currentStatus = this.normalizeJobStatus(item.status);
    const nextStatus = this.normalizeJobStatus(status);
    if (!nextStatus || nextStatus === currentStatus) {
      return;
    }

    this.pendingStatusChange.set({ item, nextStatus });
  }

  cancelStatusChange(): void {
    if (this.statusUpdatingId() !== null || this.completionSaving()) {
      return;
    }
    this.pendingStatusChange.set(null);
  }

  async confirmStatusChange(): Promise<void> {
    const pending = this.pendingStatusChange();
    if (!pending) {
      return;
    }

    this.pendingStatusChange.set(null);

    if (pending.nextStatus === 'Done') {
      this.openCompletionUpload(pending.item);
      return;
    }

    await this.applyStatusChange(pending.item, pending.nextStatus);
  }

  openCompletionUpload(item: InventoryServiceItem): void {
    this.clearCompletionPreview();
    this.completionError.set('');
    this.completionFile.set(null);
    this.completionUpload.set({ item });
  }

  cancelCompletionUpload(): void {
    if (this.completionSaving()) {
      return;
    }
    this.clearCompletionPreview();
    this.completionUpload.set(null);
    this.completionFile.set(null);
    this.completionError.set('');
  }

  onCompletionFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.completionError.set('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.completionError.set('Image must be 2MB or smaller.');
      return;
    }

    this.clearCompletionPreview();
    this.completionError.set('');
    this.completionFile.set(file);
    this.completionPreviewUrl.set(URL.createObjectURL(file));
  }

  private clearCompletionPreview(): void {
    const current = this.completionPreviewUrl();
    if (current) {
      URL.revokeObjectURL(current);
    }
    this.completionPreviewUrl.set(null);
  }

  async confirmCompletionUpload(): Promise<void> {
    const pending = this.completionUpload();
    const file = this.completionFile();
    if (!pending) {
      return;
    }
    if (!file) {
      this.completionError.set('Please add a completion image before marking this job as Done.');
      return;
    }

    this.completionSaving.set(true);
    this.completionError.set('');

    try {
      const imageResponse = await firstValueFrom(
        this.adminApi.uploadInventoryServiceImage(pending.item.id, file),
      );
      const statusResponse = await firstValueFrom(
        this.adminApi.updateInventoryServiceStatus(pending.item.id, 'Done'),
      );

      this.applyLocalStatusUpdate({
        ...pending.item,
        ...imageResponse.data,
        status: this.normalizeJobStatus(statusResponse.data.status),
        imageUrl: imageResponse.data.imageUrl ?? statusResponse.data.imageUrl,
      });

      this.clearCompletionPreview();
      this.completionUpload.set(null);
      this.completionFile.set(null);
      this.showToast('success', 'Job marked as Done with completion image.');
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.completionError.set(`Unable to complete job order: ${detail}`);
    } finally {
      this.completionSaving.set(false);
    }
  }

  private async applyStatusChange(item: InventoryServiceItem, status: string): Promise<void> {
    this.statusUpdatingId.set(item.id);

    try {
      const response = await firstValueFrom(
        this.adminApi.updateInventoryServiceStatus(item.id, status),
      );
      this.applyLocalStatusUpdate({
        ...item,
        ...response.data,
        status: this.normalizeJobStatus(response.data.status),
        imageUrl: response.data.imageUrl ?? null,
      });
      const clearedImage =
        this.normalizeJobStatus(item.status) === 'Done' &&
        this.normalizeJobStatus(response.data.status) !== 'Done';
      this.showToast(
        'success',
        clearedImage
          ? `Status updated to ${this.normalizeJobStatus(response.data.status)}. Completion image removed.`
          : `Status updated to ${this.normalizeJobStatus(response.data.status)}.`,
      );
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.showToast('error', `Unable to update status: ${detail}`);
    } finally {
      this.statusUpdatingId.set(null);
    }
  }

  private applyLocalStatusUpdate(item: InventoryServiceItem): void {
    const normalized = this.withNormalizedStatus(item);
    const selected = this.selectedStatus();
    if (selected && selected.toLowerCase() !== normalized.status.toLowerCase()) {
      this.items.update((rows) => rows.filter((row) => row.id !== normalized.id));
      return;
    }

    this.items.update((rows) =>
      rows.map((row) => (row.id === normalized.id ? { ...row, ...normalized } : row)),
    );
  }

  requestDelete(item: InventoryServiceItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.pendingDelete.set(item);
  }

  cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pendingDelete.set(null);
  }

  async confirmDelete(): Promise<void> {
    const item = this.pendingDelete();
    if (!item) {
      return;
    }

    this.deleting.set(true);

    try {
      await firstValueFrom(this.adminApi.deleteInventoryService(item.id));
      this.pendingDelete.set(null);
      this.showToast(
        'success',
        `Job order "${item.referenceNo || item.serviceName}" removed from the list.`,
      );
      await this.loadServices();
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.showToast('error', `Unable to delete job order: ${detail}`);
      this.pendingDelete.set(null);
    } finally {
      this.deleting.set(false);
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
