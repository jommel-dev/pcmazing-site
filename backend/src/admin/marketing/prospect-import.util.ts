import { BadRequestException } from '@nestjs/common';
import { CLIENT_TYPES, normalizeCurrencyCode, SUPPORTED_CURRENCIES } from './prospect-deal.util';

export const PROSPECT_IMPORT_TEMPLATE_CSV = [
  'client_name,company,email,phone,address,client_type,currency,proposed_price_deal,notes',
  'Juan Dela Cruz,ABC Trading,juan@example.com,09171234567,"123 Main St, Manila",local,PHP,150000,Sample local prospect',
  'Jane Smith,Global Corp,jane@example.com,+1-555-0100,"New York, USA",international,USD,5000,Sample international prospect',
].join('\n');

export interface ProspectImportRow {
  rowNumber: number;
  clientName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  clientType: string;
  currency: string;
  proposedPriceDeal: number | null;
}

export interface ProspectImportSkippedRow {
  rowNumber: number;
  reason: string;
}

export interface ProspectImportPreview {
  totalDataRows: number;
  validRows: number;
  skippedRows: number;
  previewRows: ProspectImportRow[];
  skippedDetails: ProspectImportSkippedRow[];
}

export function parseProspectImportContent(content: string): {
  validRows: ProspectImportRow[];
  skippedDetails: ProspectImportSkippedRow[];
} {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { validRows: [], skippedDetails: [] };
  }

  const headers = parseDelimitedLine(lines[0]).map((header) => normalizeHeader(header));
  const validRows: ProspectImportRow[] = [];
  const skippedDetails: ProspectImportSkippedRow[] = [];

  lines.slice(1).forEach((line, index) => {
    const rowNumber = index + 2;
    const values = parseDelimitedLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, headerIndex) => {
      record[header] = (values[headerIndex] ?? '').trim();
    });

    const clientName =
      record['client_name'] ||
      record['name'] ||
      record['full_name'] ||
      record['client'] ||
      record['customer_name'] ||
      '';

    if (!clientName) {
      skippedDetails.push({ rowNumber, reason: 'Missing client name' });
      return;
    }

    const clientTypeRaw = (record['client_type'] || record['type'] || 'local').toLowerCase();
    if (!CLIENT_TYPES.includes(clientTypeRaw as (typeof CLIENT_TYPES)[number])) {
      skippedDetails.push({ rowNumber, reason: `Invalid client_type "${clientTypeRaw}" (use local or international)` });
      return;
    }

    const currency = normalizeCurrencyCode(record['currency'] || 'PHP');
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
      skippedDetails.push({ rowNumber, reason: `Unsupported currency "${currency}"` });
      return;
    }

    const proposedRaw = record['proposed_price_deal'] || record['proposed_deal'] || record['deal_amount'] || '';
    let proposedPriceDeal: number | null = null;
    if (proposedRaw) {
      const parsed = Number(proposedRaw.replace(/,/g, ''));
      if (!Number.isFinite(parsed) || parsed < 0) {
        skippedDetails.push({ rowNumber, reason: 'Invalid proposed_price_deal amount' });
        return;
      }
      proposedPriceDeal = parsed;
    }

    validRows.push({
      rowNumber,
      clientName,
      company: record['company'] || record['organization'] || null,
      email: record['email'] || null,
      phone: record['phone'] || record['contact_number'] || record['mobile'] || null,
      address: record['address'] || null,
      notes: record['notes'] || record['remarks'] || null,
      clientType: clientTypeRaw,
      currency,
      proposedPriceDeal,
    });
  });

  return { validRows, skippedDetails };
}

export function buildProspectImportPreview(content: string): ProspectImportPreview {
  const { validRows, skippedDetails } = parseProspectImportContent(content);
  const totalDataRows = validRows.length + skippedDetails.length;

  if (totalDataRows === 0) {
    throw new BadRequestException('No data rows found. Use the template and include at least one client row.');
  }

  return {
    totalDataRows,
    validRows: validRows.length,
    skippedRows: skippedDetails.length,
    previewRows: validRows.slice(0, 10),
    skippedDetails: skippedDetails.slice(0, 20),
  };
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '');
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
