export type TopupMode = 'none' | 'fixed' | 'percent';

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalizeTopupMode(value: string | null | undefined): TopupMode {
  if (value === 'fixed' || value === 'percent') {
    return value;
  }
  return 'none';
}

/** Mirror backend `quotation-topup.util` charged unit price. */
export function computeChargedUnitPrice(
  baseUnitPrice: number,
  mode: TopupMode,
  topupValue: number,
): number {
  const base = Number(baseUnitPrice) || 0;
  const topup = Math.max(0, Number(topupValue) || 0);
  if (mode === 'fixed') {
    return roundMoney(base + topup);
  }
  if (mode === 'percent') {
    return roundMoney(base * (1 + topup / 100));
  }
  return roundMoney(base);
}

export function computeLineTopupTotal(
  baseUnitPrice: number,
  chargedUnitPrice: number,
  quantity: number,
): number {
  return roundMoney((Number(chargedUnitPrice) - Number(baseUnitPrice)) * (Number(quantity) || 0));
}
