import { BadRequestException } from '@nestjs/common';

export const MATERIAL_IMPORT_TEMPLATE_CSV = [
  'material_code,material_name,brand_name,product_type_name,unit,unit_price,order_cost,sell_price,on_hand_stock,reorder_level,description',
  'SSD-1TB,Kingston NV1 1TB,Kingston,Storage,PCS,8500,7800,10500,12,3,1TB NVMe SSD',
  'RAM-8GB,RAM 8GB SODIMM,Kingston,Memory,PCS,1200,980,1500,25,5,DDR4 laptop memory',
  'KB-01,Wireless Keyboard,,Accessories,PCS,450,320,699,40,10,',
].join('\n');

export interface MaterialImportRow {
  rowNumber: number;
  materialCode: string | null;
  materialName: string;
  brandName: string | null;
  productTypeName: string | null;
  unit: string | null;
  unitPrice: number | null;
  orderCost: number | null;
  sellPrice: number | null;
  onHandStock: number | null;
  reorderLevel: number | null;
  description: string | null;
  action: 'create' | 'update';
}

export interface MaterialImportSkippedRow {
  rowNumber: number;
  reason: string;
}

export interface MaterialImportPreview {
  totalDataRows: number;
  validRows: number;
  skippedRows: number;
  createCount: number;
  updateCount: number;
  previewRows: MaterialImportRow[];
  skippedDetails: MaterialImportSkippedRow[];
}

export function parseMaterialImportContent(content: string): {
  validRows: MaterialImportRow[];
  skippedDetails: MaterialImportSkippedRow[];
} {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return { validRows: [], skippedDetails: [] };
  }

  const headers = parseDelimitedLine(lines[0]).map((header) => normalizeHeader(header));
  const validRows: MaterialImportRow[] = [];
  const skippedDetails: MaterialImportSkippedRow[] = [];

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseDelimitedLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      record[header] = (values[headerIndex] ?? '').trim();
    });

    const materialName =
      record['material_name'] ||
      record['name'] ||
      record['product_name'] ||
      record['item_name'] ||
      '';
    if (!materialName) {
      skippedDetails.push({ rowNumber, reason: 'Missing material_name.' });
      return;
    }

    const materialCode =
      record['material_code'] ||
      record['code'] ||
      record['sku'] ||
      record['item_code'] ||
      '';

    const unitPrice = parseOptionalNumber(
      record['unit_price'] || record['cost'] || record['price_cost'],
    );
    const orderCost = parseOptionalNumber(record['order_cost'] || record['order_price']);
    const sellPrice = parseOptionalNumber(
      record['sell_price'] || record['srp'] || record['price'],
    );
    const onHandStock = parseOptionalInteger(
      record['on_hand_stock'] || record['stock'] || record['qty'] || record['quantity'],
    );
    const reorderLevel = parseOptionalInteger(
      record['reorder_level'] || record['reorder'] || record['min_stock'],
    );

    if (unitPrice === undefined || orderCost === undefined || sellPrice === undefined) {
      skippedDetails.push({ rowNumber, reason: 'Invalid number in price/cost fields.' });
      return;
    }
    if (onHandStock === undefined || reorderLevel === undefined) {
      skippedDetails.push({ rowNumber, reason: 'Invalid number in stock fields.' });
      return;
    }

    validRows.push({
      rowNumber,
      materialCode: materialCode || null,
      materialName,
      brandName: record['brand_name'] || record['brand'] || null,
      productTypeName:
        record['product_type_name'] || record['product_type'] || record['category'] || null,
      unit: record['unit'] || null,
      unitPrice,
      orderCost,
      sellPrice,
      onHandStock,
      reorderLevel,
      description: record['description'] || record['notes'] || null,
      action: 'create',
    });
  });

  return { validRows, skippedDetails };
}

export function buildMaterialImportPreview(
  content: string,
  existingCodes: Set<string>,
): MaterialImportPreview {
  const { validRows, skippedDetails } = parseMaterialImportContent(content);
  const totalDataRows = validRows.length + skippedDetails.length;

  if (totalDataRows === 0) {
    throw new BadRequestException(
      'No data rows found. Use the template and include at least one product row.',
    );
  }

  const rows = validRows.map((row) => {
    const code = row.materialCode?.trim().toLowerCase();
    const action: 'create' | 'update' = code && existingCodes.has(code) ? 'update' : 'create';
    return { ...row, action };
  });

  return {
    totalDataRows,
    validRows: rows.length,
    skippedRows: skippedDetails.length,
    createCount: rows.filter((row) => row.action === 'create').length,
    updateCount: rows.filter((row) => row.action === 'update').length,
    previewRows: rows.slice(0, 10),
    skippedDetails: skippedDetails.slice(0, 20),
  };
}

export function toCsvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildMaterialsExportCsv(
  rows: Array<{
    materialCode: string | null;
    materialName: string;
    brandName: string | null;
    productTypeName: string | null;
    unit: string | null;
    unitPrice: number | null;
    orderCost: number | null;
    sellPrice: number | null;
    onHandStock: number | null;
    reorderLevel: number | null;
    description: string | null;
  }>,
): string {
  const header =
    'material_code,material_name,brand_name,product_type_name,unit,unit_price,order_cost,sell_price,on_hand_stock,reorder_level,description';
  const lines = rows.map((row) =>
    [
      toCsvCell(row.materialCode),
      toCsvCell(row.materialName),
      toCsvCell(row.brandName),
      toCsvCell(row.productTypeName),
      toCsvCell(row.unit),
      toCsvCell(row.unitPrice),
      toCsvCell(row.orderCost),
      toCsvCell(row.sellPrice),
      toCsvCell(row.onHandStock),
      toCsvCell(row.reorderLevel),
      toCsvCell(row.description),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}

function parseOptionalNumber(value: string | undefined): number | null | undefined {
  if (value == null || value.trim() === '') {
    return null;
  }
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined;
  }
  return Number(parsed.toFixed(2));
}

function parseOptionalInteger(value: string | undefined): number | null | undefined {
  if (value == null || value.trim() === '') {
    return null;
  }
  const normalized = value.replace(/,/g, '').trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseDelimitedLine(line: string): string[] {
  const delimiter = line.includes('\t') ? '\t' : ',';
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}
