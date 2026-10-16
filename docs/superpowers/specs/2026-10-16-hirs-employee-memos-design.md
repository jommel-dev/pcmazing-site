# HIRS employee memos + Payroll → HIRS rename design

**Date:** 2026-10-16  
**Status:** Approved for planning  
**Scope:** Admin-issued employee memos (violations / formal notices) with mandatory acknowledge popup on employee dashboard; rename admin nav/module surface from Payroll to HIRS.

## Goals

1. Admins can issue a formal **memo** to one employee (facts, policy, directive) under HIRS.
2. When a memo is issued, the employee sees a **blocking popup** on their dashboard until they **Acknowledge**.
3. After acknowledgment, the memo no longer auto-pops but remains available in the employee’s memo list.
4. Rename user-facing **Payroll** to **HIRS** (full URL change with redirect); keep backend permission keys.

## Research summary (standard memo)

PH-style HR memos / written warnings typically include company letterhead, memo number, date, To/From/Subject, statement of facts, policy violated, directive/expectations, issuer signature, and acknowledgment of receipt. This design uses that structure for an in-app document (not a full twin-notice legal NTE workflow).

## Decisions

| Topic | Choice |
| --- | --- |
| Admin UX | New **Memos** tab on HIRS page |
| Assignment | **One employee per memo** |
| Memo type | Dropdown: Verbal reminder / Written warning / Final warning / Other |
| Popup | Must **Acknowledge** (timestamp); no dismiss until ack |
| After ack | No auto-popup; still listed under My memos |
| Multiple pending | Show oldest first, then next after ack |
| Edit after issue | No (v1 issue-immediately) |
| Header branding | Logo + company name/address from printing settings (fallback defaults) |
| HIRS rename | Label + page titles + route `/admin/hirs`; redirect `/admin/payroll` → `/admin/hirs` |
| Permissions / API | Keep `payroll.view` / `payroll.edit` and `/admin/payroll` API paths |

## Data model

Migration `080_employee_memos.sql` — table `pcmazing_employee_memos`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | SERIAL PK | |
| `memo_no` | VARCHAR | Unique, e.g. `MEMO-2026-000001` |
| `employee_user_id` | INT NOT NULL | Target admin/employee user |
| `memo_type` | VARCHAR NOT NULL | `verbal_reminder` \| `written_warning` \| `final_warning` \| `other` |
| `subject` | VARCHAR(300) NOT NULL | |
| `incident_date` | DATE NULL | Optional |
| `statement_of_facts` | TEXT NOT NULL | |
| `policy_violated` | TEXT NULL | |
| `directive` | TEXT NULL | Expected action |
| `reply_by_date` | DATE NULL | Optional |
| `issued_by_user_id` | INT NOT NULL | Admin issuer |
| `issued_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |
| `acknowledged_at` | TIMESTAMPTZ NULL | Set on employee ack |
| `created_at` / `updated_at` | TIMESTAMPTZ | |
| `deleted_at` | TIMESTAMPTZ NULL | Soft delete (admin void optional later) |

Indexes: `(employee_user_id, acknowledged_at)`, unique `(memo_no)`.

## APIs

**Admin** (under existing payroll controller or small memos controller, still `payroll.edit` / `payroll.view`):

- `GET /admin/payroll/memos` — list (filters: employee, type, ack status)
- `POST /admin/payroll/memos` — create + issue
- `GET /admin/payroll/memos/:id` — detail

**Employee workspace:**

- `GET /admin/employee-workspace/memos` — my memos (newest first)
- `GET /admin/employee-workspace/memos/pending` — unacknowledged (oldest first)
- `POST /admin/employee-workspace/memos/:id/acknowledge` — set `acknowledged_at` if owner + not yet ack

Dashboard payload may include `pendingMemosCount` or the pending list for convenience.

## UI

### Admin HIRS page

- Rename nav label to **HIRS**, route `/admin/hirs`, headings HIRS.
- Redirect route `payroll` → `hirs`.
- New tab **Memos**: list + create form + detail (print-friendly header with logo).

### Employee dashboards

- On `SalesEmployeeDashboardComponent` (and any role home that shows employee workspace): after dashboard load, if pending memos exist, open modal with full memo content.
- Modal: Acknowledge button only (no close until ack).
- Section **My memos** for history.

### Memo document layout

```
[Logo]  Company name
        Address

MEMORANDUM                    Memo No: …
Date: …
To: … (Name, Position)
From: … (Issuer)
Type: …
Subject: …

1. Statement of Facts
2. Policy / Rule Violated (if any)
3. Directive / Expected Action (if any)

Issued by: …                 Acknowledged: … / pending
```

## Out of scope (v1)

- Multi-employee blast
- Employee written reply / hearing scheduling
- Email/SMS delivery
- Renaming Nest permission keys or `/admin/payroll` API prefix
- Soft-delete void UI (column reserved optional)

## Spec self-review

- No TBDs; ack and rename decisions locked.
- Public/employee APIs scoped to own memos only.
- HIRS rename does not break existing `payroll.*` RBAC.
