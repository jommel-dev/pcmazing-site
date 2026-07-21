import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ContactInquiry, PaginationMeta } from '../../services/admin-api.service';

@Component({
  selector: 'app-contact-inquiries-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-inquiries-page.component.html',
})
export class ContactInquiriesPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly page = signal(1);
  readonly items = signal<ContactInquiry[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'new', label: 'New' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listContactInquiries(this.page(), 20, this.search(), this.statusFilter()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load contact inquiries.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchInquiries(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }
}
