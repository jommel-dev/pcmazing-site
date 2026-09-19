# Quotation List Actions + Shareable Viewer

**Date:** 2026-09-19  
**Status:** Approved design — pending implementation  
**Approach:** Extend admin quotations + public token viewer

## Goal

Improve the quotations list (icon actions, sorting, status capsules), add duplicate/delete, and provide an expiring shareable customer view with best-effort anti-print/save protections.

## Decisions locked

| Topic | Choice |
|-------|--------|
| Share security | Unguessable token URL; expires with quotation `expires_at`; admin can regenerate |
| Share eligibility | Any status **if not expired** |
| Share UI | List **Share** icon copies link; detail has Copy + Regenerate + expiry |
| Duplicate | Always new **Draft**, new quote number, open **Edit** |
| Delete | Soft-delete **any** status with confirm |
| List actions | Icons: View, Edit, Duplicate, Share, Delete |
| Screenshot blocking | Best-effort deterrents only — **not** true OS-level prevention |

## Scope

### In scope

1. List **Actions** column with icon buttons + tooltips/`aria-label`.
2. Status capsules: Draft grey, Finalized blue; Converted/Expired muted amber/red variants.
3. Server-side column sorting: Quote No, Date, Customer, Amount, Status, Expires (toggle asc/desc; default Date desc).
4. `POST` duplicate → draft → navigate to edit.
5. Soft-delete any status; invalidate share access.
6. Share token on quotation; public route `/q/:token`; create-on-demand when copying; regenerate on detail.
7. Public read-only viewer with print/save/copy deterrents + watermark; honest limitation on screenshots.

### Out of scope

- PIN/password on the shared page
- True screenshot DRM / black-out capture
- Undelete / trash UI
- Auto-email of share links
- Changing legacy (non-pcmazing) quotation write paths beyond View

## Architecture

```
Admin list ──► View / Edit / Duplicate / Share / Delete
                      │              │         │
                      │              │         └── soft-delete + clear token
                      │              └── ensure token → clipboard `/q/:token`
                      └── POST duplicate → new draft → Edit

Public `/q/:token` ──► PublicQuotationController (no admin JWT)
                              │
                              ▼
                     Lookup by token; reject if missing/deleted/expired
                              │
                              ▼
                     Read-only viewer (print/copy deterrents)
```

### Components

| Unit | Responsibility |
|------|----------------|
| Migration | Add `share_token` (unique, nullable) + optional `share_token_created_at` on `pcmazing_quotations` |
| `QuotationService` | `duplicate`, `softDelete`, `ensureShareToken`, `regenerateShareToken`, list `sortBy`/`sortDir` |
| `QuotationController` (admin) | New endpoints; JWT required |
| Public quotation controller/route | `GET` by token; no auth; minimal payload |
| `QuotationsPageComponent` | Icons, sort headers, capsules, wire actions |
| `QuotationDetailPageComponent` | Copy + Regenerate share UI |
| `PublicQuotationPageComponent` | Customer-facing `/q/:token` view |

## List UI

### Actions (pcmazing)

| Icon | Behavior |
|------|----------|
| View | Navigate to detail |
| Edit | Navigate to edit |
| Duplicate | Call API → open new draft in edit |
| Share | If expired → toast error; else ensure token → copy absolute URL → “Copied” feedback |
| Delete | Confirm → soft-delete → refresh list |

Legacy rows: View only (or View + disabled others), consistent with current edit rules.

### Status capsules

- `draft` → grey background, dark text  
- `finalized` → blue background, white/dark-blue text  
- `converted` → amber/muted  
- `expired` → red/muted  

### Sorting

Query params: `sortBy` ∈ `quoteNo | quoteDate | customerName | totalAmount | status | expiresAt`, `sortDir` ∈ `asc | desc`.  
Default: `quoteDate` + `desc`.  
UI: clickable `<th>` with sort indicator.

## Duplicate

- Copy: customer fields, remarks, custom discount, validity days, quote date = now (or keep original date — **locked: use now** so validity recalculates from today), items (material/custom lines, qty, prices, discounts).
- New `quote_no`; status `draft`; new `expires_at` from now + validity days.
- Do **not** copy share token.
- Response: new quotation detail; frontend navigates to edit.

## Delete

- Soft-delete header (`deleted_at`); soft-delete or leave items as-is under existing patterns.
- Clear `share_token` (or leave but public lookup requires `deleted_at IS NULL`).
- Confirm copy: e.g. “Delete quotation {quoteNo}? This cannot be undone from the list.”

## Share tokens

- Generate cryptographically random URL-safe token (e.g. 32+ bytes).
- Unique index; one active token per quotation.
- **Ensure:** if null and not expired → generate; return URL path `/q/{token}`.
- **Regenerate:** new token; previous links fail.
- **Public access rules:** token matches AND `deleted_at IS NULL` AND (`expires_at` is null OR `expires_at` > now).
- Frontend absolute URL: `origin + /q/` + token (public Angular route, not under `/admin`).

## Public viewer protections (best-effort)

Must implement:

1. No print button; `@media print { body { display: none } }` (or blank page message).
2. Intercept Ctrl/Cmd+P and common save shortcuts where possible.
3. CSS `user-select: none`; disable context menu on the page.
4. Watermark overlay (quote no + “Confidential — do not distribute”).
5. No admin navigation, no download PDF endpoint on this route.

Must **document in UI** (small footer note): viewing protections are limited; screenshots and external capture cannot be fully prevented.

## API sketch

Admin (JWT):

- `GET /admin/quotations?sortBy=&sortDir=&...` — extend list  
- `POST /admin/quotations/:id/duplicate`  
- `DELETE /admin/quotations/:id`  
- `POST /admin/quotations/:id/share-link` — ensure token; return `{ url, token, expiresAt }`  
- `POST /admin/quotations/:id/share-link/regenerate` — new token; same shape  

Public (no JWT):

- `GET /public/quotations/:token` — sanitized detail (customer + lines + totals + expiry); 404 if invalid/expired/deleted  

## Testing / verification

1. Sort each column asc/desc across pages.  
2. Duplicate finalized → draft edit opens; independent of source.  
3. Delete removes from list; old share URL unavailable.  
4. Share on non-expired draft/finalized copies working link; expired shows error.  
5. Regenerate invalidates previous token.  
6. Public page: print stylesheet blank; no admin chrome; watermark visible.  

## Risks

- Screenshot/print cannot be fully stopped in browsers (accepted).  
- Leaked token before expiry grants view access until regenerate/expiry/delete.  
- Soft-deleted quotes not restorable without a future trash feature.
