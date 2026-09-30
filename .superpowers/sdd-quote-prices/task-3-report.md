# Task 3 Report: Merge local hits into parts price search

**Status:** Complete

## Changes
- Injected `LocalPriceListsService` into `PartsPriceSearchService`.
- `search()` always fetches local hits via `searchActiveItems` (errors captured as `sourceId: 'local'`, empty array fallback).
- When `PARTS_SEARCH_ENABLED=false`, skips web adapters but still returns local hits plus the existing system disabled message.
- When web enabled, merges web + local, then dedupe / sort by `pricePhp` / slice as before.
- `AdminModule` already provided both services — no module wiring change.

## Verification
- `cd backend; npx tsc --noEmit -p tsconfig.build.json` — pass (exit 0)

## Commit
- `Merge local price list hits into parts price search.`

## Notes / concerns
- Cached results now include local hits (cache key prefixed `web`/`local`). Local DB edits may lag up to TTL (8 min) for repeated identical queries.
- `PartsPriceHit` type still omits optional `sku`; local hits carry `sku` at runtime from `LocalPriceSearchHit`.
