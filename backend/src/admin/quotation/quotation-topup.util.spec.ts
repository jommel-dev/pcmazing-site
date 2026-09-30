import { computeChargedUnitPrice, computeLineTopupTotal } from './quotation-topup.util';

describe('quotation-topup.util', () => {
  it('none returns base', () => {
    expect(computeChargedUnitPrice(1000, 'none', 50)).toBe(1000);
  });
  it('fixed adds pesos', () => {
    expect(computeChargedUnitPrice(1000, 'fixed', 150)).toBe(1150);
  });
  it('percent applies markup', () => {
    expect(computeChargedUnitPrice(1000, 'percent', 10)).toBe(1100);
  });
  it('line topup total uses qty', () => {
    expect(computeLineTopupTotal(1000, 1150, 2)).toBe(300);
  });
});
