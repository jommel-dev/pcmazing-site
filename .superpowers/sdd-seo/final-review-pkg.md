BASE: 7fcd564
HEAD: e0e0317c87dba7147f5dfd25b30d9921e0b7ee24


## Commits

e0e0317 Add robots.txt, sitemap, and index SEO defaults for launch.
1c29a5a Apply SEO meta on navigation and inject LocalBusiness JSON-LD.
d8fa110 Upsert SEO meta tags so apply works without index.html seeds.
22fae43 Add website SeoService, page meta map, and JSON-LD builder.

## Stat

 .../specs/2026-10-07-website-seo-launch-design.md  |   2 +-
 frontend/.env.example                              |   2 +-
 frontend/public/robots.txt                         |  10 ++
 frontend/public/sitemap.xml                        |  63 +++++++++++
 frontend/src/app/app.ts                            |  26 ++++-
 .../app/website/layout/website-layout.component.ts |  30 +++++-
 frontend/src/app/website/seo/json-ld.util.ts       |  34 ++++++
 frontend/src/app/website/seo/seo-url.util.ts       |  15 +++
 frontend/src/app/website/seo/seo.service.ts        |  65 +++++++++++
 frontend/src/app/website/seo/website-seo.data.ts   | 120 +++++++++++++++++++++
 frontend/src/index.html                            |   2 +
 11 files changed, 363 insertions(+), 6 deletions(-)
