export type PrintPaperSize = 'A4' | 'Letter' | 'Receipt80' | 'Receipt58';
export type PrintDocumentType = 'sales_receipt' | 'quotation' | 'invoice' | 'custom';
export type PrintElementType = 'text' | 'field' | 'image' | 'line' | 'table';
export type PrinterConnectionType = 'direct' | 'network' | 'bluetooth';
export type PrinterTestStatus = 'never' | 'ok' | 'failed';

export interface PrintLayoutElement {
  id: string;
  type: PrintElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label?: string;
  fieldKey?: string;
  content?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  textAlign?: 'left' | 'center' | 'right';
}

export interface PrintLayout {
  elements: PrintLayoutElement[];
}

export function roundMm(value: unknown, decimals = 2): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const factor = 10 ** decimals;
  return Math.round(numeric * factor) / factor;
}

export function sanitizeLayoutElement(element: PrintLayoutElement): PrintLayoutElement {
  return {
    ...element,
    x: roundMm(element.x),
    y: roundMm(element.y),
    width: element.width == null ? element.width : roundMm(element.width),
    height: element.height == null ? element.height : roundMm(element.height),
    fontSize: element.fontSize == null ? element.fontSize : roundMm(element.fontSize, 1),
  };
}

export function sanitizeLayoutElements(elements: PrintLayoutElement[]): PrintLayoutElement[] {
  return elements.map((element) => sanitizeLayoutElement(element));
}

export interface PrintingSettings {
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeCode: string;
  workstationNo: string;
  paperSize: PrintPaperSize;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  defaultTemplateId: number | null;
  fontFamily: string;
  showPageNumbers: boolean;
  printerConnectionType: PrinterConnectionType;
  printerName: string;
  printerHost: string;
  printerPort: number;
  printerBluetoothDeviceId: string;
  printerBluetoothDeviceName: string;
  printerAutoPrint: boolean;
  printerLastTestedAt?: string | null;
  printerLastTestStatus?: PrinterTestStatus;
  printerLastTestMessage?: string;
  warrantyPolicy?: string;
  footerNote?: string;
  thanksMessage?: string;
  updatedAt?: string | null;
}

export interface PrintingTemplate {
  id: number;
  name: string;
  documentType: PrintDocumentType;
  paperWidthMm: number;
  paperHeightMm: number;
  layout: PrintLayout;
  isDefault: boolean;
  isActive: boolean;
  updatedAt?: string | null;
}

export const PAPER_SIZE_PRESETS: Record<
  PrintPaperSize,
  { label: string; widthMm: number; heightMm: number }
> = {
  A4: { label: 'A4', widthMm: 210, heightMm: 297 },
  Letter: { label: 'US Letter', widthMm: 216, heightMm: 279 },
  Receipt80: { label: '80mm Receipt', widthMm: 80, heightMm: 200 },
  Receipt58: { label: '58mm Receipt', widthMm: 58, heightMm: 200 },
};

export const CANVAS_SCALE = 3;

