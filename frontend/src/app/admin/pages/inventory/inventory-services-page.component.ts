import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryServiceFilterOption,
  InventoryServiceItem,
  InventoryServiceSummary,
  PaginationMeta,
} from '../../services/admin-api.service';
import { formatInventoryMoney } from './inventory-stock.util';
import { loadColumnOrder, moveColumn, saveColumnOrder } from './table-column-order.util';
import { loadPeriodFilter, savePeriodFilter } from './table-period-filter.util';

type ServiceColumnKey =
  | 'customer'
  | 'serviceName'
  | 'personInCharge'
  | 'type'
  | 'partsUsed'
  | 'interval'
  | 'cost'
  | 'labor'
  | 'totalCosting'
  | 'totalSales'
  | 'totalDiscount'
  | 'createdAt';

type JobTableColumnKey = 'referenceNo' | ServiceColumnKey | 'status';

const JOB_TABLE_COLUMNS: readonly JobTableColumnKey[] = [
  'referenceNo',
  'createdAt',
  'customer',
  'serviceName',
  'personInCharge',
  'type',
  'partsUsed',
  'interval',
  'cost',
  'labor',
  'totalCosting',
  'totalSales',
  'totalDiscount',
  'status',
];

const JOB_COLUMN_ORDER_STORAGE_KEY = 'pcmazing.job-orders.column-order';
const JOB_PERIOD_FILTER_STORAGE_KEY = 'pcmazing.job-orders.period-filter';

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
  | 'totalDiscount'
  | 'status'
  | 'createdAt';

type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

type ActionToast = {
  id: number;
  type: 'success' | 'error';
  message: string;
};

const SETTLEMENT_PAYMENT_METHODS = ['Cash', 'Gcash', 'Bank Transfer'] as const;

