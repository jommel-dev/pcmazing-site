import { fetchText, parsePhpPrice, absolutizeUrl } from '../parts-price-http.util';
import type { PartsPriceHit, PartsPriceSearchAdapter } from '../parts-price-search.types';

/**
 * UniPC is a Next.js storefront. Best-effort HTML parse of the public catalog
 * search / listing when available; returns [] if structure changes.
 */
export function createUniPcAdapter(timeoutMs: number): PartsPriceSearchAdapter {
  const origin = 'https://unipc.ph';
  return {
    id: 'unipc',
    label: 'UniPC',
    async search(query: string, limit: number): Promise<PartsPriceHit[]> {
      const url = `${origin}/?s=${encodeURIComponent(query)}&post_type=product`;
      const html = await fetchText(url, { timeoutMs });
      return parseLooseProductCards(html, {
        sourceId: 'unipc',
        sourceLabel: 'UniPC',
        origin,
        limit,
      });
    },
  };
}

/**
 * PCHub sits behind Cloudflare bot protection ("Just a moment…" / HTTP 403).
 * Attempts search HTML when enabled, but never throws — empty results only —
 * so quotation create search does not surface a source error.
 */
export function createPcHubAdapter(timeoutMs: number): PartsPriceSearchAdapter {
  const origin = 'https://www.pchubonline.com';
  return {
    id: 'pchub',
    label: 'PCHub',
    async search(query: string, limit: number): Promise<PartsPriceHit[]> {
      try {
        const url = `${origin}/search?controller=search&s=${encodeURIComponent(query)}`;
        const html = await fetchText(url, { timeoutMs });
        if (looksLikeBotChallenge(html)) {
          return [];
        }
        return parseLooseProductCards(html, {
          sourceId: 'pchub',
          sourceLabel: 'PCHub',
          origin,
          limit,
        });
      } catch {
        return [];
      }
    },
  };
}

function looksLikeBotChallenge(html: string): boolean {
  const sample = html.slice(0, 4000).toLowerCase();
  return (
    sample.includes('just a moment') ||
    sample.includes('cf-browser-verification') ||
    sample.includes('cdn-cgi/challenge') ||
    sample.includes('attention required')
  );
}

function parseLooseProductCards(
  html: string,
  meta: { sourceId: string; sourceLabel: string; origin: string; limit: number },
): PartsPriceHit[] {
  const hits: PartsPriceHit[] = [];
  const seen = new Set<string>();

  // Match product anchors near a peso / numeric price in the surrounding chunk.
  const anchorRegex =
    /<a[^>]+href=["']([^"']*(?:product|products)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html)) != null && hits.length < meta.limit) {
    const href = match[1];
    const inner = match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!inner || inner.length < 4 || inner.length > 180) {
      continue;
    }

    const windowStart = Math.max(0, match.index - 80);
    const windowEnd = Math.min(html.length, match.index + match[0].length + 220);
    const nearby = html.slice(windowStart, windowEnd);
    const priceMatch =
      nearby.match(/₱\s*([\d,]+(?:\.\d+)?)/) ||
      nearby.match(/Php\s*([\d,]+(?:\.\d+)?)/i) ||
      nearby.match(/"price"\s*:\s*"?([\d.]+)"?/i);
    const pricePhp = priceMatch ? parsePhpPrice(priceMatch[1]) : null;
    if (pricePhp == null || pricePhp <= 0) {
      continue;
    }

    const url = absolutizeUrl(meta.origin, href);
    const key = `${url}::${inner.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    hits.push({
      sourceId: meta.sourceId,
      sourceLabel: meta.sourceLabel,
      title: inner,
      pricePhp,
      currency: 'PHP',
      url,
      imageUrl: null,
      inStock: null,
    });
  }

  return hits;
}
