# Quotation Edit + Print Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow editing any quotation status, unify Add item for custom lines, keep optional fields optional, and polish quotation print layout.

**Architecture:** Extend existing `PATCH` update path (drop draft-only guard); reuse create form for edit; unify line-item UX under one searchable row; adjust print HTML/TS for columns, page number, validity note.

**Tech Stack:** NestJS + class-validator, Angular reactive forms, existing quotation/print pages.

**Spec:** `docs/superpowers/specs/2026-09-19-quotation-edit-and-print-polish-design.md`

## Global Constraints

- Edit overwrites in place; preserve `quote_no`.
- Save as draft or finalize available when editing finalized quotes.
- Optional: email, phone, address, remarks (blank email must not fail).
- Print: Item Description only; no Page 1; validity note algorithm from spec.
- Remove Add custom item; single Add item with “Use as custom item”.

---

### Task 1: Backend — allow update for any status + empty optional email

**Files:**
- Modify: `backend/src/admin/quotation/quotation.service.ts` (`updateDraft`)
- Modify: `backend/src/admin/quotation/dto/create-quotation.dto.ts` (email empty transform if needed)
- Modify: `backend/src/admin/quotation/quotation.controller.ts` (message wording if useful)

- [ ] **Step 1:** Remove `existing.status !== 'draft'` guard in `updateDraft`; optionally rename method to `update` and keep controller wiring.
- [ ] **Step 2:** Ensure empty-string email/phone/address/remarks normalize to null (header already trims; confirm DTO `@Transform` for email).
- [ ] **Step 3:** Manual smoke: PATCH finalized quotation succeeds; PATCH with empty email succeeds.

### Task 2: Frontend — edit entry points + load any status

**Files:**
- Modify: `frontend/.../quotation-create-page.component.ts` (remove finalized redirect)
- Modify: `frontend/.../quotation-detail-page.component.ts` + `.html` (`canEdit`, Edit label)
- Modify: `frontend/.../quotations-page.component.html` (Edit link)

- [ ] **Step 1:** Create page loads draft and finalized into form.
- [ ] **Step 2:** Detail `canEdit()` = pcmazing source (any status); button “Edit”.
- [ ] **Step 3:** List adds Edit link to `/admin/quotations/:id/edit` for pcmazing items.

### Task 3: Frontend — unified Add item (remove Add custom item)

**Files:**
- Modify: `frontend/.../quotation-create-page.component.html`
- Modify: `frontend/.../quotation-create-page.component.ts`

- [ ] **Step 1:** Remove Add custom item button; keep Add item only.
- [ ] **Step 2:** Always use searchable item input (no separate custom-only textarea mode).
- [ ] **Step 3:** Add dropdown action “Use “{query}” as custom item”; on select/commit set description, clear materialId, itemKind custom.
- [ ] **Step 4:** Sync partQuery ↔ description for custom; submit accepts material OR non-empty description.
- [ ] **Step 5:** Update helper copy under Quoted items.

### Task 4: Frontend — optional field validation

**Files:**
- Modify: `frontend/.../quotation-create-page.component.ts`

- [ ] **Step 1:** Ensure email validator allows empty (custom or valueChanges clear); phone/address/remarks already optional.
- [ ] **Step 2:** Confirm submit sends `undefined` for blank optional fields (already does).

### Task 5: Print layout polish

**Files:**
- Modify: `frontend/.../quotation-print-page.component.html`
- Modify: `frontend/.../quotation-print-page.component.ts`
- Modify: `frontend/.../quotation-print-page.component.css` (if note needs style)

- [ ] **Step 1:** Rename Item → Item Description; remove Description column (built-in + template table).
- [ ] **Step 2:** Never show Page 1 / clear pageNumber field value.
- [ ] **Step 3:** Add `formatValidityDuration(days)` per spec; render note bottom-left on built-in sheet.

### Task 6: Verify

- [ ] Edit draft and finalized; save as draft / finalize; quote no unchanged.
- [ ] Custom line via unified Add item saves.
- [ ] Empty optional fields save.
- [ ] Print columns / no page / validity note look correct.
