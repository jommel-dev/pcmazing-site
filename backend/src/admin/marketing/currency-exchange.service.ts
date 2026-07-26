import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { isPhpCurrency, normalizeCurrencyCode } from './prospect-deal.util';

interface FrankfurterLatestResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

interface CachedRate {
  rate: number;
  rateDate: string;
  expiresAt: number;
}

export interface CurrencyConversionResult {
  fromCurrency: string;
  toCurrency: 'PHP';
  amount: number;
  convertedAmount: number;
  rate: number;
  rateDate: string;
}

@Injectable()
export class CurrencyExchangeService {
  private readonly cache = new Map<string, CachedRate>();
  private readonly cacheTtlMs = 60 * 60 * 1000;

  async convertToPhp(amount: number, fromCurrencyRaw?: string | null): Promise<CurrencyConversionResult> {
    const fromCurrency = normalizeCurrencyCode(fromCurrencyRaw);
    const normalizedAmount = Number(amount);

    if (!Number.isFinite(normalizedAmount) || normalizedAmount < 0) {
      throw new BadRequestException('Amount must be a non-negative number.');
    }

    if (isPhpCurrency(fromCurrency)) {
      return {
        fromCurrency,
        toCurrency: 'PHP',
        amount: normalizedAmount,
        convertedAmount: normalizedAmount,
        rate: 1,
        rateDate: new Date().toISOString().slice(0, 10),
      };
    }

    const rateInfo = await this.fetchRate(fromCurrency, 'PHP');
    const convertedAmount = this.roundMoney(normalizedAmount * rateInfo.rate);

    return {
      fromCurrency,
      toCurrency: 'PHP',
      amount: normalizedAmount,
      convertedAmount,
      rate: rateInfo.rate,
      rateDate: rateInfo.rateDate,
    };
  }

  private async fetchRate(fromCurrency: string, toCurrency: string): Promise<{ rate: number; rateDate: string }> {
    const cacheKey = `${fromCurrency}:${toCurrency}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { rate: cached.rate, rateDate: cached.rateDate };
    }

    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(fromCurrency)}&to=${encodeURIComponent(toCurrency)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch {
      throw new ServiceUnavailableException('Currency exchange service is unavailable.');
    }

    if (!response.ok) {
      throw new BadRequestException(`Unable to convert ${fromCurrency} to ${toCurrency}.`);
    }

    const payload = (await response.json()) as FrankfurterLatestResponse;
    const rate = payload.rates?.[toCurrency];
    if (!rate || !Number.isFinite(rate)) {
      throw new BadRequestException(`Exchange rate not available for ${fromCurrency} to ${toCurrency}.`);
    }

    const rateDate = payload.date || new Date().toISOString().slice(0, 10);
    this.cache.set(cacheKey, {
      rate,
      rateDate,
      expiresAt: Date.now() + this.cacheTtlMs,
    });

    return { rate, rateDate };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
