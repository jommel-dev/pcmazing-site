export type SalesType = 'cash' | 'charge';

export const SO_INVOICE_MAX_ITEMS = 20;

export function normalizeSalesType(v?: string | null): SalesType {
  const raw = String(v ?? '')
    .trim()
    .toLowerCase();
  return raw === 'charge' ? 'charge' : 'cash';
}

export function normalizeMoney(v?: number | string | null): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

export function computeInvoicePaymentSummary(input: {
  totalSales: number;
  withholdingTax: number;
  amountPaid: number;
}): {
  totalSales: number;
  withholdingTax: number;
  amountDue: number;
  amountPaid: number;
  change: number;
  balance: number;
} {
  const totalSales = normalizeMoney(input.totalSales);
  const withholdingTax = normalizeMoney(input.withholdingTax);
  const amountPaid = normalizeMoney(input.amountPaid);
  const amountDue = normalizeMoney(Math.max(0, totalSales - withholdingTax));
  const change = normalizeMoney(Math.max(0, amountPaid - amountDue));
  const balance = normalizeMoney(Math.max(0, amountDue - amountPaid));
  return { totalSales, withholdingTax, amountDue, amountPaid, change, balance };
}
