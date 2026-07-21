import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../../core/config/app-config';
import { AdminApiService, CustomerReview, PaginationMeta } from '../../services/admin-api.service';

@Component({
  selector: 'app-customer-reviews-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './customer-reviews-page.component.html',
})
export class CustomerReviewsPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly page = signal(1);
  readonly items = signal<CustomerReview[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly publicReviewLink = `${APP_CONFIG.publicSiteUrl.replace(/\/$/, '')}/leave-a-review`;
  readonly copyMessage = signal('');

  readonly statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listCustomerReviews(this.page(), 20, this.search(), this.statusFilter()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load customer reviews.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchReviews(): Promise<void> {
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

  formatRating(rating: number): string {
    return Number.isInteger(rating) ? `${rating}` : rating.toFixed(1);
  }

  async copyPublicReviewLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicReviewLink);
      this.copyMessage.set('Link copied to clipboard.');
    } catch {
      this.copyMessage.set('Unable to copy automatically. Please copy the link manually.');
    }
  }
}
