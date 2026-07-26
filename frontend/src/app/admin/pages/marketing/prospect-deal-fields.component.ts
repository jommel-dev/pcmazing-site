import { Component, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subject, debounceTime, firstValueFrom, takeUntil } from 'rxjs';
import { AdminApiService } from '../../services/admin-api.service';
import { CURRENCY_OPTIONS, CLIENT_TYPE_OPTIONS, commissionAmountFromPercent, formatCommissionPercent, formatDealAmount, isPhpCurrency, parseCommissionPercent, parseProposedPriceDeal, projectDealPhp } from './prospect-deal.util';

@Component({
  selector: 'app-prospect-deal-fields',
  imports: [ReactiveFormsModule],
  templateUrl: './prospect-deal-fields.component.html',
})
export class ProspectDealFieldsComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) group!: FormGroup;
  @Input() showCommissioned = false;

  readonly clientTypeOptions = CLIENT_TYPE_OPTIONS;
  readonly currencyOptions = CURRENCY_OPTIONS;
  readonly formatDealAmount = formatDealAmount;
  readonly formatCommissionPercent = formatCommissionPercent;

  estimatedPhp: number | null = null;
  exchangeRate: number | null = null;
  exchangeRateDate: string | null = null;
  estimateLoading = false;
  estimateError = '';

  ngOnInit(): void {
    this.group.valueChanges
      .pipe(debounceTime(350), takeUntil(this.destroy$))
      .subscribe(() => {
        void this.refreshEstimate();
      });

    void this.refreshEstimate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  showEstimatedDeal(): boolean {
    return !isPhpCurrency(this.group.controls['currency']?.value);
  }

  previewCommissionAmount(): number | null {
    if (!this.showCommissioned) {
      return null;
    }
    const percent = parseCommissionPercent(this.group.controls['commissionPercent']?.value);
    const deal = projectDealPhp(
      parseProposedPriceDeal(this.group.controls['proposedPriceDeal']?.value),
      this.estimatedPhp,
    );
    if (percent == null || deal == null) {
      return null;
    }
    return commissionAmountFromPercent(deal, percent);
  }

  private async refreshEstimate(): Promise<void> {
    const currency = this.group.controls['currency']?.value ?? 'PHP';
    const proposedRaw = this.group.controls['proposedPriceDeal']?.value;
    const proposed = proposedRaw === '' || proposedRaw === null || proposedRaw === undefined
      ? null
      : Number(proposedRaw);

    if (!this.showEstimatedDeal() || proposed === null || !Number.isFinite(proposed) || proposed < 0) {
      this.estimatedPhp = null;
      this.exchangeRate = null;
      this.exchangeRateDate = null;
      this.estimateError = '';
      return;
    }

    this.estimateLoading = true;
    this.estimateError = '';
    try {
      const response = await firstValueFrom(this.adminApi.convertDealEstimate(currency, proposed));
      this.estimatedPhp = response.data.convertedAmount;
      this.exchangeRate = response.data.rate;
      this.exchangeRateDate = response.data.rateDate;
    } catch {
      this.estimatedPhp = null;
      this.exchangeRate = null;
      this.exchangeRateDate = null;
      this.estimateError = 'Unable to fetch live PHP conversion right now.';
    } finally {
      this.estimateLoading = false;
    }
  }
}
