import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createShopifySuggestAdapter } from './adapters/shopify-suggest.adapter';
import { createPcHubAdapter, createUniPcAdapter } from './adapters/html-catalog.adapter';
import type {
  PartsPriceHit,
  PartsPriceSearchAdapter,
  PartsPriceSearchResult,
  PartsPriceSourceError,
} from './parts-price-search.types';

type CacheEntry = {
  expiresAt: number;
  result: PartsPriceSearchResult;
};

const DEFAULT_SOURCES = ['pcx', 'dynaquest', 'octagon', 'unipc', 'pchub'];
const CACHE_TTL_MS = 8 * 60 * 1000;

@Injectable()
export class PartsPriceSearchService {
  private readonly logger = new Logger(PartsPriceSearchService.name);
  private readonly adapters: Map<string, PartsPriceSearchAdapter>;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {
    const timeoutMs = this.resolveTimeoutMs();
    const list: PartsPriceSearchAdapter[] = [
      createShopifySuggestAdapter({
        id: 'pcx',
        label: 'PC Express',
        origin: 'https://pcx.com.ph',
        timeoutMs,
      }),
      createShopifySuggestAdapter({
        id: 'dynaquest',
        label: 'DynaQuest',
        origin: 'https://dynaquestpc.com',
        timeoutMs,
      }),
      createShopifySuggestAdapter({
        id: 'octagon',
        label: 'Octagon',
        origin: 'https://www.octagon.com.ph',
        timeoutMs,
      }),
      createUniPcAdapter(timeoutMs),
      createPcHubAdapter(timeoutMs),
    ];
    this.adapters = new Map(list.map((adapter) => [adapter.id, adapter]));
  }

  isEnabled(): boolean {
    const raw = this.config.get<string>('PARTS_SEARCH_ENABLED');
    if (raw == null || raw.trim() === '') {
      return true;
    }
    return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
  }

  listAvailableSources(): Array<{ id: string; label: string }> {
    return [...this.adapters.values()].map((adapter) => ({
      id: adapter.id,
      label: adapter.label,
    }));
  }

  async search(queryRaw: string, sourcesRaw?: string, limitRaw?: string): Promise<PartsPriceSearchResult> {
    const query = String(queryRaw ?? '').trim();
    if (query.length < 2) {
      return { query, items: [], sourceErrors: [] };
    }

    if (!this.isEnabled()) {
      return {
        query,
        items: [],
        sourceErrors: [
          {
            sourceId: 'system',
            sourceLabel: 'Parts search',
            message: 'Web parts search is disabled (PARTS_SEARCH_ENABLED=false).',
          },
        ],
      };
    }

    const limit = this.resolveLimit(limitRaw);
    const sourceIds = this.resolveSources(sourcesRaw);
    const cacheKey = `${query.toLowerCase()}::${sourceIds.join(',')}::${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    const sourceErrors: PartsPriceSourceError[] = [];
    const settled = await Promise.all(
      sourceIds.map(async (sourceId) => {
        const adapter = this.adapters.get(sourceId);
        if (!adapter) {
          return [] as PartsPriceHit[];
        }
        try {
          return await adapter.search(query, limit);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`${adapter.label} search failed: ${message}`);
          sourceErrors.push({
            sourceId: adapter.id,
            sourceLabel: adapter.label,
            message,
          });
          return [] as PartsPriceHit[];
        }
      }),
    );

    const merged = settled.flat();
    const deduped = this.dedupe(merged);
    deduped.sort((a, b) => a.pricePhp - b.pricePhp || a.title.localeCompare(b.title));
    const items = deduped.slice(0, Math.max(limit * sourceIds.length, limit));

    const result: PartsPriceSearchResult = { query, items, sourceErrors };
    this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  }

  private resolveTimeoutMs(): number {
    const raw = Number(this.config.get<string>('PARTS_SEARCH_TIMEOUT_MS') ?? 8000);
    return Number.isFinite(raw) && raw >= 2000 && raw <= 30000 ? raw : 8000;
  }

  private resolveLimit(limitRaw?: string): number {
    const raw = Number(limitRaw ?? 8);
    if (!Number.isFinite(raw)) {
      return 8;
    }
    return Math.min(Math.max(Math.floor(raw), 1), 20);
  }

  private resolveSources(sourcesRaw?: string): string[] {
    const configured =
      this.config.get<string>('PARTS_SEARCH_SOURCES')?.trim() || DEFAULT_SOURCES.join(',');
    const fromEnv = configured
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const fromQuery = (sourcesRaw ?? '')
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);

    const requested = fromQuery.length ? fromQuery : fromEnv;
    const available = requested.filter((id) => this.adapters.has(id));
    return available.length ? available : DEFAULT_SOURCES.filter((id) => this.adapters.has(id));
  }

  private dedupe(items: PartsPriceHit[]): PartsPriceHit[] {
    const seen = new Set<string>();
    const next: PartsPriceHit[] = [];
    for (const item of items) {
      const key = `${item.sourceId}::${item.url}::${item.title.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      next.push(item);
    }
    return next;
  }
}
