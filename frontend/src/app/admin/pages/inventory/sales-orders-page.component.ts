import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  PaginationMeta,
  SalesOrderListItem,
  SalesOrderSummary,
} from '../../services/admin-api.service';
import { formatInventoryMoney } from './inventory-stock.util';
import { loadColumnOrder, moveColumn, saveColumnOrder } from './table-column-order.util';
import { loadPeriodFilter, savePeriodFilter } from './table-period-filter.util';

type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'custom';
type SalesSortKey = 'referenceNo' | 'customer' | 'items' | 'total' | 'discount' | 'saleDate' | 'status';
type SalesTableColumnKey = 'referenceNo' | 'customer' | 'items' | 'discount' | 'total' | 'saleDate' | 'status';

const SALES_TABLE_COLUMNS: readonly SalesTableColumnKey[] = [
  'referenceNo',
  'customer',
  'items',
  'discount',
  'total',
  'saleDate',
  'status',
];

const SALES_COLUMN_ORDER_STORAGE_KEY = 'pcmazing.sales-orders.column-order';
const SALES_PERIOD_FILTER_STORAGE_KEY = 'pcmazing.sales-orders.period-filter';

@Component({
  selector: 'app-sales-orders-page',
  imports: [FormsModule, RouterLink, NgClass],
  templateUrl: './sales-orders-page.component.html',
})
export class SalesOrdersPageComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly pageSizeOptions = [10, 25, 50] as const;
  readonly items = signal<SalesOrderListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly summary = signal<SalesOrderSummary | null>(null);
  readonly voidFilter = signal<'all' | 'active' | 'void'>('all');
  readonly startDate = signal('');
  readonly endDate = signal('');
  readonly selectedPeriod = signal<DatePeriod>('weekly');
  readonly periodOptions: Array<{ value: DatePeriod; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];
  readonly sortBy = signal<SalesSortKey>('saleDate');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly columnOrder = signal<SalesTableColumnKey[]>(
    loadColumnOrder(SALES_COLUMN_ORDER_STORAGE_KEY, SALES_TABLE_COLUMNS),
  );
  readonly draggingColumn = signal<SalesTableColumnKey | null>(null);
  readonly dropTargetColumn = signal<SalesTableColumnKey | null>(null);
  readonly orderedVisibleColumns = computed(() => this.columnOrder());
  readonly pendingVoid = signal<SalesOrderListItem | null>(null);
  readonly voiding = signal(false);
  readonly formatMoney = formatInventoryMoney;

  ngOnInit(): void {
    this.restorePeriodFilter();
    void this.loadOrders();
  }

  ngOnDestroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
  }

  async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listSalesOrders(
          this.page(),
          this.pageSize(),
          this.search(),
          this.voidFilter() === 'all' ? '' : this.voidFilter(),
          this.sortBy(),
          this.sortDir(),
          this.startDate(),
          this.endDate(),
        ),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
      this.summary.set(response.summary);
    } catch {
      this.error.set('Unable to load sales orders.');
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput(value: string): void {
    this.search.set(value);
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.page.set(1);
      void this.loadOrders();
    }, 300);
  }

  filterByVoid(value: 'all' | 'active' | 'void'): void {
    this.voidFilter.set(value);
    this.page.set(1);
    void this.loadOrders();
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
    await this.loadOrders();
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
    await this.loadOrders();
  }

  async toggleSort(key: SalesSortKey): Promise<void> {
    if (this.sortBy() === key) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(key);
      this.sortDir.set(key === 'saleDate' ? 'desc' : 'asc');
    }
    this.page.set(1);
    await this.loadOrders();
  }

  sortIndicator(key: SalesSortKey): string {
    if (this.sortBy() !== key) {
      return '';
    }
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  changePage(nextPage: number): void {
    this.page.set(nextPage);
    void this.loadOrders();
  }

  changePageSize(size: number): void {
    this.pageSize.set(size);
    this.page.set(1);
    void this.loadOrders();
  }

  openOrder(item: SalesOrderListItem): void {
    void this.router.navigate(['/admin/sales-order', item.id]);
  }

  openReceipt(item: SalesOrderListItem, reprint = false): void {
    void this.router.navigate(['/admin/sales-order', item.id, 'receipt'], {
      queryParams: reprint ? { print: '1', reprint: '1' } : { print: '1' },
    });
  }

  requestVoid(item: SalesOrderListItem): void {
    this.pendingVoid.set(item);
  }

  cancelVoid(): void {
    this.pendingVoid.set(null);
  }

  async confirmVoid(): Promise<void> {
    const item = this.pendingVoid();
    if (!item) {
      return;
    }

    this.voiding.set(true);
    try {
      await firstValueFrom(this.adminApi.voidSalesOrder(item.id));
      this.pendingVoid.set(null);
      await this.loadOrders();
    } catch {
      this.error.set('Unable to void this sales order.');
    } finally {
      this.voiding.set(false);
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  columnLabel(key: SalesTableColumnKey): string {
    const labels: Record<SalesTableColumnKey, string> = {
      referenceNo: 'Reference',
      customer: 'Customer',
      items: 'Items',
      discount: 'Discount',
      total: 'Total',
      saleDate: 'Sale Date',
      status: 'Status',
    };
    return labels[key];
  }

  isNumericColumn(key: SalesTableColumnKey): boolean {
    return key === 'discount' || key === 'total';
  }

  columnHeaderClass(key: SalesTableColumnKey): string {
    const base = 'px-2 py-2 font-bold whitespace-nowrap text-slate-600';
    return this.isNumericColumn(key) ? `${base} text-right` : `${base} text-left`;
  }

  sortKeyFor(key: SalesTableColumnKey): SalesSortKey {
    return key;
  }

  onColumnDragStart(event: DragEvent, key: SalesTableColumnKey): void {
    this.draggingColumn.set(key);
    event.dataTransfer?.setData('text/plain', key);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
  }

  onColumnDragOver(event: DragEvent, key: SalesTableColumnKey): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggingColumn() && this.draggingColumn() !== key) {
      this.dropTargetColumn.set(key);
    }
  }

  onColumnDrop(event: DragEvent, key: SalesTableColumnKey): void {
    event.preventDefault();
    const fromKey = (event.dataTransfer?.getData('text/plain') as SalesTableColumnKey) || this.draggingColumn();
    if (!fromKey) {
      this.clearColumnDrag();
      return;
    }

    const next = moveColumn(this.columnOrder(), fromKey, key);
    this.columnOrder.set(next);
    saveColumnOrder(SALES_COLUMN_ORDER_STORAGE_KEY, next);
    this.clearColumnDrag();
  }

  onColumnDragEnd(): void {
    this.clearColumnDrag();
  }

  private clearColumnDrag(): void {
    this.draggingColumn.set(null);
    this.dropTargetColumn.set(null);
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
    const saved = loadPeriodFilter(SALES_PERIOD_FILTER_STORAGE_KEY);
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
    savePeriodFilter(SALES_PERIOD_FILTER_STORAGE_KEY, {
      period: this.selectedPeriod(),
      startDate: this.startDate(),
      endDate: this.endDate(),
    });
  }
}
