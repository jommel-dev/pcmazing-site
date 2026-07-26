import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  PaginationMeta,
  PurchaseListItem,
} from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';

const STATUS_TABS = ['', 'pending', 'approved', 'received', 'cancelled'];

@Component({
  selector: 'app-purchase-page',
  imports: [FormsModule, RouterLink, InventorySubnavComponent],
  templateUrl: './purchase-page.component.html',
})
export class PurchasePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly statusTabs = STATUS_TABS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly items = signal<PurchaseListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listPurchaseOrders(this.page(), 20, this.search(), this.status()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load purchase orders.');
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(tab: string): Promise<void> {
    this.status.set(tab);
    this.page.set(1);
    await this.load();
  }

  async searchPurchaseOrders(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  tabLabel(tab: string): string {
    return tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : 'All';
  }

  formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  statusClass(status: string | null): string {
    const normalized = (status ?? 'pending').toLowerCase();
    if (normalized === 'received') return 'bg-emerald-50 text-emerald-700';
    if (normalized === 'approved') return 'bg-blue-50 text-blue-700';
    if (normalized === 'cancelled') return 'bg-red-50 text-red-700';
    return 'bg-amber-50 text-amber-700';
  }
}
