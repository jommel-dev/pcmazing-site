import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ReviewsApiService } from '../../../core/services/website-crm-api.service';

type StarFill = 'empty' | 'half' | 'full';

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule],
  templateUrl: './review-form.component.html',
})
export class ReviewFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly reviewsApi = inject(ReviewsApiService);

  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly hoverRating = signal(0);

  readonly stars = [1, 2, 3, 4, 5];

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.email]],
    rating: [5, [Validators.required, Validators.min(0.5), Validators.max(5)]],
    title: [''],
    message: ['', [Validators.required, Validators.minLength(20)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    const { name, email, rating, title, message } = this.form.getRawValue();

    this.reviewsApi
      .submitReview({
        name,
        email: email.trim() || undefined,
        rating: this.normalizeRating(rating),
        title: title.trim() || undefined,
        message,
      })
      .subscribe({
        next: () => {
          this.submitted.set(true);
          this.form.reset({ rating: 5 });
          this.hoverRating.set(0);
          this.submitting.set(false);
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Unable to submit your review right now. Please try again later.');
        },
      });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.submitError.set('');
    this.hoverRating.set(0);
    this.form.reset({ rating: 5 });
  }

  setRating(value: number): void {
    this.form.controls.rating.setValue(this.normalizeRating(value));
    this.form.controls.rating.markAsDirty();
  }

  currentRating(): number {
    return this.form.controls.rating.value;
  }

  displayRating(): number {
    return this.hoverRating() || this.currentRating();
  }

  starFill(star: number): StarFill {
    const rating = this.displayRating();

    if (rating >= star) {
      return 'full';
    }

    if (rating >= star - 0.5) {
      return 'half';
    }

    return 'empty';
  }

  fillWidth(star: number): number {
    const fill = this.starFill(star);
    if (fill === 'full') {
      return 100;
    }
    if (fill === 'half') {
      return 50;
    }
    return 0;
  }

  ratingLabel(): string {
    const value = this.currentRating();
    const text = Number.isInteger(value) ? `${value}` : value.toFixed(1);
    return `${text} / 5 stars`;
  }

  private normalizeRating(value: number): number {
    const clamped = Math.min(Math.max(value, 0.5), 5);
    return Math.round(clamped * 2) / 2;
  }
}
