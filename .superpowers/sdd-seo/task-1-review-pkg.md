BASE: 7fcd564
HEAD: 22fae43e7d4b7148dd1f81999b4398408e8a0e25


## Commits

22fae43 Add website SeoService, page meta map, and JSON-LD builder.

## Stat

 frontend/src/app/website/seo/json-ld.util.ts     |  34 +++++++
 frontend/src/app/website/seo/seo-url.util.ts     |  15 +++
 frontend/src/app/website/seo/seo.service.ts      |  48 +++++++++
 frontend/src/app/website/seo/website-seo.data.ts | 119 +++++++++++++++++++++++
 4 files changed, 216 insertions(+)

## Diff

diff --git a/frontend/src/app/website/seo/json-ld.util.ts b/frontend/src/app/website/seo/json-ld.util.ts
new file mode 100644
index 0000000..314000e
--- /dev/null
+++ b/frontend/src/app/website/seo/json-ld.util.ts
@@ -0,0 +1,34 @@
+import { footerInfo } from '../data/site.data';
+import { normalizeSiteOrigin, toAbsoluteUrl } from './seo-url.util';
+import { DEFAULT_OG_IMAGE_PATH } from './website-seo.data';
+
+export function buildLocalBusinessJsonLd(origin: string): Record<string, unknown> {
+  const base = normalizeSiteOrigin(origin);
+  // footerInfo.address: "Corner Nori St. Mabini Extension, Cabanatuan City, Philippines - In Front of Science High School"
+  const streetAddress = footerInfo.address.split(', Cabanatuan City')[0];
+
+  return {
+    '@context': 'https://schema.org',
+    '@type': 'LocalBusiness',
+    name: 'PCmazing',
+    url: base,
+    logo: toAbsoluteUrl(base, DEFAULT_OG_IMAGE_PATH),
+    image: toAbsoluteUrl(base, DEFAULT_OG_IMAGE_PATH),
+    telephone: footerInfo.phoneStatus,
+    address: {
+      '@type': 'PostalAddress',
+      streetAddress,
+      addressLocality: 'Cabanatuan City',
+      addressCountry: 'PH',
+    },
+    openingHoursSpecification: [
+      {
+        '@type': 'OpeningHoursSpecification',
+        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
+        opens: '07:30',
+        closes: '19:00',
+      },
+    ],
+    sameAs: footerInfo.social.map((s) => s.url),
+  };
+}
diff --git a/frontend/src/app/website/seo/seo-url.util.ts b/frontend/src/app/website/seo/seo-url.util.ts
new file mode 100644
index 0000000..b3376a5
--- /dev/null
+++ b/frontend/src/app/website/seo/seo-url.util.ts
@@ -0,0 +1,15 @@
+export const DEFAULT_SITE_ORIGIN = 'https://www.pcmazing.com';
+
+export function normalizeSiteOrigin(raw: string): string {
+  const trimmed = (raw || '').trim().replace(/\/+$/, '');
+  return trimmed || DEFAULT_SITE_ORIGIN;
+}
+
+/** path must start with / ; strips query/hash */
+export function toAbsoluteUrl(origin: string, path: string): string {
+  const base = normalizeSiteOrigin(origin);
+  const stripped = path.split('?')[0].split('#')[0];
+  const clean = (stripped || '/').startsWith('/') ? stripped || '/' : `/${stripped}`;
+  if (clean === '/') return base;
+  return `${base}${clean}`;
+}
diff --git a/frontend/src/app/website/seo/seo.service.ts b/frontend/src/app/website/seo/seo.service.ts
new file mode 100644
index 0000000..8162c72
--- /dev/null
+++ b/frontend/src/app/website/seo/seo.service.ts
@@ -0,0 +1,48 @@
+import { DOCUMENT } from '@angular/common';
+import { Injectable, inject } from '@angular/core';
+import { Meta, Title } from '@angular/platform-browser';
+import { APP_CONFIG } from '../../core/config/app-config';
+import { normalizeSiteOrigin, toAbsoluteUrl } from './seo-url.util';
+import { DEFAULT_OG_IMAGE_PATH, PageSeoMeta } from './website-seo.data';
+
+@Injectable({ providedIn: 'root' })
+export class SeoService {
+  private readonly title = inject(Title);
+  private readonly meta = inject(Meta);
+  private readonly document = inject(DOCUMENT);
+
+  apply(meta: PageSeoMeta, publicSiteUrl: string = APP_CONFIG.publicSiteUrl): void {
+    const origin = normalizeSiteOrigin(publicSiteUrl);
+    const url = toAbsoluteUrl(origin, meta.path);
+    const image = toAbsoluteUrl(origin, meta.ogImagePath ?? DEFAULT_OG_IMAGE_PATH);
+    const robots = meta.indexable ? 'index, follow' : 'noindex, nofollow';
+
+    this.title.setTitle(meta.title);
+    this.meta.updateTag({ name: 'description', content: meta.description });
+    this.meta.updateTag({ name: 'robots', content: robots });
+
+    this.meta.updateTag({ property: 'og:title', content: meta.title });
+    this.meta.updateTag({ property: 'og:description', content: meta.description });
+    this.meta.updateTag({ property: 'og:url', content: url });
+    this.meta.updateTag({ property: 'og:type', content: 'website' });
+    this.meta.updateTag({ property: 'og:image', content: image });
+    this.meta.updateTag({ property: 'og:site_name', content: 'PCmazing' });
+
+    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
+    this.meta.updateTag({ name: 'twitter:title', content: meta.title });
+    this.meta.updateTag({ name: 'twitter:description', content: meta.description });
+    this.meta.updateTag({ name: 'twitter:image', content: image });
+
+    this.setCanonical(url);
+  }
+
+  private setCanonical(url: string): void {
+    let link = this.document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
+    if (!link) {
+      link = this.document.createElement('link');
+      link.setAttribute('rel', 'canonical');
+      this.document.head.appendChild(link);
+    }
+    link.setAttribute('href', url);
+  }
+}
diff --git a/frontend/src/app/website/seo/website-seo.data.ts b/frontend/src/app/website/seo/website-seo.data.ts
new file mode 100644
index 0000000..20dee61
--- /dev/null
+++ b/frontend/src/app/website/seo/website-seo.data.ts
@@ -0,0 +1,119 @@
+import { getServiceBySlug, serviceDetails } from '../data/pages.data';
+
+export type PageSeoMeta = {
+  title: string;
+  description: string;
+  path: string;
+  indexable: boolean;
+  ogImagePath?: string;
+};
+
+export const DEFAULT_OG_IMAGE_PATH = '/images/logopcm.png';
+
+type StaticPageSeo = Omit<PageSeoMeta, 'path' | 'indexable'>;
+
+export const STATIC_PAGE_SEO: Record<string, StaticPageSeo> = {
+  '/': {
+    title: 'PCmazing | Web Development & Tech Solutions',
+    description:
+      'PCmazing in Cabanatuan City builds custom web systems and sells, repairs, and supports PCs, laptops, and accessories for homes, schools, and local businesses.',
+  },
+  '/web-services': {
+    title: 'Web Development Services | PCmazing',
+    description:
+      'Custom web applications, business and online store websites, and ongoing IT support from PCmazing. Practical systems built for Philippine small businesses.',
+  },
+  '/our-work': {
+    title: 'Our Work | PCmazing',
+    description:
+      'See systems PCmazing has built: POS, HRIS, accounting, inventory, HVAC warehouse, catering, and auto repair management software for growing local companies.',
+  },
+  '/about': {
+    title: 'About Us | PCmazing',
+    description:
+      'Learn about PCmazing, a Cabanatuan City tech shop and web development team helping local clients with reliable hardware, repairs, and custom software.',
+  },
+  '/contact': {
+    title: 'Contact Us | PCmazing',
+    description:
+      'Visit PCmazing at Mabini Extension, Cabanatuan City, call 09394133225, or send a message. Open Monday to Saturday, 7:30 AM to 7:00 PM. We reply promptly.',
+  },
+  '/schedule-demo': {
+    title: 'Schedule A Demo | PCmazing',
+    description:
+      'Book a free demo of PCmazing business systems. Tell us your workflow and we will show how POS, inventory, or HR software can fit your operations.',
+  },
+  '/leave-a-review': {
+    title: 'Leave a Review | PCmazing',
+    description:
+      'Shared a project or repair with PCmazing? Leave a review and tell other Cabanatuan City customers about your experience with our team and services.',
+  },
+};
+
+/** Static public paths (excluding `/`) in sitemap order. */
+export const STATIC_SITEMAP_PATHS: string[] = Object.keys(STATIC_PAGE_SEO).filter((p) => p !== '/');
+
+/** `/`, static pages, then every `/services/:slug`. For sitemap generation reference. */
+export function listIndexableSitemapPaths(): string[] {
+  return ['/', ...STATIC_SITEMAP_PATHS, ...serviceDetails.map((s) => `/services/${s.slug}`)];
+}
+
+function truncateDescription(text: string, max = 160): string {
+  const clean = text.replace(/\s+/g, ' ').trim();
+  if (clean.length <= max) return clean;
+  const cut = clean.slice(0, max - 1);
+  const lastSpace = cut.lastIndexOf(' ');
+  return `${(lastSpace > 100 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:-]+$/, '')}ΓÇª`;
+}
+
+export function resolvePageSeo(pathname: string): PageSeoMeta {
+  const path = pathname.split('?')[0].split('#')[0] || '/';
+  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
+
+  if (
+    normalized === '/setup' ||
+    normalized === '/time-clock' ||
+    normalized.startsWith('/admin') ||
+    normalized.startsWith('/user') ||
+    normalized.startsWith('/q/')
+  ) {
+    return {
+      path: normalized,
+      title: 'PCmazing',
+      description: 'PCmazing internal page.',
+      indexable: false,
+    };
+  }
+
+  const serviceMatch = normalized.match(/^\/services\/([^/]+)$/);
+  if (serviceMatch) {
+    const service = getServiceBySlug(serviceMatch[1]);
+    if (service) {
+      return {
+        path: normalized,
+        title: `${service.title} | PCmazing`,
+        description: truncateDescription(`${service.description} ${service.overview}`),
+        indexable: true,
+      };
+    }
+    return {
+      path: normalized,
+      title: 'Service | PCmazing',
+      description: 'PCmazing technology services in Cabanatuan City.',
+      indexable: false,
+    };
+  }
+
+  const known = STATIC_PAGE_SEO[normalized];
+  if (known) {
+    return { path: normalized, indexable: true, ...known };
+  }
+
+  // Unknown public paths: do not index.
+  return {
+    path: normalized,
+    title: 'Page Not Found | PCmazing',
+    description: 'This page could not be found. Visit PCmazing for web development and tech solutions in Cabanatuan City.',
+    indexable: false,
+  };
+}
