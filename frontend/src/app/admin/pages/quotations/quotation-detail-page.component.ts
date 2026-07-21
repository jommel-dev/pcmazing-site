import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, QuotationDetail } from '../../services/admin-api.service';

@Component({
  selector: 'app-quotation-detail-page',
  imports: [RouterLink],
  templateUrl: './quotation-detail-page.component.html',
})
export class QuotationDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly quotation = signal<QuotationDetail | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.getQuotation(id));
      this.quotation.set(response.data);
    } catch {
      this.error.set('Unable to load quotation details.');
    } finally {
      this.loading.set(false);
    }
  }

  lineDescription(item: QuotationDetail['items'][number]): string {
    const metadata = item.metadata;
    if (metadata && typeof metadata['description'] === 'string') {
      return metadata['description'];
    }
    return item.remarks || 'Line item';
  }

  formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }
}
