BASE: e07f67c
HEAD: 611bde44084e450bb6aad790072739871caef2b0

611bde4 Merge local price list hits into parts price search.
 .../parts-price-search.service.ts                  | 93 ++++++++++++----------
 1 file changed, 53 insertions(+), 40 deletions(-)

## Diff

diff --git a/backend/src/admin/parts-price-search/parts-price-search.service.ts b/backend/src/admin/parts-price-search/parts-price-search.service.ts
index 2fba017..35d6eff 100644
--- a/backend/src/admin/parts-price-search/parts-price-search.service.ts
+++ b/backend/src/admin/parts-price-search/parts-price-search.service.ts
@@ -1,12 +1,13 @@
 import { Injectable, Logger } from '@nestjs/common';
 import { ConfigService } from '@nestjs/config';
+import { LocalPriceListsService } from '../local-price-lists/local-price-lists.service';
 import { createShopifySuggestAdapter } from './adapters/shopify-suggest.adapter';
 import { createPcHubAdapter, createUniPcAdapter } from './adapters/html-catalog.adapter';
 import type {
   PartsPriceHit,
   PartsPriceSearchAdapter,
   PartsPriceSearchResult,
   PartsPriceSourceError,
 } from './parts-price-search.types';
 
 type CacheEntry = {
@@ -16,21 +17,24 @@ type CacheEntry = {
 
 const DEFAULT_SOURCES = ['pcx', 'dynaquest', 'octagon', 'unipc', 'pchub'];
 const CACHE_TTL_MS = 8 * 60 * 1000;
 
 @Injectable()
 export class PartsPriceSearchService {
   private readonly logger = new Logger(PartsPriceSearchService.name);
   private readonly adapters: Map<string, PartsPriceSearchAdapter>;
   private readonly cache = new Map<string, CacheEntry>();
 
-  constructor(private readonly config: ConfigService) {
+  constructor(
+    private readonly config: ConfigService,
+    private readonly localPriceLists: LocalPriceListsService,
+  ) {
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
@@ -64,68 +68,77 @@ export class PartsPriceSearchService {
       label: adapter.label,
     }));
   }
 
   async search(queryRaw: string, sourcesRaw?: string, limitRaw?: string): Promise<PartsPriceSearchResult> {
     const query = String(queryRaw ?? '').trim();
     if (query.length < 2) {
       return { query, items: [], sourceErrors: [] };
     }
 
-    if (!this.isEnabled()) {
-      return {
-        query,
-        items: [],
-        sourceErrors: [
-          {
-            sourceId: 'system',
-            sourceLabel: 'Parts search',
-            message: 'Web parts search is disabled (PARTS_SEARCH_ENABLED=false).',
-          },
-        ],
-      };
-    }
-
     const limit = this.resolveLimit(limitRaw);
-    const sourceIds = this.resolveSources(sourcesRaw);
-    const cacheKey = `${query.toLowerCase()}::${sourceIds.join(',')}::${limit}`;
+    const sourceErrors: PartsPriceSourceError[] = [];
+    const webEnabled = this.isEnabled();
+    const sourceIds = webEnabled ? this.resolveSources(sourcesRaw) : [];
+    const cacheKey = `${webEnabled ? 'web' : 'local'}::${query.toLowerCase()}::${sourceIds.join(',')}::${limit}`;
     const cached = this.cache.get(cacheKey);
     if (cached && cached.expiresAt > Date.now()) {
       return cached.result;
     }
 
-    const sourceErrors: PartsPriceSourceError[] = [];
-    const settled = await Promise.all(
-      sourceIds.map(async (sourceId) => {
-        const adapter = this.adapters.get(sourceId);
-        if (!adapter) {
-          return [] as PartsPriceHit[];
-        }
-        try {
-          return await adapter.search(query, limit);
-        } catch (error) {
-          const message = error instanceof Error ? error.message : String(error);
-          this.logger.warn(`${adapter.label} search failed: ${message}`);
-          sourceErrors.push({
-            sourceId: adapter.id,
-            sourceLabel: adapter.label,
-            message,
-          });
-          return [] as PartsPriceHit[];
-        }
-      }),
-    );
+    const localPromise = this.localPriceLists.searchActiveItems(query, limit).catch((error) => {
+      const message = error instanceof Error ? error.message : String(error);
+      this.logger.warn(`Local price lists search failed: ${message}`);
+      sourceErrors.push({
+        sourceId: 'local',
+        sourceLabel: 'Local price lists',
+        message,
+      });
+      return [] as PartsPriceHit[];
+    });
+
+    let settled: PartsPriceHit[][] = [];
+    if (!webEnabled) {
+      sourceErrors.push({
+        sourceId: 'system',
+        sourceLabel: 'Parts search',
+        message: 'Web parts search is disabled (PARTS_SEARCH_ENABLED=false).',
+      });
+    } else {
+      settled = await Promise.all(
+        sourceIds.map(async (sourceId) => {
+          const adapter = this.adapters.get(sourceId);
+          if (!adapter) {
+            return [] as PartsPriceHit[];
+          }
+          try {
+            return await adapter.search(query, limit);
+          } catch (error) {
+            const message = error instanceof Error ? error.message : String(error);
+            this.logger.warn(`${adapter.label} search failed: ${message}`);
+            sourceErrors.push({
+              sourceId: adapter.id,
+              sourceLabel: adapter.label,
+              message,
+            });
+            return [] as PartsPriceHit[];
+          }
+        }),
+      );
+    }
 
-    const merged = settled.flat();
+    const localHits = await localPromise;
+    const merged = [...settled.flat(), ...localHits];
     const deduped = this.dedupe(merged);
     deduped.sort((a, b) => a.pricePhp - b.pricePhp || a.title.localeCompare(b.title));
-    const items = deduped.slice(0, Math.max(limit * sourceIds.length, limit));
+    const sliceCap = Math.max(limit * Math.max(sourceIds.length, 1), limit);
+    const items = deduped.slice(0, sliceCap);
 
     const result: PartsPriceSearchResult = { query, items, sourceErrors };
     this.cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
     return result;
   }
 
   private resolveTimeoutMs(): number {
     const raw = Number(this.config.get<string>('PARTS_SEARCH_TIMEOUT_MS') ?? 8000);
     return Number.isFinite(raw) && raw >= 2000 && raw <= 30000 ? raw : 8000;
   }
