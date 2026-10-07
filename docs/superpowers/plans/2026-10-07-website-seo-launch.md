# Website SEO Launch Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add launch-ready SEO for the public website: per-page titles/descriptions, canonicals, Open Graph/Twitter, robots.txt, sitemap.xml, and LocalBusiness/Organization JSON-LD — without indexing private app routes.

**Architecture:** Central `SeoService` + `website-seo.data.ts` applied on router `NavigationEnd` (app root or website layout). Static files in `frontend/public/`. JSON-LD injected on `WebsiteLayoutComponent` only. Absolute URLs from `APP_CONFIG.publicSiteUrl` (prod: `https://www.pcmazing.com`).

**Tech Stack:** Angular `Title` / `Meta` / `DOCUMENT`; static assets via `public/`; existing `footerInfo` + `serviceDetails`.

**Spec:** `docs/superpowers/specs/2026-10-07-website-seo-launch-design.md`

## Global Constraints

- Canonical host: `https://www.pcmazing.com` (production `PUBLIC_SITE_URL`).
- CSR only — no Angular SSR/prerender in this plan.
- Indexable: `/`, `/web-services`, `/our-work`, `/about`, `/contact`, `/schedule-demo`, `/leave-a-review`, `/services/*` known slugs.
- Noindex + robots Disallow: `/admin`, `/user`, `/setup`, `/q/`, `/time-clock`.
- Default OG image: absolute `{publicSiteUrl}/images/logopcm.png`.
- LocalBusiness NAP from `footerInfo` in `site.data.ts`.
- PowerShell: use `;` not `&&`.
- Repo has no frontend `*.spec.ts` harness — verify with `ng build` + acceptance checklist.

---

## File map

| File | Responsibility |
|------|----------------|
| `frontend/src/app/website/seo/seo-url.util.ts` | Normalize site origin + absolute URL + path without query |
| `frontend/src/app/website/seo/website-seo.data.ts` | Page meta map + resolve meta for a router URL |
| `frontend/src/app/website/seo/seo.service.ts` | Apply Title/Meta/canonical/OG/Twitter/robots |
| `frontend/src/app/website/seo/json-ld.util.ts` | Build Organization/LocalBusiness JSON-LD object |
| `frontend/src/app/app.ts` or `website-layout` | Subscribe NavigationEnd → SeoService; layout injects JSON-LD |
| `frontend/src/app/website/pages/service-detail/...` | Apply service-specific SEO when slug resolves |
| `frontend/public/robots.txt` | Crawler rules + Sitemap line |
| `frontend/public/sitemap.xml` | Absolute indexable URLs |
| `frontend/src/index.html` | Default description (+ optional default og) |
| `frontend/.env.example` | Confirm prod PUBLIC_SITE_URL note |
| Spec status → Implemented | |

---

### Task 1: SEO data + SeoService

**Files:**
- Create: `frontend/src/app/website/seo/seo-url.util.ts`
- Create: `frontend/src/app/website/seo/website-seo.data.ts`
- Create: `frontend/src/app/website/seo/seo.service.ts`
- Create: `frontend/src/app/website/seo/json-ld.util.ts`

**Interfaces:**
- Produces:
  - `normalizeSiteOrigin(raw: string): string`
  - `toAbsoluteUrl(origin: string, path: string): string`
  - `export type PageSeoMeta = { title: string; description: string; path: string; indexable: boolean; ogImagePath?: string }`
  - `resolvePageSeo(pathname: string): PageSeoMeta` — matches static paths; `/services/:slug` returns indexable template with slug path (title/description filled by caller or from serviceDetails inside resolver)
  - `SeoService.apply(meta: PageSeoMeta): void`
  - `buildLocalBusinessJsonLd(origin: string): Record<string, unknown>`

- [ ] **Step 1: Add URL helpers**

```typescript
// seo-url.util.ts
export function normalizeSiteOrigin(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  return trimmed || 'https://www.pcmazing.com';
}

/** path must start with / ; strips query/hash */
export function toAbsoluteUrl(origin: string, path: string): string {
  const base = normalizeSiteOrigin(origin);
  const clean = (path.split('?')[0].split('#')[0] || '/').startsWith('/')
    ? path.split('?')[0].split('#')[0]
    : `/${path.split('?')[0].split('#')[0]}`;
  if (clean === '/') return base;
  return `${base}${clean}`;
}
```

- [ ] **Step 2: Add `website-seo.data.ts`**

Define `PageSeoMeta` and a map for:

