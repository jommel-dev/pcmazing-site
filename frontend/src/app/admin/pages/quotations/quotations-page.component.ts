import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, PaginationMeta, QuotationListItem } from '../../services/admin-api.service';

const STATUS_TABS = ['', 'draft', 'finalized', 'converted', 'expired'];

type SortBy = 'quoteNo' | 'quoteDate' | 'customerName' | 'totalAmount' | 'status' | 'expiresAt';

@Component({
  selector: 'app-quotations-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './quotations-page.component.html',
})
export class QuotationsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly statusTabs = STATUS_TABS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly sortBy = signal<SortBy>('quoteDate');
  readonly sortDir = signal<'asc' | 'desc'>('desc');
  readonly items = signal<QuotationListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly busyId = signal<number | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listQuotations(
          this.page(),
          20,
          this.search(),
          this.status(),
          this.sortBy(),
          this.sortDir(),
        ),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load quotations.');
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(tab: string): Promise<void> {
    this.status.set(tab);
    this.page.set(1);
    await this.load();
  }

  async searchQuotations(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  async toggleSort(column: SortBy): Promise<void> {
    if (this.sortBy() === column) {
      this.sortDir.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(column);
      this.sortDir.set(column === 'quoteDate' || column === 'expiresAt' || column === 'totalAmount' ? 'desc' : 'asc');
    }
    this.page.set(1);
    await this.load();
  }

  sortIndicator(column: SortBy): string {
    if (this.sortBy() !== column) {
      return '';
    }
    return this.sortDir() === 'asc' ? ' ↑' : ' ↓';
  }

  tabLabel(tab: string): string {
    return tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : 'All';
  }

  formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    return Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  viewQuery(item: QuotationListItem): Record<string, string> {
    return item.source ? { source: item.source } : {};
  }

  canManage(item: QuotationListItem): boolean {
    return item.source === 'pcmazing';
  }

  statusClass(status: string | null | undefined): string {
    switch (String(status ?? '').toLowerCase()) {
      case 'draft':
        return 'bg-slate-200 text-slate-700';
      case 'finalized':
        return 'bg-blue-600 text-white';
      case 'converted':
        return 'bg-amber-100 text-amber-800';
      case 'expired':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  isExpired(item: QuotationListItem): boolean {
    if (!item.expiresAt) {
      return false;
    }
    const expires = new Date(item.expiresAt).getTime();
    return Number.isFinite(expires) && expires <= Date.now();
  }

  async duplicate(item: QuotationListItem): Promise<void> {
    if (!this.canManage(item) || this.busyId()) {
      return;
    }
    this.busyId.set(item.id);
    this.actionMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.duplicateQuotation(item.id));
      await this.router.navigate(['/admin/quotations', response.data.id, 'edit']);
    } catch {
      this.error.set('Unable to duplicate quotation.');
    } finally {
      this.busyId.set(null);
    }
  }

  async share(item: QuotationListItem): Promise<void> {
    if (!this.canManage(item) || this.busyId()) {
      return;
    }
    if (this.isExpired(item)) {
      this.error.set('This quotation has expired and cannot be shared.');
      return;
    }
    this.busyId.set(item.id);
    this.actionMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.ensureQuotationShareLink(item.id));
      const url = `${window.location.origin}${response.data.path}`;
      await navigator.clipboard.writeText(url);
      this.actionMessage.set(`Share link copied for ${item.quoteNo || '#' + item.id}.`);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message ?? '')
          : '';
      this.error.set(message || 'Unable to create share link.');
    } finally {
      this.busyId.set(null);
    }
  }

  async remove(item: QuotationListItem): Promise<void> {
    if (!this.canManage(item) || this.busyId()) {
      return;
    }
    const label = item.quoteNo || `#${item.id}`;
    if (!window.confirm(`Delete quotation ${label}? This cannot be undone from the list.`)) {
      return;
    }
    this.busyId.set(item.id);
    this.actionMessage.set('');
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.deleteQuotation(item.id));
      this.actionMessage.set(`Deleted ${label}.`);
      await this.load();
    } catch {
      this.error.set('Unable to delete quotation.');
    } finally {
      this.busyId.set(null);
    }
  }
}
