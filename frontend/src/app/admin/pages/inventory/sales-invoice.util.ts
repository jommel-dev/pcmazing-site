import { JO_FORM_LETTERHEAD_FALLBACK } from './job-order-intake.util';

export const SO_INVOICE_MAX_ITEMS = 20;

/** Same letterhead as JO Form / paper Sales Invoice. */
export const SALES_INVOICE_LETTERHEAD = JO_FORM_LETTERHEAD_FALLBACK;

/** Exact V1 Terms & Conditions from the PCmazing Sales Invoice paper form. */
export const SALES_INVOICE_TERMS: string[] = [
  'Please retain this Sales Invoice as proof of purchase.',
  "Warranty is subject to the stated manufacturer's or PCmazing's warranty coverage and warranty exclusions.",
  'Warranty does not cover physical or liquid damage, misuse, unauthorized repair or tampering, or normal wear and tear, unless specifically covered by the applicable warranty.',
  'Please report any discrepancies (e.g., quantity, model, or missing items) immediately upon receipt.',
  'Returns, exchanges, and refunds are subject to applicable Philippine consumer protection laws and the stated warranty/return policy.',
  'Special-order items and deposits are subject to the written order terms and applicable law.',
  'Prices and availability are subject to confirmation before purchase.',
];

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

export function padInvoiceRows<T>(items: T[], size = SO_INVOICE_MAX_ITEMS): Array<T | null> {
  const capped = items.slice(0, size);
  const rows: Array<T | null> = [...capped];
  while (rows.length < size) {
    rows.push(null);
  }
  return rows;
}

/** Show money only when there is a filled line; blank rows stay empty for handwriting. */
export function formatInvoiceMoney(value: number | '' | null | undefined): string {
  if (value === '' || value == null) {
    return '';
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return '';
  }
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
