export type PcConceptMappedItem = {
  title: string;
  sku: string;
  pricePhp: number;
  notes: string | null;
};

type PcConceptProduct = {
  id?: unknown;
  sku?: unknown;
  name?: unknown;
  brand?: unknown;
  cat?: unknown;
  specs?: unknown;
  price?: unknown;
  sale?: unknown;
  stock?: { cab?: unknown; pam?: unknown } | null;
  hidden?: unknown;
};

function extractBalancedJsonObject(text: string, startIndex: number): string {
  if (text[startIndex] !== '{') {
    throw new Error('PCC_DATA JSON object not found.');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  throw new Error('PCC_DATA JSON object is incomplete.');
}

export function extractPccDataJson(jsText: string): unknown {
  const match = /(?:window\.)?PCC_DATA\s*=/.exec(jsText);
  if (!match) {
    throw new Error('PCC_DATA assignment not found in catalog script.');
  }

  const afterEquals = jsText.slice(match.index + match[0].length);
  const objectStart = afterEquals.indexOf('{');
  if (objectStart < 0) {
    throw new Error('PCC_DATA JSON object not found.');
  }

  const absoluteStart = match.index + match[0].length + objectStart;
  const jsonText = extractBalancedJsonObject(jsText, absoluteStart);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error('PCC_DATA JSON could not be parsed.');
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function buildNotes(product: PcConceptProduct): string | null {
  const brand = asTrimmedString(product.brand);
  const cat = asTrimmedString(product.cat);
  const specs = asTrimmedString(product.specs);

  const cabRaw = product.stock?.cab;
  const pamRaw = product.stock?.pam;
  const cab =
    typeof cabRaw === 'number' && Number.isFinite(cabRaw) ? `Cab:${cabRaw}` : '';
  const pam =
    typeof pamRaw === 'number' && Number.isFinite(pamRaw) ? `Pam:${pamRaw}` : '';

  const parts = [brand, cat, specs, cab, pam].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function mapPcConceptProducts(data: unknown): PcConceptMappedItem[] {
  const products =
    data && typeof data === 'object' && Array.isArray((data as { products?: unknown }).products)
      ? ((data as { products: PcConceptProduct[] }).products)
      : [];

  const seenSkus = new Set<string>();
  const items: PcConceptMappedItem[] = [];

  for (const product of products) {
    if (!product || typeof product !== 'object') continue;
    if (product.hidden === true) continue;

    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) continue;

    const sku = asTrimmedString(product.sku) || asTrimmedString(product.id);
    if (!sku) continue;
    if (seenSkus.has(sku)) continue;
    seenSkus.add(sku);

    const title = asTrimmedString(product.name) || sku;
    items.push({
      title,
      sku,
      pricePhp: price,
      notes: buildNotes(product),
    });
  }

  return items;
}
