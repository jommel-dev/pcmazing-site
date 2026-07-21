import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { ContactApiService } from '../../../core/services/contact-api.service';
import { contactFaqs, contactInquiryOptions, mapsDirectionsUrl, mapsEmbedUrl } from '../../data/pages.data';
import { footerInfo } from '../../data/site.data';

@Component({
  selector: 'app-contact-page',
  imports: [PageHeroComponent, ReactiveFormsModule],
  templateUrl: './contact-page.component.html',
})
export class ContactPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly contactApi = inject(ContactApiService);

  readonly footer = footerInfo;
  readonly inquiryOptions = contactInquiryOptions;
  readonly faqs = contactFaqs;
  readonly mapsDirectionsUrl = mapsDirectionsUrl;
  readonly safeMapsEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(mapsEmbedUrl);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly openFaqIndex = signal<number | null>(0);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    inquiry: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    const { name, email, phone, inquiry, message } = this.form.getRawValue();

    this.contactApi
      .submitInquiry({
        name,
        email,
        phone: phone.trim() || undefined,
        inquiry,
        message,
      })
      .subscribe({
        next: () => {
          this.submitted.set(true);
          this.form.reset();
          this.submitting.set(false);
        },
        error: (error) => {
          this.submitting.set(false);
          this.submitError.set(this.extractErrorMessage(error));
        },
      });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.submitError.set('');
    this.form.reset();
  }

  hasError(field: 'name' | 'email' | 'phone' | 'inquiry' | 'message'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  toggleFaq(index: number): void {
    this.openFaqIndex.update((current) => (current === index ? null : index));
  }

  isFaqOpen(index: number): boolean {
    return this.openFaqIndex() === index;
  }

  private extractErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string | string[] } }).error;

      if (Array.isArray(payload?.message)) {
        return payload.message.join(', ');
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }

    return 'Unable to send your message right now. Please try again or visit our store.';
  }
}
