import { PrintDocumentType } from './printing.types';

export interface PrintFieldDefinition {
  key: string;
  label: string;
  sample: string;
  documentTypes: PrintDocumentType[];
}

export const PRINT_FIELD_DEFINITIONS: PrintFieldDefinition[] = [
  {
    key: 'reprintedLabel',
    label: 'Reprinted label',
    sample: 'REPRINTED',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'printedAt',
    label: 'Printed date/time',
    sample: '8/10/2026 3:45:12 PM',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'printedDate',
    label: 'Printed date',
    sample: '8/10/2026',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'storeCode',
    label: 'Store code',
    sample: 'Store: 1',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'workstationNo',
    label: 'Workstation',
    sample: 'Workstation: 1',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'pageNumber',
    label: 'Page number',
    sample: 'Page 1',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'storeLogo',
    label: 'Store logo',
    sample: '[Logo]',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'storeName',
    label: 'Store name',
    sample: 'PCmazing',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'storeAddress',
    label: 'Store address',
    sample: 'Mabini Extension, Cabanatuan City, 3100',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'receiptNo',
    label: 'Receipt number',
    sample: 'Sales Receipt #000123',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'cashierName',
    label: 'Cashier',
    sample: 'Cashier: Juan Dela Cruz',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'customerName',
    label: 'Customer / Bill To',
    sample: 'Maria Santos',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'lineItems',
    label: 'Line items table',
    sample: 'Item Name · Description · Qty · Regular Price · Discount · Ext Price',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'discountTotal',
    label: 'Total sales discounts',
    sample: 'Total Sales Discounts: P150.00',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'subtotal',
    label: 'Subtotal',
    sample: 'Subtotal  P1,250.00',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'receiptTotal',
    label: 'Receipt total',
    sample: 'RECEIPT TOTAL  P1,100.00',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'warrantyPolicy',
    label: 'Warranty policy block',
    sample: '“PCmazing Warranty Policy” · Major PC Parts · Accessories · No receipt, no warranty',
    documentTypes: ['sales_receipt', 'custom'],
  },
  {
    key: 'footerNote',
    label: 'Footer tax note',
    sample: 'This slip is not valid for input tax',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'thanksMessage',
    label: 'Thanks message',
    sample: 'Thanks for shopping with us!',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'barcode',
    label: 'Barcode',
    sample: '||||| 000123 |||||',
    documentTypes: ['sales_receipt', 'invoice', 'custom'],
  },
  {
    key: 'signatureLine',
    label: 'Signature line',
    sample: '________________',
    documentTypes: ['sales_receipt', 'quotation', 'invoice', 'custom'],
  },
  {
    key: 'quotationNo',
    label: 'Quotation number',
    sample: 'QT-000045',
    documentTypes: ['quotation', 'custom'],
  },
  {
    key: 'validUntil',
    label: 'Valid until',
    sample: '8/17/2026',
    documentTypes: ['quotation', 'custom'],
  },
];

export function fieldsForDocument(documentType: PrintDocumentType): PrintFieldDefinition[] {
  return PRINT_FIELD_DEFINITIONS.filter((field) => field.documentTypes.includes(documentType));
}

export function sampleForField(fieldKey?: string): string {
  return PRINT_FIELD_DEFINITIONS.find((field) => field.key === fieldKey)?.sample ?? '{{value}}';
}
