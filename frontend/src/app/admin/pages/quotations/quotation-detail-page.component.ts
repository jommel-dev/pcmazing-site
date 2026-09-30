import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, QuotationDetail, QuotationSource } from '../../services/admin-api.service';
import { phDiscountLabel } from '../inventory/ph-discount.util';
import { normalizeTopupMode, type TopupMode } from './quotation-topup.util';

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
  readonly shareMessage = signal('');
  readonly shareBusy = signal(false);
  readonly shareUrl = signal('');
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
    return quote?.source === 'pcmazing';
  }

  canShare(): boolean {
    const quote = this.quotation();
    if (!quote || quote.source !== 'pcmazing') {
      return false;
    }
    if (!quote.expiresAt) {
      return true;
    }
    const expires = new Date(quote.expiresAt).getTime();
    return Number.isFinite(expires) && expires > Date.now();
  }

  async copyShareLink(): Promise<void> {
    const quote = this.quotation();
    if (!quote || !this.canShare() || this.shareBusy()) {
      return;
    }
    this.shareBusy.set(true);
    this.shareMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.ensureQuotationShareLink(quote.id));
      const url = `${window.location.origin}${response.data.path}`;
      this.shareUrl.set(url);
      await navigator.clipboard.writeText(url);
      this.shareMessage.set('Share link copied to clipboard.');
      this.quotation.update((current) => (current ? { ...current, hasShareToken: true } : current));
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message ?? '')
          : '';
      this.error.set(message || 'Unable to create share link.');
    } finally {
      this.shareBusy.set(false);
    }
  }

  async regenerateShareLink(): Promise<void> {
    const quote = this.quotation();
    if (!quote || !this.canShare() || this.shareBusy()) {
      return;
    }
    if (!window.confirm('Regenerate share link? The previous link will stop working.')) {
      return;
    }
    this.shareBusy.set(true);
    this.shareMessage.set('');
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.regenerateQuotationShareLink(quote.id));
      const url = `${window.location.origin}${response.data.path}`;
      this.shareUrl.set(url);
      await navigator.clipboard.writeText(url);
      this.shareMessage.set('New share link copied. Previous links are invalid.');
      this.quotation.update((current) => (current ? { ...current, hasShareToken: true } : current));
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message ?? '')
          : '';
      this.error.set(message || 'Unable to regenerate share link.');
    } finally {
      this.shareBusy.set(false);
    }
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

  lineBaseUnitPrice(item: QuotationDetail['items'][number]): number {
    return item.baseUnitPrice != null ? Number(item.baseUnitPrice) : Number(item.unitPrice) || 0;
  }

  lineTopupMode(item: QuotationDetail['items'][number]): TopupMode {
    return normalizeTopupMode(item.topupMode);
  }

  lineTopupLabel(item: QuotationDetail['items'][number]): string {
    const mode = this.lineTopupMode(item);
    const value = Number(item.topupValue ?? 0);
    if (mode === 'fixed') {
      return `Fixed +${this.formatMoney(value)}`;
    }
    if (mode === 'percent') {
      return `${value}%`;
    }
    return 'None';
  }

  lineTopupTotal(item: QuotationDetail['items'][number]): number {
    if (item.lineTopupTotal != null) {
      return Number(item.lineTopupTotal) || 0;
    }
    const base = this.lineBaseUnitPrice(item);
    const charged = Number(item.unitPrice) || 0;
    const qty = Number(item.quantity) || 0;
    return Math.round((charged - base) * qty * 100) / 100;
  }

  quoteTotalTopup(quote: QuotationDetail): number {
    if (quote.totalTopup != null) {
      return Number(quote.totalTopup) || 0;
    }
    return quote.items.reduce((sum, item) => sum + this.lineTopupTotal(item), 0);
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
