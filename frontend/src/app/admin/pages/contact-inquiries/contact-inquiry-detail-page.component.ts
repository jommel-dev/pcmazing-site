import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ContactInquiry } from '../../services/admin-api.service';

@Component({
  selector: 'app-contact-inquiry-detail-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './contact-inquiry-detail-page.component.html',
})
export class ContactInquiryDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly inquiry = signal<ContactInquiry | null>(null);
  readonly status = signal('new');
  readonly adminNotes = signal('');

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.getContactInquiry(id));
      this.inquiry.set(response.data);
      this.status.set(response.data.status);
      this.adminNotes.set(response.data.adminNotes ?? '');
    } catch {
      this.error.set('Unable to load this inquiry.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const item = this.inquiry();
    if (!item) {
      return;
    }

    this.saving.set(true);
    this.actionMessage.set('');
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.updateContactInquiry(item.id, {
          status: this.status(),
          adminNotes: this.adminNotes(),
        }),
      );
      this.inquiry.set(response.data);
      this.actionMessage.set('Inquiry updated.');
    } catch {
      this.error.set('Unable to save changes.');
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }
}
