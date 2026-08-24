export const A4_PRINT_WIDTH_MM = 210;
export const A4_PRINT_HEIGHT_MM = 297;
export const A4_PRINT_MARGIN_MM = 8;

export function receiptPrintPageCss(options: {
  widthMm?: number | null;
  heightMm?: number | null;
  marginTopMm?: number | null;
  marginRightMm?: number | null;
  marginBottomMm?: number | null;
  marginLeftMm?: number | null;
} = {}): string {
  const width = Number(options.widthMm) || A4_PRINT_WIDTH_MM;
  const height = width >= 190 ? A4_PRINT_HEIGHT_MM : Number(options.heightMm) || A4_PRINT_HEIGHT_MM;
  const margin = A4_PRINT_MARGIN_MM;

  return `@media print {
  @page {
    size: ${width}mm ${height}mm;
    margin: ${margin}mm;
  }

  html,
  body,
  body.admin-shell-active {
    width: auto !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .admin-print-root,
  .admin-print-main,
  .receipt-page {
    display: block !important;
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .receipt-sheet,
  .receipt-sheet-template {
    width: 100% !important;
    max-width: none !important;
    margin: 0 auto !important;
    padding: 0 !important;
    box-sizing: border-box !important;
    overflow: visible !important;
  }

  .receipt-sheet.job-order-builtin {
    padding: 10mm !important;
  }

  .receipt-warranty,
  .warranty-text {
    overflow: visible !important;
    height: auto !important;
    margin: 1mm auto 0.5mm !important;
    line-height: 1.2 !important;
    page-break-inside: auto;
    break-inside: auto;
  }

  .receipt-footer {
    margin-top: 0 !important;
  }

  .receipt-footer p {
    margin: 0 !important;
    line-height: 1.2 !important;
  }

  .receipt-footer .thanks {
    margin: 0.5mm 0 !important;
  }

  .receipt-barcode-wrap {
    margin: 1mm auto 0.5mm !important;
  }

  .barcode-label {
    margin: 0 !important;
  }

  .receipt-signature {
    margin-top: 1mm !important;
  }

  .receipt-signature span {
    height: 4px !important;
  }

  .receipt-barcode {
    height: 28px !important;
  }

  .job-order-builtin .receipt-totals {
    margin-bottom: 8mm !important;
  }

  .job-order-builtin .receipt-warranty,
  .job-order-builtin .warranty-text {
    margin: 8mm auto 6mm !important;
    line-height: 1.55 !important;
  }

  .job-order-builtin .receipt-footer {
    margin-top: 6mm !important;
  }

  .job-order-builtin .receipt-footer p {
    margin: 0 0 5mm !important;
    line-height: 1.4 !important;
  }

  .job-order-builtin .receipt-footer .thanks {
    margin: 5mm 0 6mm !important;
  }

  .job-order-builtin .receipt-barcode-wrap {
    margin: 6mm auto 5mm !important;
  }

  .job-order-builtin .receipt-barcode {
    height: 40px !important;
  }

  .job-order-builtin .barcode-label {
    margin: 2.5mm 0 0 !important;
  }

  .job-order-builtin .receipt-signature {
    margin-top: 8mm !important;
  }

  .job-order-builtin .receipt-signature span {
    height: 18px !important;
  }

  .receipt-barcode,
  .receipt-barcode span,
  .template-receipt-barcode {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .receipt-barcode span.filled,
  .receipt-barcode span.bar-on {
    background: #111 !important;
    background-color: #111 !important;
  }

  .template-print-element.wrap-content {
    overflow: visible !important;
  }

  .template-print-element.wrap-content .template-field-text {
    height: auto !important;
    white-space: pre-wrap !important;
  }
}`;
}

export function barcodeBarStyle(bar: { width: number; filled: boolean }): Record<string, string> {
  return {
    width: `${bar.width}px`,
    height: '100%',
    display: 'inline-block',
    background: bar.filled ? '#111' : 'transparent',
    backgroundColor: bar.filled ? '#111' : 'transparent',
  };
}

export function receiptPrintCssIsValid(css: string): boolean {
  const page = css.match(/@page\s*\{[\s\S]*?\}/)?.[0] ?? '';
  const hasA4 = page.includes(`${A4_PRINT_WIDTH_MM}mm`) && page.includes(`${A4_PRINT_HEIGHT_MM}mm`);
  const hasEqualMargin = new RegExp(`margin:\\s*${A4_PRINT_MARGIN_MM}mm\\s*;`).test(page);
  const hasBarcodeInk = css.includes('print-color-adjust: exact');
  return hasA4 && hasEqualMargin && hasBarcodeInk;
}
