import {
  normalizeSalesType,
  normalizeMoney,
  computeInvoicePaymentSummary,
  SO_INVOICE_MAX_ITEMS,
} from './sales-invoice.util';

describe('sales-invoice.util', () => {
  it('defaults sales type to cash', () => {
    expect(normalizeSalesType(null)).toBe('cash');
    expect(normalizeSalesType(undefined)).toBe('cash');
    expect(normalizeSalesType('CHARGE')).toBe('charge');
    expect(normalizeSalesType('cash')).toBe('cash');
    expect(normalizeSalesType('weird')).toBe('cash');
  });

  it('normalizes money to non-negative 2dp', () => {
    expect(normalizeMoney(null)).toBe(0);
    expect(normalizeMoney(-5)).toBe(0);
    expect(normalizeMoney('12.345')).toBe(12.35);
    expect(normalizeMoney(100)).toBe(100);
  });

  it('computes due/change/balance', () => {
    expect(
      computeInvoicePaymentSummary({
        totalSales: 1000,
        withholdingTax: 100,
        amountPaid: 500,
      }),
    ).toEqual({
      totalSales: 1000,
      withholdingTax: 100,
      amountDue: 900,
      amountPaid: 500,
      change: 0,
      balance: 400,
    });

    expect(
      computeInvoicePaymentSummary({
        totalSales: 1000,
        withholdingTax: 0,
        amountPaid: 1200,
      }),
    ).toEqual({
      totalSales: 1000,
      withholdingTax: 0,
      amountDue: 1000,
      amountPaid: 1200,
      change: 200,
      balance: 0,
    });
  });

  it('exposes max items = 20', () => {
    expect(SO_INVOICE_MAX_ITEMS).toBe(20);
  });
});
