import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, QuotationDetail, QuotationSource } from '../../services/admin-api.service';
import { phDiscountLabel } from '../inventory/ph-discount.util';

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
  readonly source = signal<QuotationSource | undefined>(undefined);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const source = this.route.snapshot.queryParamMap.get('source') || undefined;
    this.source.set(source === 'legacy' || source === 'pcmazing' ? source : undefined);
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.getQuotation(id, source));
      this.quotation.set(response.data);
      this.source.set(response.data.source);
    } catch {
      this.error.set('Unable to load quotation details.');
    } finally {
      this.loading.set(false);
    }
  }

  canEdit(): boolean {
    const quote = this.quotation();
    return quote?.source === 'pcmazing' && quote.status === 'draft';
  }

  lineDescription(item: QuotationDetail['items'][number]): string {
    if (item.description?.trim()) {
      return item.description;
    }
    if (item.materialName?.trim()) {
      return item.materialName;
    }
    const metadata = item.metadata;
    if (metadata && typeof metadata['description'] === 'string') {
      return metadata['description'];
    }
    return item.remarks || 'Line item';
  }

  lineQuantity(item: QuotationDetail['items'][number]): number | string {
    return item.quantity || item.totalSetQty || '—';
  }

  discountLabel(value: string | null | undefined): string {
    return phDiscountLabel(value === 'senior' || value === 'pwd' ? value : 'none');
  }

  formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) {
      return '—';
    }
    return Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
