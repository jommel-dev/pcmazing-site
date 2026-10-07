# Website SEO Launch Baseline

**Date:** 2026-10-07  
**Status:** Implemented  
**Approach:** Central `SeoService` + page meta map; static `robots.txt` / `sitemap.xml`; Organization + LocalBusiness JSON-LD (CSR; no SSR)

## Goal

Prepare the public PCmazing website for official launch and search indexing: correct titles, meta descriptions, Open Graph/Twitter tags, canonical URLs, robots guidance, sitemap, and structured data — without mistakes that expose private app routes or duplicate hosts.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Canonical host | `https://www.pcmazing.com` |
| Depth | Launch baseline (no Angular SSR/prerender yet) |
| Architecture | Central SEO service + typed page-meta map |
| LocalBusiness NAP | Reuse existing `footerInfo` in `site.data.ts` |
| Default OG image | Existing logo (`/images/logopcm.png` or current site logo path), absolute URL |
| Private routes | `noindex` + `robots.txt` Disallow |

## Scope

### In scope

1. Per-public-page document title + meta description  
2. Canonical `<link rel="canonical">`  
3. Open Graph + Twitter card tags  
4. `robots` meta (`index,follow` vs `noindex,nofollow`)  
5. Static `public/robots.txt` and `public/sitemap.xml`  
6. JSON-LD `Organization` + `LocalBusiness` on website layout  
7. Sensible defaults in `index.html` before JS boots  
8. Dynamic SEO for `/services/:slug` from service detail data  
9. Wire absolute URLs from `APP_CONFIG.publicSiteUrl` (prod must be `https://www.pcmazing.com`)

### Out of scope

- Angular Universal / SSR / prerender  
- Google Search Console / Bing verification setup (manual after deploy)  
- DNS / hosting redirect `pcmazing.com` → `www.pcmazing.com` (ops)  
- Rewriting marketing copy for keyword campaigns  
- Changing admin/portal PWA manifests beyond SEO disallow

## §1 Tags & page meta

### Components

| Piece | Responsibility |
|-------|----------------|
| `frontend/src/app/website/seo/seo.service.ts` | Apply title, description, canonical, OG/Twitter, robots via Angular `Title` + `Meta` + `Renderer2`/`DOCUMENT` for canonical link |
| `frontend/src/app/website/seo/website-seo.data.ts` | Typed meta for each public path (title, description, optional ogImage, indexable) |
| Website layout or app router hook | On `NavigationEnd`, resolve meta for URL and call `SeoService.apply(...)` |
| Service detail page | Override title/description from `getServiceBySlug` when slug resolves |

### Public indexable pages

| Path | Notes |
|------|--------|
| `/` | Home |
| `/web-services` | Web services listing |
| `/our-work` | Portfolio |
| `/about` | About |
| `/contact` | Contact |
| `/schedule-demo` | Demo booking |
| `/leave-a-review` | Reviews |
| `/services/:slug` | From `serviceDetails` slugs (pc-laptop-repair, custom-pc-builds, printer-sales-repair, web-development, tech-support) |

### Non-indexable (meta robots + robots.txt)

- `/admin` and all children  
- `/user` and all children  
- `/setup`  
- `/q/*` (shared quotations)  
- `/time-clock` (redirect surface)

### Tag rules

- **Title:** unique per page; keep existing route title strings where good; service pages: `{Service Name} | PCmazing`.  
- **Description:** 150–160 chars where practical; written in `website-seo.data.ts` (no empty descriptions).  
- **Canonical:** `https://www.pcmazing.com` + path (no query string).  
- **OG/Twitter:** `og:title`, `og:description`, `og:url`, `og:type` (`website`), `og:image` (absolute), `og:site_name` = `PCmazing`; Twitter `summary_large_image` (or `summary` if image is logo-only).  
- **Default image:** absolute `PUBLIC_SITE_URL + /images/logopcm.png` (confirm file exists at implement time; fall back to `/images/logo.png` if needed).  
- **Site URL source:** `APP_CONFIG.publicSiteUrl` trimmed of trailing slash; document that production `.env` must set `PUBLIC_SITE_URL=https://www.pcmazing.com`.

## §2 robots, sitemap, structured data

### `public/robots.txt`

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

### `public/sitemap.xml`

- Absolute `https://www.pcmazing.com/...` URLs for all indexable pages listed above (including each service slug).  
- Reasonable `changefreq` / `priority` (home highest).  
- Omit private/app routes.

### JSON-LD

Inject once on `WebsiteLayoutComponent` (public marketing chrome only):

- `@type`: `Organization` and/or `LocalBusiness` (LocalBusiness preferred for store; can nest Organization)  
- `name`: PCmazing  
- `url`: `https://www.pcmazing.com`  
- `telephone`, `address`, `openingHoursSpecification` from `footerInfo`  
- `sameAs`: Facebook + Instagram URLs from `footerInfo.social`  
- `image` / `logo`: absolute logo URL  

Do **not** inject LocalBusiness JSON-LD on admin/user shells.

### `index.html`

- Keep viewport, icons, theme-color.  
- Add default `<meta name="description">` and keep a default `<title>` aligned with home.  
- Optional default `og:` tags pointing at home (overwritten by `SeoService` after boot).

## Acceptance

1. View-source / DevTools on `/`, `/about`, `/contact`, `/services/web-development`: unique title + description; canonical and `og:url` use `www.pcmazing.com`.  
2. `/admin` (when opened) and `/q/...` set `noindex`.  
3. `https://www.pcmazing.com/robots.txt` and `/sitemap.xml` served as static files after deploy (present under `frontend/public/`).  
4. Home (website layout) contains valid JSON-LD with address/phone matching footer.  
5. Changing route updates meta without full reload.  
6. Production env documents `PUBLIC_SITE_URL=https://www.pcmazing.com`.

## Risks / follow-ups (ops, not this PR)

- Apex `pcmazing.com` should 301 to `www` at the host.  
- Submit sitemap in Google Search Console after go-live.  
- Optional later: prerender/SSR if indexing gaps appear.
