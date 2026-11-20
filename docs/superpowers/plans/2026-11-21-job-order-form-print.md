# Job Order Form Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Job Order intake fields and a second A4 **Job Order Form** print that matches the paper form, while keeping the existing sales receipt print.

**Architecture:** Migration + ensure for intake columns on `pcmazing_services`; normalize helpers for enums/accessories; wire create/update/get; Angular create/edit intake UI; dedicated `/admin/job-order/:id/form` print page with fixed A4 CSS. Sales receipt path untouched.

**Tech Stack:** NestJS + PostgreSQL, Angular reactive forms, browser `@media print` A4 layout, Jest for intake util tests.

**Spec:** `docs/superpowers/specs/2026-11-21-job-order-form-print-design.md`  
**Reference image:** `agent assets` / user-attached Job Order Form scan

## Global Constraints

- Keep JO **sales receipt** print unchanged.
- Form print is **A4 portrait** (`210×297mm`), near-exact section match, prefer **one page**.
- Intake fields optional on create (blanks OK on print).
- Agreement text **hardcoded V1** (exact copy from reference image; no Printing settings editor).
- Print entry: **Print Job Order Form** on create/edit/view after save → `/admin/job-order/:id/form`.
- Accessory keys exactly: `laptop_unit`, `desktop_pc`, `printers`, `iphone`, `android`, `charger`, `battery`, `memory_ram`, `storage`, `mouse`, `keyboard`, `bag_case`, `optical_drive`, `cables`, `others`.
- Remaining balance = effective total − downpayment (honor `manualTotalAmount` when set).
- Commits only when the user explicitly asks.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/sql/migrations/088_job_order_intake_form.sql` | New columns |
| `backend/src/admin/inventory/job-order-intake.schema.ts` | Runtime ensure |
| `backend/src/admin/inventory/job-order-intake.util.ts` | Normalize enums/accessories/labels |
| `backend/src/admin/inventory/job-order-intake.util.spec.ts` | Unit tests |
| `backend/src/admin/inventory/dto/create-service.dto.ts` | Intake DTO fields |
| `backend/src/admin/inventory/inventory-services.service.ts` | Persist/read intake |
| `frontend/.../admin-api.service.ts` | Types + payloads |
| `frontend/.../job-order-intake.util.ts` | Shared keys/labels for UI + print |
| `frontend/.../inventory-service-create-page.component.*` | Intake UI + Print Form button |
| `frontend/.../inventory-service-form-page.component.*` | A4 form print page (new) |
| `frontend/.../admin.routes.ts` | Route `job-order/:id/form` |

---

### Task 1: Migration + ensure schema

**Files:**
- Create: `backend/src/sql/migrations/088_job_order_intake_form.sql`
- Create: `backend/src/admin/inventory/job-order-intake.schema.ts`

**Interfaces:**
- Produces: `ensureJobOrderIntakeColumns(db: DatabaseService): Promise<void>`

- [ ] **Step 1: Write migration**

```sql
-- Job Order Form intake fields (A4 service agreement print).

ALTER TABLE pcmazing_services
  ADD COLUMN IF NOT EXISTS service_arrangement VARCHAR(20),
  ADD COLUMN IF NOT EXISTS device_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS device_type_other VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_cpu VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_ram VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_storage VARCHAR(120),
  ADD COLUMN IF NOT EXISTS device_display VARCHAR(120),
  ADD COLUMN IF NOT EXISTS included_accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS included_accessories_other VARCHAR(255),
  ADD COLUMN IF NOT EXISTS unit_condition VARCHAR(20),
  ADD COLUMN IF NOT EXISTS unit_condition_other VARCHAR(120),
  ADD COLUMN IF NOT EXISTS customer_reported_issue TEXT,
  ADD COLUMN IF NOT EXISTS technician_diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS service_requested TEXT,
  ADD COLUMN IF NOT EXISTS expected_completion VARCHAR(120),
  ADD COLUMN IF NOT EXISTS consent_software_install BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consent_data_backup_ack BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS released_by VARCHAR(120);
