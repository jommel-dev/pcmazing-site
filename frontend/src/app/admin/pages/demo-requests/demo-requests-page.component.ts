import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, DemoRequest, PaginationMeta } from '../../services/admin-api.service';

@Component({
  selector: 'app-demo-requests-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './demo-requests-page.component.html',
})
export class DemoRequestsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly page = signal(1);
  readonly items = signal<DemoRequest[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'followed_up', label: 'Followed up' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listDemoRequests(this.page(), 20, this.search(), this.statusFilter()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load demo requests.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchRequests(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }
}
