import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, DemoRequest } from '../../services/admin-api.service';

@Component({
  selector: 'app-demo-request-detail-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './demo-request-detail-page.component.html',
})
export class DemoRequestDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly request = signal<DemoRequest | null>(null);
  readonly status = signal('pending');
  readonly followUpNotes = signal('');

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);

    try {
      const response = await firstValueFrom(this.adminApi.getDemoRequest(id));
      this.request.set(response.data);
      this.status.set(response.data.status);
      this.followUpNotes.set(response.data.followUpNotes ?? '');
    } catch {
      this.error.set('Unable to load this demo request.');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const item = this.request();
    if (!item) {
      return;
    }

    this.saving.set(true);
    this.actionMessage.set('');
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.updateDemoRequest(item.id, {
          status: this.status(),
          followUpNotes: this.followUpNotes(),
        }),
      );
      this.request.set(response.data);
      this.actionMessage.set('Demo request updated.');
    } catch {
      this.error.set('Unable to save changes.');
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }
    return new Date(value).toLocaleString();
  }
}
