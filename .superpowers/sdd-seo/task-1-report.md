# Task 1 Report: SEO data + SeoService

Status: DONE

## Files (frontend/src/app/website/seo/)
- `seo-url.util.ts` — `normalizeSiteOrigin`, `toAbsoluteUrl`, `DEFAULT_SITE_ORIGIN` (https://www.pcmazing.com).
- `website-seo.data.ts` — `PageSeoMeta`, `STATIC_PAGE_SEO` (7 pages, unique real descriptions), `resolvePageSeo`, `listIndexableSitemapPaths`, `STATIC_SITEMAP_PATHS`, `DEFAULT_OG_IMAGE_PATH`.
- `seo.service.ts` — `SeoService.apply(meta, publicSiteUrl = APP_CONFIG.publicSiteUrl)`; title, description, robots, OG, Twitter, canonical.
- `json-ld.util.ts` — `buildLocalBusinessJsonLd(origin)` from `footerInfo` (PostalAddress, Mon–Sat 07:30–19:00, sameAs social, absolute logo).

## Verification
`npx tsc --noEmit -p tsconfig.app.json` (include `src/**/*.ts`) passes with no errors.

## Deviations / concerns
- Service descriptions: brief used `service.description.slice(0,160)`, but those are ~80 chars. Used word-boundary truncation of `description + overview` to 160 chars for better snippets.
- Unknown public paths resolve to `indexable: false` ("Page Not Found | PCmazing").
- `/q` (bare) not in noindex list per brief's resolver code; falls to unknown → noindex anyway.
- `json-ld.util.ts` imports `DEFAULT_OG_IMAGE_PATH` from website-seo.data (which imports pages.data); no circularity.
- Street address derived by splitting footer address before ", Cabanatuan City".

## Review fix (meta upsert)

**Problem:** `Meta.updateTag` only updates existing tags; `index.html` had no description/robots/OG/Twitter seeds, so `SeoService.apply` silently no-op’d for those.

**Change:** Added private `upsertMetaTag` in `seo.service.ts` — `getTag` + `updateTag` when present, else `addTag` — for `name=` and `property=` selectors. All description, robots, `og:*`, and `twitter:*` tags use it. `resolvePageSeo` now treats bare `/q` as noindex (same as `/q/…`).

**Verification:** `cd frontend; npx tsc --noEmit -p tsconfig.app.json` — exit 0, no errors.

**Concerns:** None new; canonical link upsert was already correct via DOM. Optional future: seed defaults in `index.html` for SSR/crawler-first paint — runtime upsert is sufficient for SPA navigation.
