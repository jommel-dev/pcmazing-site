export const CLIENT_TYPES = ['local', 'international'] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const SUPPORTED_CURRENCIES = [
  'PHP',
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'SGD',
  'JPY',
  'HKD',
  'CAD',
  'AED',
  'SAR',
  'CNY',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function normalizeCurrencyCode(value?: string | null): string {
  return (value?.trim().toUpperCase() || 'PHP').slice(0, 3);
}

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function isPhpCurrency(value?: string | null): boolean {
  return normalizeCurrencyCode(value) === 'PHP';
}

export function projectDealPhpValue(
  proposedPriceDeal: number | null | undefined,
  estimatedPriceDealPhp: number | null | undefined,
): number {
  if (estimatedPriceDealPhp != null) {
    return estimatedPriceDealPhp;
  }
  return proposedPriceDeal ?? 0;
}

export function commissionAmountFromPercent(
  projectDealPhp: number | null | undefined,
  commissionPercent: number | null | undefined,
): number {
  if (projectDealPhp == null || commissionPercent == null) {
    return 0;
  }
  return Math.round(projectDealPhp * commissionPercent) / 100;
}

export function netProjectDealAfterCommission(
  projectDealPhp: number | null | undefined,
  commissionPercent: number | null | undefined,
): number {
  const deal = projectDealPhp ?? 0;
  return deal - commissionAmountFromPercent(projectDealPhp, commissionPercent);
}
