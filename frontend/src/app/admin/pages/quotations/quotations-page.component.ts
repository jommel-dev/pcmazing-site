import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, PaginationMeta, QuotationListItem } from '../../services/admin-api.service';

const STATUS_TABS = ['', 'draft', 'finalized', 'converted', 'expired'];

@Component({
  selector: 'app-quotations-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './quotations-page.component.html',
})
export class QuotationsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly statusTabs = STATUS_TABS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal('');
  readonly page = signal(1);
  readonly items = signal<QuotationListItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listQuotations(this.page(), 20, this.search(), this.status()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load quotations. Make sure tblquotation exists in your database.');
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

  tabLabel(tab: string): string {
    return tab ? tab.charAt(0).toUpperCase() + tab.slice(1) : 'All';
  }

  formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }
}
