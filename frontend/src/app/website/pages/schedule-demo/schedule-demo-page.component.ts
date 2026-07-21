import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PageHeroComponent } from '../../components/page-hero/page-hero.component';
import { DemoApiService } from '../../../core/services/website-crm-api.service';
import { contactInquiryOptions } from '../../data/pages.data';

@Component({
  selector: 'app-schedule-demo-page',
  imports: [PageHeroComponent, ReactiveFormsModule],
  templateUrl: './schedule-demo-page.component.html',
})
export class ScheduleDemoPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly demoApi = inject(DemoApiService);

  readonly inquiryOptions = contactInquiryOptions;
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal('');

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    company: [''],
    serviceInterest: ['', Validators.required],
    preferredDate: [''],
    preferredTime: [''],
    message: [''],
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.submitError.set('');

    const { name, email, phone, company, serviceInterest, preferredDate, preferredTime, message } =
      this.form.getRawValue();

    this.demoApi
      .submitDemoRequest({
        name,
        email,
        phone: phone.trim() || undefined,
        company: company.trim() || undefined,
        serviceInterest,
        preferredDate: preferredDate || undefined,
        preferredTime: preferredTime.trim() || undefined,
        message: message.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.submitted.set(true);
          this.form.reset();
          this.submitting.set(false);
        },
        error: () => {
          this.submitting.set(false);
          this.submitError.set('Unable to schedule your demo right now. Please try again or contact us directly.');
        },
      });
  }

  resetForm(): void {
    this.submitted.set(false);
    this.submitError.set('');
    this.form.reset();
  }

  hasError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}