```

- [ ] **Step 2: Ensure helper** (mirror `job-order-manual-total.schema.ts`: ready flag + `ADD COLUMN IF NOT EXISTS` for each column / one ALTER batch).

- [ ] **Step 3: Smoke** — Nest restart or call ensure from a temporary script; confirm columns exist locally when API hits JO create/get (full wire-up in Task 3).

---

### Task 2: Intake util (TDD)

**Files:**
- Create: `backend/src/admin/inventory/job-order-intake.util.ts`
- Create: `backend/src/admin/inventory/job-order-intake.util.spec.ts`

**Interfaces:**
- Produces:
  - `JO_ACCESSORY_KEYS` readonly tuple
  - `ServiceArrangement = 'in_store' | 'onsite_home' | 'onsite_office'`
  - `DeviceType = 'laptop' | 'desktop' | 'printer' | 'iphone' | 'android' | 'others'`
  - `UnitCondition = 'good' | 'minor' | 'defective' | 'others'`
  - `normalizeServiceArrangement(v?: string | null): ServiceArrangement | null`
  - `normalizeDeviceType(v?: string | null): DeviceType | null`
  - `normalizeUnitCondition(v?: string | null): UnitCondition | null`
  - `normalizeAccessories(input?: string[] | null): string[]` — unique, only known keys
  - `mapJobStatusToFormChecks(status: string): { pending: boolean; inProgress: boolean; forRelease: boolean; completed: boolean }`

- [ ] **Step 1: Write failing tests** covering valid/invalid enums, accessory filter, status mapping (`Pending`→pending, `In Progress`→inProgress, `Done`/`Completed`→completed, etc.).

- [ ] **Step 2: Run** `cd backend && npx jest src/admin/inventory/job-order-intake.util.spec.ts --verbose` → expect FAIL.

- [ ] **Step 3: Implement util** until tests PASS.

- [ ] **Step 4: Re-run tests** → PASS.

---

### Task 3: Backend DTO + service persist/read

**Files:**
- Modify: `backend/src/admin/inventory/dto/create-service.dto.ts`
- Modify: `backend/src/admin/inventory/inventory-services.service.ts` (types, create INSERT, update SET, getById SELECT/map)
- Call `ensureJobOrderIntakeColumns` alongside other ensures on create/get/update

**Interfaces:**
- Consumes: Task 1 ensure + Task 2 normalize helpers
- Produces API fields on service detail (camelCase):
  - `serviceArrangement`, `deviceType`, `deviceTypeOther`, `deviceCpu`, `deviceRam`, `deviceStorage`, `deviceDisplay`
  - `includedAccessories: string[]`, `includedAccessoriesOther`
  - `unitCondition`, `unitConditionOther`
  - `customerReportedIssue`, `technicianDiagnosis`, `serviceRequested`, `expectedCompletion`
  - `consentSoftwareInstall`, `consentDataBackupAck`, `releasedBy`

- [ ] **Step 1: Extend DTO** with optional `@IsOptional` / `@IsIn` / `@IsArray` / `@IsBoolean` / `@IsString` `@MaxLength` fields matching the table. Use `@Type(() => Boolean)` / `@Transform` where the project already does for booleans.

- [ ] **Step 2: Extend `InventoryServiceItem` (or equivalent) interface** in the service file with the new camelCase fields.

- [ ] **Step 3: create + update** — normalize inputs; include columns in INSERT/UPDATE; store accessories as JSON (`JSON.stringify` / jsonb param).

- [ ] **Step 4: getById / map** — SELECT new columns; parse `included_accessories` jsonb to `string[]`; map nulls safely.

- [ ] **Step 5: Typecheck** `cd backend && npx tsc --noEmit -p tsconfig.build.json` → exit 0.

---

### Task 4: Frontend types + create/edit intake UI

**Files:**
- Create: `frontend/src/app/admin/pages/inventory/job-order-intake.util.ts` (keys + labels for checkboxes; mirror backend keys)
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` (service item + create/update payload)
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.ts`
- Modify: `frontend/src/app/admin/pages/inventory/inventory-service-create-page.component.html`

**Interfaces:**
- Consumes: API fields from Task 3
- Produces: form controls + payload keys identical to API

- [ ] **Step 1: Add `job-order-intake.util.ts`** with accessory/device/arrangement/condition option lists `{ value, label }` matching the paper form wording.

- [ ] **Step 2: Extend API types** on job/service item and create/update payloads.

- [ ] **Step 3: Form controls** on create page (defaults: arrangement/type/condition null or `''`; accessories `[]`; consents `false`; text fields `''`).

- [ ] **Step 4: Patch on load** when editing an existing JO.

- [ ] **Step 5: Template section** “Job Order Form intake” after customer/device basics:
  - Service arrangement radios
  - Device type radios + other text
  - CPU / RAM / Storage / Display inputs (near brand/model/serial)
  - Accessories multi-checkbox grid
  - Unit condition radios + other
  - Reported issue / diagnosis textareas
  - Service requested textarea (if empty on submit, optionally prefills from service line names — do this in submit builder)
  - Expected completion
  - Two consent checkboxes (wording from form)
  - Released by (optional)

- [ ] **Step 6: Include fields in create/update payload.**

- [ ] **Step 7: Manual check** — save JO with a few checks; reload edit page; values stick.

---

### Task 5: A4 form print page + route + button

**Files:**
- Create: `frontend/src/app/admin/pages/inventory/inventory-service-form-page.component.ts`
- Create: `frontend/src/app/admin/pages/inventory/inventory-service-form-page.component.html`
- Create: `frontend/src/app/admin/pages/inventory/inventory-service-form-page.component.css`
- Modify: `frontend/src/app/admin/admin.routes.ts` — add `job-order/:id/form` **before** `job-order/:id` if needed so `:id` does not swallow `form`
- Modify: create page HTML/TS — **Print Job Order Form** button when `id` exists (edit/view); `routerLink` or navigate to `['/admin/job-order', id, 'form']` (optional `queryParams: { print: '1' }`)

**Interfaces:**
- Consumes: `getInventoryService(id)` / existing get JO API with intake fields
- Produces: printable A4 sheet

- [ ] **Step 1: Register route**

```typescript
{
  path: 'job-order/:id/form',
  component: InventoryServiceFormPageComponent,
  // same guards/permissions as receipt route
},
```

Place it next to `job-order/:id/receipt`.

- [ ] **Step 2: Component skeleton** — load JO by id; load printing settings for letterhead fallback; `printForm()` → `window.print()`; honor `?print=1` after load like receipt page.

- [ ] **Step 3: HTML structure** matching form sections in order (header, title bar, service arrangement, two-column customer/accessories, device/condition, issues, service/pricing, agreement, signatures, internal footer). Use checkbox visuals (`☐`/`☑` or CSS boxes) bound to data.

- [ ] **Step 4: Hardcode agreement** — copy the **exact** 9 terms + 2 consent sentences from the reference Job Order Form image (do not paraphrase). Consents reflect `consentSoftwareInstall` / `consentDataBackupAck`.

- [ ] **Step 5: CSS** — `.form-sheet { width: 210mm; min-height: 297mm; }`, compact typography, blue section bars, `@page { size: A4; margin: 8mm; }`, hide `.no-print` when printing. Tune until Chrome print preview is one page.

- [ ] **Step 6: Money fields** — estimated = effective total (manual total if set); downpayment; remaining = max(0, estimated − downpayment).

- [ ] **Step 7: Add Print Job Order Form button** on create/edit page (and view mode). Disabled until JO has an id.

- [ ] **Step 8: Verify sales receipt route still works** (`/job-order/:id/receipt`).

---

### Task 6: End-to-end verification

**Files:** none (checklist) + mark spec Implemented

- [ ] **Step 1:** `cd backend && npx jest src/admin/inventory/job-order-intake.util.spec.ts --verbose` → PASS  
- [ ] **Step 2:** `cd backend && npx tsc --noEmit -p tsconfig.build.json` → exit 0  
- [ ] **Step 3:** Apply migration `088` (or rely on ensure) on local DB  
- [ ] **Step 4: Acceptance**

| Case | Expect |
|------|--------|
| Full intake JO | Form checks/text filled |
| Empty intake JO | Form prints with blanks |
| Consents on/off | Boxes match |
| Manual total + DP | Remaining correct |
| Sales receipt | Unchanged |
| A4 print preview | One page, sections readable |

- [ ] **Step 5:** Set spec status to `Implemented` in `docs/superpowers/specs/2026-11-21-job-order-form-print-design.md`

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| Migration intake columns | 1 |
| Normalize enums/accessories | 2 |
| API persist/read | 3 |
| Create/edit UI | 4 |
| A4 form print + route + button | 5 |
| Keep sales receipt | 5–6 |
| Hardcoded agreement V1 | 5 |
| Remaining balance / manual total | 5–6 |
| Optional empty intake | 4–6 |

No TBDs; accessory keys match the spec exactly.
