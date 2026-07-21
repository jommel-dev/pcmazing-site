import { Component, inject, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { PublishedReview, ReviewsApiService } from '../../../core/services/website-crm-api.service';

@Component({
  selector: 'app-site-reviews',
  imports: [RouterLink],
  templateUrl: './site-reviews.component.html',
})
export class SiteReviewsComponent implements OnInit {
  private readonly reviewsApi = inject(ReviewsApiService);

  readonly reviews = signal<PublishedReview[]>([]);
  readonly loading = signal(true);
  readonly stars = [1, 2, 3, 4, 5];

  ngOnInit(): void {
    void this.loadReviews();
  }

  private async loadReviews(): Promise<void> {
    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.reviewsApi.listPublished(6));
      this.reviews.set(response.data);
    } catch {
      this.reviews.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  fillWidth(rating: number, star: number): number {
    if (rating >= star) {
      return 100;
    }

    if (rating >= star - 0.5) {
      return 50;
    }

    return 0;
  }

  formatRating(rating: number): string {
    return Number.isInteger(rating) ? `${rating}` : rating.toFixed(1);
  }

  maskName(fullName: string): string {
    return fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => this.maskNamePart(part))
      .join(' ');
  }

  private maskNamePart(name: string): string {
    if (name.length <= 1) {
      return '*';
    }

    if (name.length === 2) {
      return `${name[0]}*`;
    }

    if (name.length === 3) {
      return `${name[0]}*${name[2]}`;
    }

    return `${name[0]}${'*'.repeat(name.length - 3)}${name.slice(-2)}`;
  }
}
