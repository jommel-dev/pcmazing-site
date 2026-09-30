export const LOCAL_PRICE_LIST_TEMPLATE_CSV =
  'title,price,sku,notes\n"Sample GPU 8GB",12500,SKU-1,"optional note"\n';

export interface LocalPriceListCsvRow {
  title: string;
  pricePhp: number;
  sku: string | null;
  notes: string | null;
}

export function parseLocalPriceListCsv(csvText: string): LocalPriceListCsvRow[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    throw new Error('CSV must include a header row with title and price columns');
  }

  const headers = parseDelimitedLine(lines[0]).map((header) => normalizeHeader(header));
  const titleIndex = findColumnIndex(headers, ['title']);
  const priceIndex = findColumnIndex(headers, ['price']);
  if (titleIndex < 0) {
    throw new Error('CSV header must include a title column');
  }
  if (priceIndex < 0) {
    throw new Error('CSV header must include a price column');
  }
  const skuIndex = findColumnIndex(headers, ['sku']);
  const notesIndex = findColumnIndex(headers, ['notes']);

  const rows: LocalPriceListCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseDelimitedLine(lines[i]);
    const title = (values[titleIndex] ?? '').trim();
    if (!title) {
      continue;
    }

    const priceRaw = (values[priceIndex] ?? '').trim().replace(/,/g, '');
    const pricePhp = Number(priceRaw);
    if (!Number.isFinite(pricePhp) || pricePhp < 0) {
      throw new Error(`Invalid price on row ${i + 1}`);
    }

    const skuRaw = skuIndex >= 0 ? (values[skuIndex] ?? '').trim() : '';
    const notesRaw = notesIndex >= 0 ? (values[notesIndex] ?? '').trim() : '';

    rows.push({
      title,
      pricePhp,
      sku: skuRaw || null,
      notes: notesRaw || null,
    });
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function findColumnIndex(headers: string[], names: string[]): number {
  for (const name of names) {
    const index = headers.indexOf(name);
    if (index >= 0) {
      return index;
    }
  }
  return -1;
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
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}
