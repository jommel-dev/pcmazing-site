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
  - `resolvePageSeo(pathname: string): PageSeoMeta` â€” matches static paths; `/services/:slug` returns indexable template with slug path (title/description filled by caller or from serviceDetails inside resolver)
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

| path | title (keep close to current route titles) | description (unique, ~150â€“160 chars) |
|------|--------------------------------------------|--------------------------------------|
| `/` | `PCmazing \| Web Development & Tech Solutions` | Cabanatuan web + tech store positioning |
| `/web-services` | `Web Development Services \| PCmazing` | â€¦ |
| `/our-work` | `Our Work \| PCmazing` | â€¦ |
| `/about` | `About Us \| PCmazing` | â€¦ |
| `/contact` | `Contact Us \| PCmazing` | â€¦ |
| `/schedule-demo` | `Schedule A Demo \| PCmazing` | â€¦ |
| `/leave-a-review` | `Leave a Review \| PCmazing` | â€¦ |

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

Use `footerInfo` from `site.data.ts`: name `PCmazing`, url origin, telephone `footerInfo.phoneStatus`, address as PostalAddress (street from footer string; addressLocality `Cabanatuan City`; addressCountry `PH`), openingHours Mondayâ€“Saturday 07:30â€“19:00, sameAs social urls, logo absolute `/images/logopcm.png`.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/app/website/seo
git commit -m "Add website SeoService, page meta map, and JSON-LD builder."
```

---


