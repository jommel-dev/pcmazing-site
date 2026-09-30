BASE: aa93877
HEAD: 5b3d83385acf91f3f4df088c14772de42d909437


## Commits

5b3d833 Add quotation topup UI and mark local prices spec implemented.
36b7feb Persist quotation line topup and strip it from public share.
be377ca Add admin UI for local price lists and CSV import.
611bde4 Merge local price list hits into parts price search.
e07f67c Add local price lists admin API and CSV replace.
405c904 Add local price list migration and topup/CSV helpers.

## Stat

 backend/src/admin/admin.module.ts                  |   4 +
 .../local-price-lists/dto/local-price-item.dto.ts  |  50 +++
 .../local-price-lists/dto/local-price-store.dto.ts |  24 ++
 .../local-price-list-csv.util.spec.ts              |  41 ++
 .../local-price-lists/local-price-list-csv.util.ts |  93 +++++
 .../local-price-lists.controller.ts                | 125 ++++++
 .../local-price-lists/local-price-lists.service.ts | 421 +++++++++++++++++++++
 .../parts-price-search.service.ts                  |  93 +++--
 .../admin/quotation/dto/create-quotation.dto.ts    |  17 +
 .../admin/quotation/quotation-topup.util.spec.ts   |  16 +
 .../src/admin/quotation/quotation-topup.util.ts    |  31 ++
 backend/src/admin/quotation/quotation.service.ts   |  90 ++++-
 .../072_local_price_lists_and_quotation_topup.sql  |  44 +++
 ...9-30-quotation-local-prices-and-topup-design.md |   2 +-
 frontend/src/app/admin/admin.routes.ts             |   8 +
 frontend/src/app/admin/data/admin-modules.data.ts  |  42 +-
 .../local-price-lists-page.component.html          | 391 +++++++++++++++++++
 .../local-price-lists-page.component.ts            | 361 ++++++++++++++++++
 .../quotation-create-page.component.html           |  74 +++-
 .../quotations/quotation-create-page.component.ts  |  99 ++++-
 .../quotation-detail-page.component.html           |  20 +-
 .../quotations/quotation-detail-page.component.ts  |  38 ++
 .../admin/pages/quotations/quotation-topup.util.ts |  37 ++
 frontend/src/app/admin/rbac/admin-roles.ts         |   2 +
 .../src/app/admin/services/admin-api.service.ts    | 112 ++++++
 25 files changed, 2143 insertions(+), 92 deletions(-)