export function createElementId(prefix = 'el'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Matches the current Job Order sales receipt layout (A4). */
export function jobOrderSalesReceiptLayout(): PrintLayout {
  const id = (key: string) => `jo_${key}`;

  return {
    elements: [
      {
        id: id('printed_at'),
        type: 'field',
        fieldKey: 'printedAt',
        label: 'Printed',
        x: 10,
        y: 8,
        width: 90,
        height: 5,
        fontSize: 10,
        textAlign: 'left',
      },
      {
        id: id('store_code'),
        type: 'field',
        fieldKey: 'storeCode',
        label: 'Store',
        x: 10,
        y: 13,
        width: 90,
        height: 5,
        fontSize: 10,
      },
      {
        id: id('workstation'),
        type: 'field',
        fieldKey: 'workstationNo',
        label: 'Workstation',
        x: 10,
        y: 18,
        width: 90,
        height: 5,
        fontSize: 10,
      },
      {
        id: id('receipt_no'),
        type: 'field',
        fieldKey: 'receiptNo',
        label: 'Sales Receipt #',
        x: 110,
        y: 8,
        width: 90,
        height: 5,
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'right',
      },
      {
        id: id('printed_date'),
        type: 'field',
        fieldKey: 'printedDate',
        label: 'Date',
        x: 110,
        y: 13,
        width: 90,
        height: 5,
        fontSize: 10,
        textAlign: 'right',
      },
      {
        id: id('cashier'),
        type: 'field',
        fieldKey: 'cashierName',
        label: 'Cashier',
        x: 110,
        y: 18,
        width: 90,
        height: 5,
        fontSize: 10,
        textAlign: 'right',
      },
      {
        id: id('page'),
        type: 'field',
        fieldKey: 'pageNumber',
        label: 'Page',
        x: 110,
        y: 23,
        width: 90,
        height: 5,
        fontSize: 10,
        textAlign: 'right',
      },
      {
        id: id('reprinted'),
        type: 'field',
        fieldKey: 'reprintedLabel',
        label: 'Reprinted',
        x: 10,
        y: 32,
        width: 190,
        height: 5,
        fontSize: 10,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      {
        id: id('logo'),
        type: 'image',
        fieldKey: 'storeLogo',
        label: 'Store logo',
        x: 85,
        y: 38,
        width: 40,
        height: 18,
      },
      {
        id: id('store_name'),
        type: 'field',
        fieldKey: 'storeName',
        label: 'Store name',
        x: 10,
        y: 58,
        width: 190,
        height: 8,
        fontSize: 13,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      {
        id: id('store_address'),
        type: 'field',
        fieldKey: 'storeAddress',
        label: 'Store address',
        x: 10,
        y: 67,
        width: 190,
        height: 8,
        fontSize: 11,
        textAlign: 'center',
      },
      {
        id: id('bill_to'),
        type: 'field',
        fieldKey: 'billToLine',
        label: 'Bill To / Contact',
        x: 10,
        y: 78,
        width: 190,
        height: 7,
        fontSize: 11,
      },
      {
        id: id('address'),
        type: 'field',
        fieldKey: 'addressLine',
        label: 'Address',
        x: 10,
        y: 84,
        width: 190,
        height: 8,
        fontSize: 11,
      },
      {
        id: id('line_items'),
        type: 'table',
        fieldKey: 'lineItems',
        label: 'Line items',
        x: 10,
        y: 94,
        width: 190,
        height: 62,
        fontSize: 10,
      },
      {
        id: id('discount_total'),
        type: 'field',
        fieldKey: 'discountTotal',
        label: 'Total Sales Discounts',
        x: 10,
        y: 160,
        width: 90,
        height: 6,
        fontSize: 11,
      },
      {
        id: id('subtotal'),
        type: 'field',
        fieldKey: 'subtotal',
        label: 'Subtotal',
        x: 120,
        y: 160,
        width: 80,
        height: 6,
        fontSize: 11,
        textAlign: 'right',
      },
      {
        id: id('receipt_total'),
        type: 'field',
        fieldKey: 'receiptTotal',
        label: 'RECEIPT TOTAL',
        x: 120,
        y: 168,
        width: 80,
        height: 7,
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'right',
      },
      {
        id: id('downpayment'),
        type: 'field',
        fieldKey: 'downpaymentLine',
        label: 'Downpayment',
        x: 120,
        y: 176,
        width: 80,
        height: 6,
        fontSize: 11,
        textAlign: 'right',
      },
      {
        id: id('amount_paid'),
        type: 'field',
        fieldKey: 'amountPaidLine',
        label: 'Amount paid',
        x: 120,
        y: 182,
        width: 80,
        height: 6,
        fontSize: 11,
        textAlign: 'right',
      },
      {
        id: id('balance_due'),
        type: 'field',
        fieldKey: 'balanceDueLine',
        label: 'Balance due',
        x: 120,
        y: 188,
        width: 80,
        height: 6,
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'right',
      },
      {
        id: id('payment_method'),
        type: 'field',
        fieldKey: 'paymentMethodLine',
        label: 'Payment method',
        x: 120,
        y: 194,
        width: 80,
        height: 6,
        fontSize: 11,
        textAlign: 'right',
      },
      {
        id: id('warranty'),
        type: 'field',
        fieldKey: 'warrantyPolicy',
        label: 'Warranty policy',
        x: 18,
        y: 204,
        width: 174,
        height: 32,
        fontSize: 10,
        textAlign: 'center',
      },
      {
        id: id('footer_note'),
        type: 'field',
        fieldKey: 'footerNote',
        label: 'Footer tax note',
        x: 10,
        y: 238,
        width: 190,
        height: 5,
        fontSize: 10,
        textAlign: 'center',
      },
      {
        id: id('thanks'),
        type: 'field',
        fieldKey: 'thanksMessage',
        label: 'Thanks message',
        x: 10,
        y: 243,
        width: 190,
        height: 5,
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
      },
      {
        id: id('barcode'),
        type: 'field',
        fieldKey: 'barcode',
        label: 'Barcode',
        x: 70,
        y: 248,
        width: 70,
        height: 14,
        fontSize: 10,
        textAlign: 'center',
      },
      {
        id: id('signature'),
        type: 'field',
        fieldKey: 'signatureLine',
        label: 'Signature',
        x: 75,
        y: 264,
        width: 60,
        height: 5,
        fontSize: 10,
        textAlign: 'center',
      },
    ],
  };
}

/** @deprecated Prefer jobOrderSalesReceiptLayout for Job Order receipts. */
export function defaultSalesReceiptLayout(): PrintLayout {
  return jobOrderSalesReceiptLayout();
}
