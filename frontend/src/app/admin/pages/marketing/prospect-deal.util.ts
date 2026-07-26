export const CLIENT_TYPE_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'international', label: 'International' },
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'PHP', label: 'PHP — Philippine Peso' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'SGD', label: 'SGD — Singapore Dollar' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'HKD', label: 'HKD — Hong Kong Dollar' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AED', label: 'AED — UAE Dirham' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
] as const;

export function clientTypeLabel(value?: string | null): string {
  return CLIENT_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? value ?? '—';
}

export function isPhpCurrency(value?: string | null): boolean {
  return (value?.trim().toUpperCase() || 'PHP') === 'PHP';
}

export function formatDealAmount(amount: number | null | undefined, currency = 'PHP'): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseProposedPriceDeal(value: string | number | null | undefined): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function projectDealPhp(
  proposedPriceDeal: number | null | undefined,
  estimatedPriceDealPhp: number | null | undefined,
): number | null {
  if (estimatedPriceDealPhp != null) {
    return estimatedPriceDealPhp;
  }
  return proposedPriceDeal ?? null;
}

export function parseCommissionPercent(value: string | number | null | undefined): number | null {
  if (value === '' || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }
  return parsed;
}

export function formatCommissionPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${value}%`;
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
