export type TopupMode = 'none' | 'fixed' | 'percent';

function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeChargedUnitPrice(
  baseUnitPrice: number,
  mode: TopupMode,
  topupValue: number,
): number {
  const base = Number(baseUnitPrice);
  const topup = Number(topupValue);
  if (!Number.isFinite(base) || base < 0) {
    throw new Error('baseUnitPrice must be a non-negative number');
  }
  if (!Number.isFinite(topup) || topup < 0) {
    throw new Error('topupValue must be a non-negative number');
  }
  if (mode === 'fixed') return roundMoney(base + topup);
  if (mode === 'percent') return roundMoney(base * (1 + topup / 100));
  return roundMoney(base);
}

export function computeLineTopupTotal(
  baseUnitPrice: number,
  chargedUnitPrice: number,
  quantity: number,
): number {
  return roundMoney((Number(chargedUnitPrice) - Number(baseUnitPrice)) * Number(quantity));
}
