import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
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

  readonly footer = footerInfo;
  readonly inquiryOptions = contactInquiryOptions;
  readonly faqs = contactFaqs;
  readonly mapsDirectionsUrl = mapsDirectionsUrl;
  readonly safeMapsEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(mapsEmbedUrl);
  readonly submitted = signal(false);
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

    this.submitted.set(true);
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
}
