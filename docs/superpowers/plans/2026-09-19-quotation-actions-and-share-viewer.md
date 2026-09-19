# Quotation Actions + Share Viewer Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Icon actions, sorting, status capsules, duplicate/delete, and expiring public share viewer.

**Spec:** `docs/superpowers/specs/2026-09-19-quotation-actions-and-share-viewer-design.md`

**Architecture:** Extend admin quotation APIs + migration for `share_token`; public `GET` by token; Angular list/detail + `/q/:token` page.

---

### Task 1: Migration + backend APIs
- [ ] Add `share_token` unique nullable column
- [ ] list sortBy/sortDir; duplicate; softDelete; ensure/regenerate share link; public getByToken

### Task 2: Admin API client
- [ ] Wire new methods + list sort params

### Task 3: Quotations list UI
- [ ] Icon actions, capsules, sortable headers

### Task 4: Detail share UI
- [ ] Copy + Regenerate

### Task 5: Public viewer route
- [ ] `/q/:token` page with protections

### Task 6: Verify build