| path | title (keep close to current route titles) | description (unique, ~150–160 chars) |
|------|--------------------------------------------|--------------------------------------|
| `/` | `PCmazing \| Web Development & Tech Solutions` | Cabanatuan web + tech store positioning |
| `/web-services` | `Web Development Services \| PCmazing` | … |
| `/our-work` | `Our Work \| PCmazing` | … |
| `/about` | `About Us \| PCmazing` | … |
| `/contact` | `Contact Us \| PCmazing` | … |
| `/schedule-demo` | `Schedule A Demo \| PCmazing` | … |
| `/leave-a-review` | `Leave a Review \| PCmazing` | … |

Also:

```typescript
import { getServiceBySlug, serviceDetails } from '../data/pages.data';

const NOINDEX_PREFIXES = ['/admin', '/user', '/setup', '/q/', '/time-clock', '/q'];

export function resolvePageSeo(pathname: string): PageSeoMeta {
  const path = (pathname.split('?')[0].split('#')[0] || '/');
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  if (
    normalized === '/setup' ||
    normalized === '/time-clock' ||
    normalized.startsWith('/admin') ||
    normalized.startsWith('/user') ||
    normalized.startsWith('/q/')
  ) {
    return {
      path: normalized,
      title: 'PCmazing',
      description: 'PCmazing internal page.',
      indexable: false,
    };
  }

  const serviceMatch = normalized.match(/^\/services\/([^/]+)$/);
  if (serviceMatch) {
    const service = getServiceBySlug(serviceMatch[1]);
    if (service) {
      return {
        path: normalized,
        title: `${service.title} | PCmazing`,
        description: service.description.slice(0, 160),
        indexable: true,
      };
    }
    return {
      path: normalized,
      title: 'Service | PCmazing',
      description: 'PCmazing technology services in Cabanatuan City.',
      indexable: false,
    };
  }

  // lookup STATIC_PAGE_SEO[normalized] or home '/'
  // fallback: indexable false or generic indexable home-like for unknown public paths
}
```

Write concrete unique descriptions for each static page (no placeholders). Export `listIndexableSitemapPaths(): string[]` returning `/` + static paths + `serviceDetails.map(s => /services/${s.slug})` for Task 3 sitemap generation reference (or hardcode sitemap to match).

- [ ] **Step 3: Implement `SeoService`**

```typescript
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  apply(meta: PageSeoMeta, publicSiteUrl = APP_CONFIG.publicSiteUrl): void {
    const origin = normalizeSiteOrigin(publicSiteUrl);
    const url = toAbsoluteUrl(origin, meta.path);
    const image = toAbsoluteUrl(origin, meta.ogImagePath ?? '/images/logopcm.png');
    const robots = meta.indexable ? 'index, follow' : 'noindex, nofollow';

    this.title.setTitle(meta.title);
    this.meta.updateTag({ name: 'description', content: meta.description });
    this.meta.updateTag({ name: 'robots', content: robots });

    this.meta.updateTag({ property: 'og:title', content: meta.title });
    this.meta.updateTag({ property: 'og:description', content: meta.description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:image', content: image });
    this.meta.updateTag({ property: 'og:site_name', content: 'PCmazing' });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: meta.title });
    this.meta.updateTag({ name: 'twitter:description', content: meta.description });
    this.meta.updateTag({ name: 'twitter:image', content: image });

    this.setCanonical(url);
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
```

- [ ] **Step 4: Implement `buildLocalBusinessJsonLd`**

