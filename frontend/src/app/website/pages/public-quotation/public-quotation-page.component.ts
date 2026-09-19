import { Component, HostListener, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, QuotationDetail } from '../../../admin/services/admin-api.service';
import { phDiscountLabel } from '../../../admin/pages/inventory/ph-discount.util';

@Component({
  selector: 'app-public-quotation-page',
  templateUrl: './public-quotation-page.component.html',
  styleUrl: './public-quotation-page.component.css',
})
export class PublicQuotationPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly quotation = signal<QuotationDetail | null>(null);

  ngOnInit(): void {
    document.body.classList.add('public-quote-lock');
    void this.load();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('public-quote-lock');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const blocked =
      (event.ctrlKey || event.metaKey) &&
      (key === 'p' || key === 's' || key === 'u' || key === 'c' || key === 'a');
    if (blocked || key === 'printscreen') {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onContextMenu(event: Event): void {
    event.preventDefault();
  }

  @HostListener('document:copy', ['$event'])
  @HostListener('document:cut', ['$event'])
  onCopy(event: Event): void {
    event.preventDefault();
  }

  private async load(): Promise<void> {
    const token = this.route.snapshot.paramMap.get('token') || '';
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.getPublicQuotation(token));
      this.quotation.set(response.data);
    } catch {
      this.error.set('This quotation link is unavailable or has expired.');
      this.quotation.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  lineDescription(item: QuotationDetail['items'][number]): string {
    return item.description || item.materialName || 'Line item';
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
