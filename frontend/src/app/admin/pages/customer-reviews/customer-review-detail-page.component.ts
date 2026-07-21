import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, CustomerReview } from '../../services/admin-api.service';

@Component({
  selector: 'app-customer-review-detail-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './customer-review-detail-page.component.html',
})
export class CustomerReviewDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly review = signal<CustomerReview | null>(null);
  readonly adminNotes = signal('');

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.adminApi.getCustomerReview(id));
      this.review.set(response.data);
      this.adminNotes.set(response.data.adminNotes ?? '');
    } catch {
      this.error.set('Unable to load this review.');
    } finally {
      this.loading.set(false);
    }
  }

  async updateReview(payload: { status?: string; isPublished?: boolean }): Promise<void> {
    const item = this.review();
    if (!item) {
      return;
    }

    this.saving.set(true);
    this.actionMessage.set('');
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.updateCustomerReview(item.id, {
          ...payload,
          adminNotes: this.adminNotes(),
        }),
      );
      this.review.set(response.data);
      this.actionMessage.set('Review updated.');
    } catch {
      this.error.set('Unable to update review.');
    } finally {
      this.saving.set(false);
    }
  }

  approveAndPublish(): void {
    void this.updateReview({ status: 'approved', isPublished: true });
  }

  rejectReview(): void {
    void this.updateReview({ status: 'rejected', isPublished: false });
  }

  unpublishReview(): void {
    void this.updateReview({ isPublished: false });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  formatRating(rating: number): string {
    return Number.isInteger(rating) ? `${rating}` : rating.toFixed(1);
  }
}
