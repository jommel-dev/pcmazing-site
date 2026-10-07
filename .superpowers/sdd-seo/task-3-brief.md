### Task 3: Static robots/sitemap + index.html + mark spec

**Files:**
- Create: `frontend/public/robots.txt`
- Create: `frontend/public/sitemap.xml`
- Modify: `frontend/src/index.html`
- Modify: `frontend/.env.example` (clarify prod SEO URL if needed)
- Modify: `docs/superpowers/specs/2026-10-07-website-seo-launch-design.md` â†’ Status **Implemented**

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
<meta name="description" content="PCmazing â€” web development, PC repair, custom builds, and tech support in Cabanatuan City, Philippines.">
<meta name="robots" content="index, follow">
```

Keep existing icons/PWA meta.

- [ ] **Step 4: Confirm `.env.example` documents**

`PUBLIC_SITE_URL=https://www.pcmazing.com` for production (already commented â€” strengthen comment: â€œrequired for SEO canonicals/OGâ€).

- [ ] **Step 5: Mark spec Implemented**

- [ ] **Step 6: Build + manual acceptance**

```powershell
cd frontend; npx ng build --configuration=development
```

Manual (local): open `/`, `/about`, `/services/web-development` â€” DevTools `<head>` shows title/description/canonical/og; navigate to a fake admin path if reachable shows noindex when SEO runs. Confirm `/robots.txt` and `/sitemap.xml` via `ng serve` (files from `public/`).

- [ ] **Step 7: Commit**

```powershell
git add frontend/public/robots.txt frontend/public/sitemap.xml frontend/src/index.html frontend/.env.example docs/superpowers/specs/2026-10-07-website-seo-launch-design.md
git commit -m "Add robots.txt, sitemap, and index SEO defaults for launch."
```

