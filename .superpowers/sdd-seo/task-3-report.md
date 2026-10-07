# Task 3 Report

Status: DONE

Changes:
- `frontend/public/robots.txt`: Allow `/`, disallow admin/user/setup/q/time-clock; sitemap URL.
- `frontend/public/sitemap.xml`: 12 indexable `https://www.pcmazing.com` URLs (home priority 1.0; static 0.7–0.8; services 0.8).
- `frontend/src/index.html`: default description + `index, follow` robots meta after title.
- `frontend/.env.example`: prod `PUBLIC_SITE_URL` comment notes SEO canonicals/OG requirement.
- `docs/superpowers/specs/2026-10-07-website-seo-launch-design.md`: Status **Implemented**.

Commit: `e0e0317` — "Add robots.txt, sitemap, and index SEO defaults for launch."

Build: `npx ng build --configuration=development` exit 0; `robots.txt` and `sitemap.xml` present under `dist/pcmazing-site/browser/`.

Concerns:
- Manual DevTools checks (per brief) not run in this session; recommend spot-check `/`, `/about`, `/services/web-development`, and static `/robots.txt` via `ng serve`.

## Fix: TitleStrategy overwrite
- app.ts: applySeo now runs inside queueMicrotask so it executes after the router TitleStrategy sets the title.
- app.routes.ts: removed static title from services/:slug (SeoService owns it); other route titles kept as first-paint fallbacks.
- index.html: added default og:type/title/description/image/url pointing to https://www.pcmazing.com.
- Verified: npx ng build --configuration=development succeeded.
- Concern: not browser-verified; microtask ordering relies on TitleStrategy running before NavigationEnd emission (true in Angular 21).