@Component({
  selector: 'app-inventory-services-page',
  imports: [FormsModule, RouterLink, NgClass, DecimalPipe],
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
  private readonly router = inject(Router);
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
  readonly sortBy = signal<ServiceSortKey>('createdAt');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly items = signal<InventoryServiceItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly summary = signal<InventoryServiceSummary | null>(null);
  readonly serviceTypes = signal<InventoryServiceFilterOption[]>([]);
  readonly statuses = signal<InventoryServiceFilterOption[]>([]);
  readonly selectedType = signal('');
  readonly selectedStatus = signal('');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly selectedPeriod = signal<DatePeriod>('weekly');
  readonly periodOptions: Array<{ value: DatePeriod; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];
  readonly columnOptions: Array<{ key: ServiceColumnKey; label: string }> = [
    { key: 'createdAt', label: 'Date Created' },
    { key: 'customer', label: 'Customer' },
    { key: 'serviceName', label: 'Job Order Description' },
    { key: 'personInCharge', label: 'Person In Charge' },
    { key: 'type', label: 'Type' },
    { key: 'partsUsed', label: 'Parts Used' },
    { key: 'interval', label: 'Interval' },
    { key: 'cost', label: 'Cost' },
    { key: 'labor', label: 'Labor' },
    { key: 'totalCosting', label: 'T.Costing' },
    { key: 'totalSales', label: 'T.Sales' },
    { key: 'totalDiscount', label: 'Discount' },
  ];
  readonly columnOrder = signal<JobTableColumnKey[]>(
    loadColumnOrder(JOB_COLUMN_ORDER_STORAGE_KEY, JOB_TABLE_COLUMNS),
  );
  readonly draggingColumn = signal<JobTableColumnKey | null>(null);
  readonly dropTargetColumn = signal<JobTableColumnKey | null>(null);
  readonly orderedVisibleColumns = computed(() =>
    this.columnOrder().filter((key) => key === 'referenceNo' || key === 'status' || this.columnVisible(key)),
  );
  readonly orderedColumnOptions = computed(() => {
    const order = this.columnOrder();
    return [...this.columnOptions].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  });
  readonly visibleColumns = signal<Record<ServiceColumnKey, boolean>>({
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
    totalDiscount: true,
    createdAt: true,
  });

  readonly formatMoney = formatInventoryMoney;
  readonly statusOptions = ['Active', 'Pending', 'Cancelled', 'Done', 'Refunded'] as const;
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
  readonly cancelReason = signal('');
  readonly cancelReasonError = signal('');
  readonly refundReason = signal('');
  readonly refundReasonError = signal('');
  readonly refundAmount = signal('');
  readonly refundAmountError = signal('');
  readonly pendingSettlement = signal<InventoryServiceItem | null>(null);
  readonly settlementJob = signal<InventoryServiceItem | null>(null);
  readonly settlementLoading = signal(false);
  readonly settlementAmountReceived = signal(0);
  readonly settlementPaymentMethod = signal('');
  readonly settlementError = signal('');
  readonly settlementPaymentMethods = SETTLEMENT_PAYMENT_METHODS;

  ngOnInit(): void {
    this.restorePeriodFilter();
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
          this.startDate(),
          this.endDate(),
        ),
      );
      this.items.set(response.data.map((item) => this.withNormalizedStatus(item)));
      this.meta.set(response.meta);
      this.summary.set(response.summary);
      this.serviceTypes.set(response.filters?.types ?? []);
      this.statuses.set(response.filters?.statuses ?? []);
    } catch (err) {
      this.error.set(this.readLoadError(err));
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

  async selectPeriod(period: DatePeriod): Promise<void> {
    this.selectedPeriod.set(period);
    if (period === 'custom') {
      if (!this.startDate() || !this.endDate()) {
        this.applyPresetPeriod('weekly');
      }
      this.persistPeriodFilter();
      return;
    }

    this.applyPresetPeriod(period);
    this.persistPeriodFilter();
    this.page.set(1);
    await this.loadServices();
  }

  async applyCustomRange(): Promise<void> {
    const start = this.startDate();
    const end = this.endDate();
    if (!start || !end) {
      this.error.set('Select both start and end dates for the custom range.');
      return;
    }
    if (start > end) {
      this.startDate.set(end);
      this.endDate.set(start);
    }
    this.persistPeriodFilter();
    this.page.set(1);
    await this.loadServices();
  }

  private applyPresetPeriod(period: Exclude<DatePeriod, 'custom'>): void {
    const now = new Date();
    const end = this.toInputDate(now);
    let start = now;

    if (period === 'weekly') {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start = new Date(now);
      start.setDate(now.getDate() + diff);
    } else if (period === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    this.startDate.set(this.toInputDate(start));
    this.endDate.set(end);
  }

  private toInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private restorePeriodFilter(): void {
    const saved = loadPeriodFilter(JOB_PERIOD_FILTER_STORAGE_KEY);
    if (saved.period === 'custom' && saved.startDate && saved.endDate) {
      this.selectedPeriod.set('custom');
      this.startDate.set(saved.startDate);
      this.endDate.set(saved.endDate);
      return;
    }

    const period = saved.period === 'custom' ? 'weekly' : saved.period;
    this.selectedPeriod.set(period);
    this.applyPresetPeriod(period);
  }

  private persistPeriodFilter(): void {
    savePeriodFilter(JOB_PERIOD_FILTER_STORAGE_KEY, {
      period: this.selectedPeriod(),
      startDate: this.startDate(),
      endDate: this.endDate(),
    });
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
      this.sortDir.set(key === 'createdAt' ? 'desc' : 'asc');
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
    const periodLabel =
      this.periodOptions.find((option) => option.value === this.selectedPeriod())?.label ?? 'Daily';
    return `${typeLabel} · ${statusLabel} · ${periodLabel} (${count} jobs)`;
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

  isNumericColumn(key: JobTableColumnKey): boolean {
    return key === 'cost' || key === 'labor' || key === 'totalCosting' || key === 'totalSales' || key === 'totalDiscount';
  }

  columnLabel(key: JobTableColumnKey): string {
    const labels: Record<JobTableColumnKey, string> = {
      referenceNo: 'Ref No',
      createdAt: 'Date Created',
      customer: 'Customer',
      serviceName: 'Job Order Description',
      personInCharge: 'Person In Charge',
      type: 'Type',
      partsUsed: 'Parts Used',
      interval: 'Interval',
      cost: 'Cost',
      labor: 'Labor',
      totalCosting: 'T.Costing',
      totalSales: 'T.Sales',
      totalDiscount: 'Discount',
      status: 'Status',
    };
    return labels[key];
  }

  isSortableColumn(key: JobTableColumnKey): boolean {
    return key !== 'partsUsed';
  }

  toggleSortColumn(key: JobTableColumnKey): void {
    if (!this.isSortableColumn(key)) {
      return;
    }
    void this.toggleSort(key as ServiceSortKey);
  }

  sortIndicatorFor(key: JobTableColumnKey): string {
    if (!this.isSortableColumn(key)) {
      return '';
    }
    return this.sortIndicator(key as ServiceSortKey);
  }

  columnHeaderClass(key: JobTableColumnKey): string {
    const base = 'px-2 py-2 font-bold whitespace-nowrap';
    if (key === 'totalCosting') {
      return `${base} text-right text-emerald-700`;
    }
    if (key === 'totalSales') {
      return `${base} text-right text-pcmazing-600`;
    }
    if (key === 'totalDiscount') {
      return `${base} text-right text-amber-700`;
    }
    if (this.isNumericColumn(key)) {
      return `${base} text-right text-slate-600`;
    }
    if (key === 'serviceName') {
      return 'max-w-[180px] px-2 py-2 text-left font-bold text-slate-600 sm:max-w-[220px]';
    }
    if (key === 'partsUsed') {
      return 'max-w-[220px] px-2 py-2 text-left font-bold text-slate-600 sm:max-w-[260px]';
    }
    return `${base} text-left text-slate-600`;
  }

  onColumnDragStart(event: DragEvent, key: JobTableColumnKey): void {
    this.draggingColumn.set(key);
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onColumnDragOver(event: DragEvent, key: JobTableColumnKey): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggingColumn() && this.draggingColumn() !== key) {
      this.dropTargetColumn.set(key);
    }
  }

  onColumnDrop(event: DragEvent, key: JobTableColumnKey): void {
    event.preventDefault();
    const fromKey = (event.dataTransfer?.getData('text/plain') as JobTableColumnKey) || this.draggingColumn();
    if (!fromKey) {
      this.clearColumnDrag();
      return;
    }

    const next = moveColumn(this.columnOrder(), fromKey, key);
    this.columnOrder.set(next);
    saveColumnOrder(JOB_COLUMN_ORDER_STORAGE_KEY, next);
    this.clearColumnDrag();
  }

  onColumnDragEnd(): void {
    this.clearColumnDrag();
  }

  private clearColumnDrag(): void {
    this.draggingColumn.set(null);
    this.dropTargetColumn.set(null);
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
      case 'refunded':
        return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200';
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

    if (nextStatus === 'Done') {
      void this.openSettlement(item);
      return;
    }

    this.cancelReason.set('');
    this.cancelReasonError.set('');
    this.refundReason.set('');
    this.refundReasonError.set('');
    this.refundAmount.set('');
    this.refundAmountError.set('');
    this.pendingStatusChange.set({ item, nextStatus });
  }

  cancelStatusChange(): void {
    if (this.statusUpdatingId() !== null) {
      return;
    }
    this.pendingStatusChange.set(null);
    this.cancelReason.set('');
    this.cancelReasonError.set('');
    this.refundReason.set('');
    this.refundReasonError.set('');
    this.refundAmount.set('');
    this.refundAmountError.set('');
  }

  async confirmStatusChange(): Promise<void> {
    const pending = this.pendingStatusChange();
    if (!pending || this.statusUpdatingId() !== null) {
      return;
    }

    const reason = this.cancelReason().trim();
    if (pending.nextStatus === 'Cancelled' && reason.length < 3) {
      this.cancelReasonError.set('Please enter a cancellation reason.');
      return;
    }

    const refundReason = this.refundReason().trim();
    const refundAmountRaw = String(this.refundAmount() ?? '').trim();
    const refundAmount = Number(refundAmountRaw);
    if (pending.nextStatus === 'Refunded') {
      if (refundReason.length < 3) {
        this.refundReasonError.set('Please enter a refund reason.');
        return;
      }
      if (!refundAmountRaw || !Number.isFinite(refundAmount) || refundAmount <= 0) {
        this.refundAmountError.set('Please enter a valid refund amount.');
        return;
      }
      const maxRefund = this.jobOrderMaxRefund(pending.item);
      if (refundAmount > maxRefund + 0.009) {
        this.refundAmountError.set(`Refund cannot exceed ${this.formatMoney(maxRefund)}.`);
        return;
      }
    }

    this.cancelReasonError.set('');
    this.refundReasonError.set('');
    this.refundAmountError.set('');

    const saved = await this.applyStatusChange(
      pending.item,
      pending.nextStatus,
      undefined,
      reason,
      pending.nextStatus === 'Refunded' ? refundReason : undefined,
      pending.nextStatus === 'Refunded' ? refundAmount : undefined,
    );

    if (!saved) {
      return;
    }

    this.pendingStatusChange.set(null);
    this.cancelReason.set('');
    this.refundReason.set('');
    this.refundAmount.set('');
  }

  jobOrderMaxRefund(item: InventoryServiceItem): number {
    const netSales = Math.max(0, Number(item.totalSales) || 0);
    const priorRefund = Math.max(0, Number(item.refundAmount) || 0);
    return netSales + priorRefund;
  }

  fillMaxRefundAmount(): void {
    const pending = this.pendingStatusChange();
    if (!pending) {
      return;
    }

    const max = this.jobOrderMaxRefund(pending.item);
    this.refundAmount.set(max > 0 ? max.toFixed(2) : '');
    this.refundAmountError.set('');
  }

  jobOrderGrossTotal(item: InventoryServiceItem): number {
    const parts = item.parts ?? [];
    if (parts.length) {
      const lines = parts.reduce((sum, part) => {
        const isService = Number(part.serviceTypeId) > 0;
        const qty = Number(part.quantity) || 0;
        const unitPrice = Number(part.unitPrice) || 0;
        const labor = Number(part.labor) || 0;
        const gross = isService ? (labor > 0 ? labor : (qty || 1) * unitPrice) : qty * unitPrice;
        return sum + Math.max(0, gross - (Number(part.discountAmount) || 0));
      }, 0);
      return Math.max(0, lines - (Number(item.customDiscount) || 0));
    }

    const totalSales = Math.max(0, Number(item.totalSales) || 0);
    const totalDiscount = Math.max(0, Number(item.totalDiscount) || 0);
    if (totalDiscount > 0) {
      return totalSales + totalDiscount;
    }

    return totalSales;
  }

  private settlementSource(): InventoryServiceItem | null {
    return this.settlementJob() ?? this.pendingSettlement();
  }

  settlementTotalToPay(): number {
    const item = this.settlementSource();
    if (!item) {
      return 0;
    }

    return this.jobOrderGrossTotal(item);
  }

  orderDiscount(item: InventoryServiceItem): number {
    return Math.max(0, Number(item.totalDiscount ?? item.customDiscount) || 0);
  }

  settlementDownpayment(): number {
    return Math.max(0, Number(this.settlementSource()?.downpayment) || 0);
  }

  settlementBalanceDue(): number {
    return Math.max(0, this.settlementTotalToPay() - this.settlementDownpayment());
  }

  settlementChangeAmount(): number {
    return Math.max(0, this.settlementAmountReceived() - this.settlementBalanceDue());
  }

  canConfirmSettlement(): boolean {
    return (
      this.settlementAmountReceived() + 0.005 >= this.settlementBalanceDue() &&
      SETTLEMENT_PAYMENT_METHODS.includes(
        this.settlementPaymentMethod() as (typeof SETTLEMENT_PAYMENT_METHODS)[number],
      )
    );
  }

  onSettlementAmountInput(rawValue: string): void {
    const parsed = Number(rawValue);
    this.settlementAmountReceived.set(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
    this.settlementError.set('');
  }

  selectSettlementPaymentMethod(method: string): void {
    this.settlementPaymentMethod.set(method);
    this.settlementError.set('');
  }

  private async openSettlement(item: InventoryServiceItem): Promise<void> {
    this.settlementError.set('');
    this.settlementPaymentMethod.set(item.paymentMethod || '');
    this.pendingSettlement.set(item);
    this.settlementJob.set(null);
    this.settlementLoading.set(true);

    try {
      const response = await firstValueFrom(this.adminApi.getInventoryService(item.id));
      this.settlementJob.set(response.data);
      this.settlementPaymentMethod.set(response.data.paymentMethod || '');
      this.settlementAmountReceived.set(Number(this.settlementBalanceDue().toFixed(2)));
    } catch {
      this.settlementJob.set(item);
      this.settlementAmountReceived.set(Number(this.settlementBalanceDue().toFixed(2)));
      this.settlementError.set('Unable to load full job totals. You can still settle using the listed amount.');
    } finally {
      this.settlementLoading.set(false);
    }
  }

  cancelSettlement(): void {
    if (this.statusUpdatingId() !== null) {
      return;
    }
    this.pendingSettlement.set(null);
    this.settlementJob.set(null);
    this.settlementError.set('');
    this.settlementPaymentMethod.set('');
  }

  async confirmSettlement(): Promise<void> {
    const item = this.pendingSettlement();
    if (!item) {
      return;
    }

    if (!this.settlementPaymentMethod()) {
      this.settlementError.set('Please select a payment method.');
      return;
    }

    if (!this.canConfirmSettlement()) {
      this.settlementError.set('Amount received must cover the remaining balance.');
      return;
    }

    await this.applyStatusChange(item, 'Done', this.settlementPaymentMethod());
  }

  private async applyStatusChange(
    item: InventoryServiceItem,
    status: string,
    paymentMethod?: string,
    cancelReason?: string,
    refundReason?: string,
    refundAmount?: number,
  ): Promise<boolean> {
    this.statusUpdatingId.set(item.id);

    try {
      const response = await firstValueFrom(
        this.adminApi.updateInventoryServiceStatus(
          item.id,
          status,
          paymentMethod,
          cancelReason,
          refundReason,
          refundAmount,
        ),
      );
      const nextStatus = this.normalizeJobStatus(response.data.status);
      this.applyLocalStatusUpdate({
        ...item,
        ...response.data,
        status: nextStatus,
        imageUrl: response.data.imageUrl ?? null,
      });
      const clearedImage =
        this.normalizeJobStatus(item.status) === 'Done' && nextStatus !== 'Done';
      this.showToast(
        'success',
        clearedImage
          ? `Status updated to ${nextStatus}. Completion image removed.`
          : nextStatus === 'Done'
            ? 'Job settled.'
            : `Status updated to ${nextStatus}.`,
      );

      this.pendingSettlement.set(null);
      this.settlementJob.set(null);

      if (nextStatus === 'Done') {
        await this.router.navigate(['/admin/job-order', item.id, 'receipt'], {
          queryParams: { print: '1' },
        });
      }

      return true;
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      const message = `Unable to update status: ${detail}`;
      this.settlementError.set(message);
      this.showToast('error', message);

      if (status === 'Refunded') {
        this.refundAmountError.set(detail);
      }

      return false;
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

  printJob(item: InventoryServiceItem, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (this.normalizeJobStatus(item.status) === 'Cancelled') {
      return;
    }
    const reprinted = this.normalizeJobStatus(item.status) === 'Done';
    void this.router.navigate(['/admin/job-order', item.id, 'receipt'], {
      queryParams: reprinted ? { reprint: '1', print: '1' } : { print: '1' },
    });
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

  private readLoadError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const payload = (err as { error?: { message?: string | string[] } }).error;
      if (Array.isArray(payload?.message)) {
        return payload.message.join(', ');
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }

    return 'Unable to load job orders.';
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

  createdAtLabel(item: InventoryServiceItem): string {
    return this.formatDateTime(item.createdAt ?? null) || '—';
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
