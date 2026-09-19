import {
  absolutizeUrl,
  fetchJson,
  parsePhpPrice,
} from '../parts-price-http.util';
import type { PartsPriceHit, PartsPriceSearchAdapter } from '../parts-price-search.types';

type ShopifySuggestResponse = {
  resources?: {
    results?: {
      products?: Array<{
        title?: string;
        price?: string | number;
        price_min?: string | number;
        url?: string;
        image?: string;
        available?: boolean;
      }>;
    };
  };
};

/**
 * Many PH PC retailers run Shopify. Their predictive search JSON is the most
 * reliable free source for title + PHP price.
 */
export function createShopifySuggestAdapter(input: {
  id: string;
  label: string;
  origin: string;
  timeoutMs: number;
}): PartsPriceSearchAdapter {
  const { id, label, origin, timeoutMs } = input;

  return {
    id,
    label,
    async search(query: string, limit: number): Promise<PartsPriceHit[]> {
      const url =
        `${origin.replace(/\/$/, '')}/search/suggest.json` +
        `?q=${encodeURIComponent(query)}` +
        `&resources[type]=product&resources[limit]=${Math.min(Math.max(limit, 1), 20)}`;

      const payload = await fetchJson<ShopifySuggestResponse>(url, timeoutMs);
      const products = payload.resources?.results?.products ?? [];
      const hits: PartsPriceHit[] = [];

      for (const product of products) {
        const title = String(product.title ?? '').trim();
        const pricePhp = parsePhpPrice(product.price_min ?? product.price);
        const path = String(product.url ?? '').trim();
        if (!title || pricePhp == null || !path) {
          continue;
        }
        hits.push({
          sourceId: id,
          sourceLabel: label,
          title,
          pricePhp,
          currency: 'PHP',
          url: absolutizeUrl(origin, path.split('?')[0] || path),
          imageUrl: product.image || null,
          inStock: typeof product.available === 'boolean' ? product.available : null,
        });
        if (hits.length >= limit) {
          break;
        }
      }

      return hits;
    },
  };
}