Use `footerInfo` from `site.data.ts`: name `PCmazing`, url origin, telephone `footerInfo.phoneStatus`, address as PostalAddress (street from footer string; addressLocality `Cabanatuan City`; addressCountry `PH`), openingHours Monday–Saturday 07:30–19:00, sameAs social urls, logo absolute `/images/logopcm.png`.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/app/website/seo
git commit -m "Add website SeoService, page meta map, and JSON-LD builder."
```

---

### Task 2: Wire navigation + JSON-LD + service detail

**Files:**
- Modify: `frontend/src/app/app.ts` (or create `frontend/src/app/website/seo/seo-router.initializer` called from `app.config.ts` / root component — prefer root `App` component if it already exists)
- Modify: `frontend/src/app/website/layout/website-layout.component.ts` (+ html if needed for script tag)
- Modify: `frontend/src/app/website/pages/service-detail/service-detail-page.component.ts` (ensure SEO applied when slug loads; router hook may already cover if `resolvePageSeo` uses slug)

**Interfaces:**
- Consumes: `SeoService.apply`, `resolvePageSeo`, `buildLocalBusinessJsonLd`
- On every `NavigationEnd`: `seo.apply(resolvePageSeo(router.url))` — use path only (`router.parseUrl` / `event.urlAfterRedirects`)

- [ ] **Step 1: Find root component**

Read `frontend/src/app/app.ts` (or `app.component.ts`). Subscribe in `ngOnInit`:

```typescript
this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
  const url = (e as NavigationEnd).urlAfterRedirects || (e as NavigationEnd).url;
  const path = url.split('?')[0].split('#')[0] || '/';
  this.seo.apply(resolvePageSeo(path));
});
// also apply once for initial route
this.seo.apply(resolvePageSeo(this.router.url.split('?')[0] || '/'));
```

- [ ] **Step 2: Inject JSON-LD in website layout only**

In `WebsiteLayoutComponent` `ngOnInit`:

```typescript
const origin = normalizeSiteOrigin(APP_CONFIG.publicSiteUrl);
const data = buildLocalBusinessJsonLd(origin);
// remove previous script#pcmazing-jsonld if any
const script = document.createElement('script');
script.type = 'application/ld+json';
script.id = 'pcmazing-jsonld';
script.text = JSON.stringify(data);
document.head.appendChild(script);
```

In `ngOnDestroy`, remove `#pcmazing-jsonld` so admin shell does not keep it if user navigates (admin is separate outlet — layout destroy should clean up).

- [ ] **Step 3: Service detail**

If unknown slug shows not-found UI, ensure `resolvePageSeo` marks `indexable: false` (Task 1). No extra work if router subscription runs after navigation.

- [ ] **Step 4: Build**

```powershell
cd frontend; npx ng build --configuration=development
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/app/app.ts frontend/src/app/website/layout frontend/src/app/website/pages/service-detail frontend/src/app/website/seo
git commit -m "Apply SEO meta on navigation and inject LocalBusiness JSON-LD."
```

---

### Task 3: Static robots/sitemap + index.html + mark spec

**Files:**
- Create: `frontend/public/robots.txt`
- Create: `frontend/public/sitemap.xml`
- Modify: `frontend/src/index.html`
- Modify: `frontend/.env.example` (clarify prod SEO URL if needed)
- Modify: `docs/superpowers/specs/2026-10-07-website-seo-launch-design.md` → Status **Implemented**

- [ ] **Step 1: `robots.txt`**

```
User-agent: *
Allow: /

Disallow: /admin
Disallow: /user
Disallow: /setup
Disallow: /q/
Disallow: /time-clock

Sitemap: https://www.pcmazing.com/sitemap.xml
```

- [ ] **Step 2: `sitemap.xml`**

Include absolute URLs:

- `https://www.pcmazing.com/`
- `https://www.pcmazing.com/web-services`
- `https://www.pcmazing.com/our-work`
- `https://www.pcmazing.com/about`
- `https://www.pcmazing.com/contact`
- `https://www.pcmazing.com/schedule-demo`
- `https://www.pcmazing.com/leave-a-review`
- `https://www.pcmazing.com/services/pc-laptop-repair`
- `https://www.pcmazing.com/services/custom-pc-builds`
- `https://www.pcmazing.com/services/printer-sales-repair`
- `https://www.pcmazing.com/services/web-development`
- `https://www.pcmazing.com/services/tech-support`

Use valid XML urlset; home `priority` 1.0; others 0.8/0.7 as appropriate.

- [ ] **Step 3: Update `index.html`**

After title, add:

```html
<meta name="description" content="PCmazing — web development, PC repair, custom builds, and tech support in Cabanatuan City, Philippines.">
<meta name="robots" content="index, follow">
```

Keep existing icons/PWA meta.

- [ ] **Step 4: Confirm `.env.example` documents**

`PUBLIC_SITE_URL=https://www.pcmazing.com` for production (already commented — strengthen comment: “required for SEO canonicals/OG”).

- [ ] **Step 5: Mark spec Implemented**

- [ ] **Step 6: Build + manual acceptance**

```powershell
cd frontend; npx ng build --configuration=development
```

Manual (local): open `/`, `/about`, `/services/web-development` — DevTools `<head>` shows title/description/canonical/og; navigate to a fake admin path if reachable shows noindex when SEO runs. Confirm `/robots.txt` and `/sitemap.xml` via `ng serve` (files from `public/`).

- [ ] **Step 7: Commit**

```powershell
git add frontend/public/robots.txt frontend/public/sitemap.xml frontend/src/index.html frontend/.env.example docs/superpowers/specs/2026-10-07-website-seo-launch-design.md
git commit -m "Add robots.txt, sitemap, and index SEO defaults for launch."
```
