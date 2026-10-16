import { resolveManualTotalFlags } from './quotation-manual-total.util';

describe('resolveManualTotalFlags', () => {
  it('uses calculated total when manual off', () => {
    expect(
      resolveManualTotalFlags({
        useManualTotal: false,
        hideItemPrices: true,
        calculatedTotalAmount: 1500,
        manualTotalAmount: 999,
      }),
    ).toEqual({
      useManualTotal: false,
      manualTotalAmount: 999,
      hideItemPrices: true,
      totalAmount: 1500,
    });
  });

  it('forces hide and uses manual amount when manual on', () => {
    expect(
      resolveManualTotalFlags({
        useManualTotal: true,
        hideItemPrices: false,
        calculatedTotalAmount: 1500,
        manualTotalAmount: 1200,
      }),
    ).toEqual({
      useManualTotal: true,
      manualTotalAmount: 1200,
      hideItemPrices: true,
      totalAmount: 1200,
    });
  });

  it('throws when manual on without valid amount', () => {
    expect(() =>
      resolveManualTotalFlags({
        useManualTotal: true,
        calculatedTotalAmount: 100,
        manualTotalAmount: null,
      }),
    ).toThrow(/manual total/i);
  });
});
