# Task 2 Report

Status: DONE

Changes:
- `frontend/src/app/app.ts`: subscribes to `NavigationEnd` (takeUntilDestroyed), applies `SeoService.apply(resolvePageSeo(path))` using `urlAfterRedirects` stripped of query/hash; also applies once for the initial `router.url`.
- `frontend/src/app/website/layout/website-layout.component.ts`: injects `script#pcmazing-jsonld` (LocalBusiness) into `document.head` on init (via `DOCUMENT`), removes on destroy; removes any stale one first.
- Service detail page: no change (router hook covers it; unknown-slug indexability depends on `resolvePageSeo` from Task 1).

Build: `npx ng build --configuration=development` exit 0.

Concerns:
- Router URL at ngOnInit is typically `/` before first navigation; the NavigationEnd subscription corrects it immediately.
- Unknown service slugs are only noindex if `resolvePageSeo` can tell (it has no API data); service-detail not-found UI is not wired to SEO.
