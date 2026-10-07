### Task 2: Wire navigation + JSON-LD + service detail

**Files:**
- Modify: `frontend/src/app/app.ts` (or create `frontend/src/app/website/seo/seo-router.initializer` called from `app.config.ts` / root component â€” prefer root `App` component if it already exists)
- Modify: `frontend/src/app/website/layout/website-layout.component.ts` (+ html if needed for script tag)
- Modify: `frontend/src/app/website/pages/service-detail/service-detail-page.component.ts` (ensure SEO applied when slug loads; router hook may already cover if `resolvePageSeo` uses slug)

**Interfaces:**
- Consumes: `SeoService.apply`, `resolvePageSeo`, `buildLocalBusinessJsonLd`
- On every `NavigationEnd`: `seo.apply(resolvePageSeo(router.url))` â€” use path only (`router.parseUrl` / `event.urlAfterRedirects`)

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

In `ngOnDestroy`, remove `#pcmazing-jsonld` so admin shell does not keep it if user navigates (admin is separate outlet â€” layout destroy should clean up).

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


