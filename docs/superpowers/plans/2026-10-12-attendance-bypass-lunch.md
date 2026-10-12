# Attendance Admin Bypass + Lunch Break Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins fill missing employee punches from Payroll → Attendance (admin profile photo, no selfie), and add lunch out/in with a confirm from 11:00 Manila plus overbreak monitoring (flag only; max 1 hour).

**Architecture:** Extend `pcmazing_attendance` with lunch + bypass-admin columns. Pure helpers in `attendance-lunch.util.ts` drive confirm/overbreak math. Employee Time Clock overloads: time-out accepts `intent`; while on lunch, time-in completes lunch in. Admin `POST /admin/payroll/attendance/bypass` fill-missing only. Worked hours stay gross elapsed.

**Tech Stack:** NestJS + PostgreSQL, Angular payroll page + portal time clock, existing selfie/profile upload helpers.

**Spec:** `docs/superpowers/specs/2026-10-12-attendance-bypass-lunch-design.md`

## Global Constraints

- Lunch confirm: **Going to lunch?** vs **End of day** when punch-out at/after **11:00 Manila**.
- Surfaces: employee Time Clock **and** admin Attendance bypass.
- Bypass: default **now**, optional custom `at`; **fill missing only**; permission **`payroll.edit`**.
- Bypass photo: acting admin `profile_image_url`; reject if missing.
- Overbreak: flag/show minutes only; **no pay change**.
- Worked hours: **gross** `time_out − time_in` (unchanged day-pay math).
- One lunch cycle per day; no overwrite of existing punches.

## File map

| File | Responsibility |
| --- | --- |
| `backend/src/sql/migrations/077_attendance_lunch_bypass.sql` | ADD COLUMN lunch + bypass admin ids |
| `backend/src/admin/payroll/payroll.schema.ts` | Mirror columns in `ensurePayrollTables` |
| `backend/src/admin/payroll/attendance-lunch.util.ts` | Pure: confirm needed, lunch minutes, overbreak, action legality |
| `backend/src/admin/payroll/attendance-lunch.util.spec.ts` | Unit tests for helpers |
| `backend/src/admin/payroll/payroll.service.ts` | Status, timeIn/timeOut/lunch, bypass, listAttendance fields |
| `backend/src/admin/payroll/payroll.controller.ts` | `POST attendance/bypass` |
| `backend/src/admin/employee-workspace/employee-workspace.*.ts` | Pass `intent` on time-out; lunch-in via time-in |
| `frontend/.../admin-api.service.ts` | Types + `bypassPayrollAttendance` + time-out intent |
| `frontend/.../portal-time-clock.component.*` | Lunch confirm modal + lunch-in button |
| `frontend/.../payroll-page.component.*` | Attendance columns + bypass dialog |

---

### Task 1: Migration + schema ensure

**Files:**
- Create: `backend/src/sql/migrations/077_attendance_lunch_bypass.sql`
- Modify: `backend/src/admin/payroll/payroll.schema.ts` (after existing `pcmazing_attendance` ALTERs ~131)

**Interfaces:**
- Produces: columns listed below on `pcmazing_attendance`

- [ ] **Step 1: Write migration**

```sql
-- Lunch punches + admin bypass audit on daily attendance.

ALTER TABLE pcmazing_attendance
  ADD COLUMN IF NOT EXISTS lunch_out TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_in TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lunch_out_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS lunch_in_selfie_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS time_in_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS lunch_out_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS lunch_in_bypassed_by_admin_id BIGINT,
  ADD COLUMN IF NOT EXISTS time_out_bypassed_by_admin_id BIGINT;
```

- [ ] **Step 2: Mirror in `payroll.schema.ts`**

Add the same `ALTER TABLE pcmazing_attendance ADD COLUMN IF NOT EXISTS ...` block next to the other attendance ALTERs so `ensurePayrollTables` applies it in dev.

- [ ] **Step 3: Commit**

```bash
git add backend/src/sql/migrations/077_attendance_lunch_bypass.sql backend/src/admin/payroll/payroll.schema.ts
git commit -m "feat(payroll): add attendance lunch and bypass columns"
```

---

### Task 2: Lunch / bypass pure helpers (TDD)

**Files:**
- Create: `backend/src/admin/payroll/attendance-lunch.util.ts`
- Test: `backend/src/admin/payroll/attendance-lunch.util.spec.ts`

**Interfaces:**
- Produces:
  - `LUNCH_CONFIRM_HOUR_MANILA = 11`
  - `MAX_LUNCH_MINUTES = 60`
  - `PunchOutIntent = 'lunch' | 'end_of_day'`
  - `BypassAction = 'time_in' | 'lunch_out' | 'lunch_in' | 'time_out'`
  - `manilaHour(isoOrDate: string | Date): number` — hour 0–23 in Asia/Manila
  - `punchOutRequiresLunchConfirm(serverNow: string | Date, row: { timeIn, lunchOut, timeOut }): boolean`
  - `lunchMinutes(lunchOut, lunchIn, now?: Date): number | null`
  - `overbreakMinutes(lunchMins: number | null): number`
  - `assertBypassAllowed(action, row, at: Date): void` — throws Error with message if illegal

- [ ] **Step 1: Write failing tests**

```ts
describe('attendance-lunch.util', () => {
  // 2026-10-12T03:00:00.000Z == 11:00 Asia/Manila; 02:00:00.000Z == 10:00 Manila
  const after11 = '2026-10-12T03:00:00.000Z';
  const before11 = '2026-10-12T02:00:00.000Z';
  const timedIn = {
    timeIn: '2026-10-12T00:00:00.000Z',
    lunchOut: null as string | null,
    lunchIn: null as string | null,
    timeOut: null as string | null,
    workDate: '2026-10-12',
  };

  it('requires lunch confirm at/after 11:00 Manila when timed in with no lunch/out', () => {
    expect(punchOutRequiresLunchConfirm(after11, timedIn)).toBe(true);
  });

  it('does not require confirm before 11:00 Manila', () => {
    expect(punchOutRequiresLunchConfirm(before11, timedIn)).toBe(false);
  });

  it('computes overbreak as max(0, lunch - 60)', () => {
    expect(overbreakMinutes(75)).toBe(15);
    expect(overbreakMinutes(45)).toBe(0);
  });

  it('rejects bypass overwrite of filled time_out', () => {
    expect(() =>
      assertBypassAllowed(
        'time_out',
        { ...timedIn, timeOut: '2026-10-12T09:00:00.000Z' },
        new Date('2026-10-12T09:30:00.000Z'),
      ),
    ).toThrow(/already/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

`cd backend && npx jest src/admin/payroll/attendance-lunch.util.spec.ts --no-cache`

- [ ] **Step 3: Implement util**

```ts
export const LUNCH_CONFIRM_HOUR_MANILA = 11;
export const MAX_LUNCH_MINUTES = 60;

export function manilaHour(value: string | Date): number {
  const d = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: 'numeric', hour12: false,
  }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

export function punchOutRequiresLunchConfirm(
  serverNow: string | Date,
  row: { timeIn: string | null; lunchOut: string | null; timeOut: string | null },
): boolean {
  if (!row.timeIn || row.lunchOut || row.timeOut) return false;
  return manilaHour(serverNow) >= LUNCH_CONFIRM_HOUR_MANILA;
}

export function lunchMinutes(
  lunchOut: string | null,
  lunchIn: string | null,
  now = new Date(),
): number | null {
  if (!lunchOut) return null;
  const end = lunchIn ? new Date(lunchIn) : now;
  const ms = end.getTime() - new Date(lunchOut).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 60000);
}

export function overbreakMinutes(lunchMins: number | null): number {
  if (lunchMins == null) return 0;
  return Math.max(0, lunchMins - MAX_LUNCH_MINUTES);
}

// assertBypassAllowed: enforce fill-missing + order (time_in → lunch_out → lunch_in → time_out)
// and that `at` is on same Manila work_date as row.workDate when provided via caller
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add backend/src/admin/payroll/attendance-lunch.util.ts backend/src/admin/payroll/attendance-lunch.util.spec.ts
git commit -m "feat(payroll): add attendance lunch helper utilities"
```

---

### Task 3: Time clock status + employee lunch punches

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` (`TimeClockStatus` ~367, `getTimeClockStatus` ~3789, `timeIn` ~3940, `timeOut` ~4014, `timeOutForUser` ~4111)
- Modify: `backend/src/admin/employee-workspace/employee-workspace.controller.ts` (time-out body/field `intent`)
- Modify: `backend/src/admin/employee-workspace/employee-workspace.service.ts`

**Interfaces:**
- Consumes: helpers from Task 2
- Produces extended `TimeClockStatus`:

```ts
// add to TimeClockStatus:
lunchOut: string | null;
lunchIn: string | null;
onLunch: boolean;
canLunchIn: boolean;
punchOutRequiresIntent: boolean;
lunchMinutes: number | null;
overbreakMinutes: number;
isOverbreak: boolean;
```

- `canTimeIn`: true only for first time-in (`!timeIn`)
- `canLunchIn`: `!!lunchOut && !lunchIn && !timeOut`
- `canTimeOut`: timed in, not on open lunch wait… actually: can punch out when `timeIn && !timeOut && !onLunch` where `onLunch = !!lunchOut && !lunchIn`. While on lunch, `canTimeOut=false`, `canLunchIn=true`.
- `punchOutRequiresIntent`: from `punchOutRequiresLunchConfirm(serverNow, row)`
- `status`: add `'on_lunch'` when on lunch (optional; or keep `timed_in` + `onLunch` flag — prefer **`onLunch` flag** and keep status `timed_in` to minimize FE churn)

**Employee lunch in:** When `canLunchIn`, `timeIn` / `timeInForUser` writes `lunch_in` + selfie (not a second morning time-in). Reject normal time-in if already timed in and not on lunch.

**Employee time out:** Signature becomes:

```ts
async timeOut(
  usernameRaw: string,
  selfie: Express.Multer.File,
  intent?: 'lunch' | 'end_of_day' | null,
): Promise<TimeClockStatus>
```

- If `punchOutRequiresIntent` and intent missing → `BadRequestException('Choose lunch or end of day.')`
- If intent `lunch` → set `lunch_out` + selfie; do **not** sync OT
- If intent `end_of_day` or no confirm needed → set `time_out` as today; sync OT

Controller: read `intent` from multipart field `intent` (string).

- [ ] **Step 1: Extend status mapping in `getTimeClockStatus`** (all early-return empty shapes get null lunch fields / zeros)

- [ ] **Step 2: Implement lunch-in branch in `timeIn` / `timeInForUser`**

- [ ] **Step 3: Implement intent branch in `timeOut` / `timeOutForUser`**

- [ ] **Step 4: Wire workspace controller + service**

- [ ] **Step 5: Focused tests** — add `payroll-attendance-lunch.service.spec.ts` mocking DB for: confirm required, lunch out, lunch in, final out; or extend an existing payroll time-clock spec if present.

Run: `cd backend && npx jest src/admin/payroll/attendance-lunch.util.spec.ts src/admin/payroll/payroll-attendance-lunch.service.spec.ts --no-cache`  
(Create the service spec if missing; keep it focused with mocked `databaseService.query`.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts backend/src/admin/employee-workspace/employee-workspace.controller.ts backend/src/admin/employee-workspace/employee-workspace.service.ts backend/src/admin/payroll/payroll-attendance-lunch.service.spec.ts
git commit -m "feat(payroll): employee lunch out/in on time clock"
```

---

### Task 4: Admin bypass API

**Files:**
- Modify: `backend/src/admin/payroll/payroll.controller.ts`
- Modify: `backend/src/admin/payroll/payroll.service.ts` — add `bypassAttendancePunch(...)`
- DTO: inline body type or small class next to other payroll DTOs in controller file

**Interfaces:**
- Consumes: Task 2 `assertBypassAllowed`, admin profile image from `pcmazing_admin_users.profile_image_url`
- Produces: updated attendance row / same shape as list item fields needed by FE

```ts
// POST /admin/payroll/attendance/bypass
// @RequirePermissions('payroll.edit')
{
  userId: number;
  userSource: 'tblusers' | 'pcmazing_admin_users';
  workDate: string; // YYYY-MM-DD
  action: 'time_in' | 'lunch_out' | 'lunch_in' | 'time_out';
  at?: string | null; // ISO; default NOW()
}
```

**Behavior:**
1. `ensureReady()`; resolve employee; require `payrollEnabled`
2. Load admin by `req.user.sub`; if `!profile_image_url` → `BadRequestException('Set your profile photo before bypassing punches.')`
3. Load or create attendance row for `(userId, userSource, workDate)` (create empty row on first bypass time_in)
4. `assertBypassAllowed(action, row, atDate)` + Manila work_date match for `at`
5. UPDATE the single slot + corresponding selfie URL = admin profile URL + `*_bypassed_by_admin_id = adminId`
6. If action `time_out`, call `syncOvertimeAfterTimeOut` + `clearPendingAdjustment`
7. Return mapped attendance fields for that row (include lunch/overbreak)

Controller pattern (mirror `reviewOvertime`):

```ts
@Post('attendance/bypass')
@RequirePermissions('payroll.edit')
bypassAttendance(
  @Body() body: BypassAttendanceDto,
  @Req() req: Request & { user?: AdminJwtPayload },
) {
  const adminId = Number(req.user?.sub);
  return this.payrollService.bypassAttendancePunch(body, adminId).then((data) => ({
    success: true,
    data,
  }));
}
```

- [ ] **Step 1: Add service method + controller + DTO validation** (`class-validator` if used elsewhere; else manual checks)

- [ ] **Step 2: Tests** — bypass rejects no photo; rejects overwrite; lunch_out sets fields; custom `at` stored

- [ ] **Step 3: Commit**

```bash
git add backend/src/admin/payroll/payroll.controller.ts backend/src/admin/payroll/payroll.service.ts
git commit -m "feat(payroll): admin attendance punch bypass API"
```

---

### Task 5: listAttendance + FE API types

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `AttendanceRecord` + `listAttendance` SELECT/map (~90, ~1527)
- Modify: `frontend/src/app/admin/services/admin-api.service.ts` — `PayrollAttendanceItem`, `bypassPayrollAttendance`, extend time-clock client if types live here or in workspace API

**Interfaces:**
- Add to `AttendanceRecord` / `PayrollAttendanceItem`:

```ts
lunchOut: string | null;
lunchIn: string | null;
lunchOutSelfieUrl: string | null;
lunchInSelfieUrl: string | null;
lunchMinutes: number | null;
overbreakMinutes: number;
isOverbreak: boolean;
timeInBypassedByAdminId: number | null;
lunchOutBypassedByAdminId: number | null;
lunchInBypassedByAdminId: number | null;
timeOutBypassedByAdminId: number | null;
// nextBypassActions?: BypassAction[]  // optional helper for UI
```

`hoursWorked` still `computeHours(time_in, time_out)`.

Status mapping: if `onLunch` → keep `timed_in` (or introduce `on_lunch` in FE union — prefer keep `timed_in` + `lunchOut && !lunchIn` for badge).

```ts
// admin-api.service.ts
bypassPayrollAttendance(body: {
  userId: number;
  userSource: 'tblusers' | 'pcmazing_admin_users';
  workDate: string;
  action: 'time_in' | 'lunch_out' | 'lunch_in' | 'time_out';
  at?: string | null;
}) {
  return this.http.post<{ success: boolean; data: PayrollAttendanceItem }>(
    `${this.baseUrl}/payroll/attendance/bypass`,
    body,
  );
}
```

Wire workspace time-out FormData to append `intent` when provided (find existing time-clock API helper used by `portal-time-clock.component.ts`).

- [ ] **Step 1: Backend list mapping**

- [ ] **Step 2: Frontend types + HTTP helpers**

- [ ] **Step 3: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts frontend/src/app/admin/services/admin-api.service.ts
git commit -m "feat(payroll): expose lunch and bypass fields on attendance"
```

---

### Task 6: Portal Time Clock UI (lunch confirm + lunch in)

**Files:**
- Modify: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts`
- Modify: `frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html`

**Interfaces:**
- Consumes: status `punchOutRequiresIntent`, `canLunchIn`, lunch fields
- Produces: modal copy exactly **Going to lunch?** and **End of day** (button labels); send `intent`

- [ ] **Step 1: On Time out click**

If `current.punchOutRequiresIntent`, open confirm modal (reuse existing app confirm/modal pattern on this page if any; else small inline dialog). Do not punch until choice.

- [ ] **Step 2: Lunch in button**

When `canLunchIn`, show **Lunch in** (selfie required) calling time-in endpoint (server treats as lunch in).

- [ ] **Step 3: Display** lunch out/in times + overbreak hint when `isOverbreak` or live `lunchMinutes > 60`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.ts frontend/src/app/admin/components/portal-time-clock/portal-time-clock.component.html
git commit -m "feat(admin): lunch confirm and lunch-in on time clock"
```

---

### Task 7: Payroll → Attendance UI + bypass dialog

**Files:**
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html` (attendance table ~102–160)
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.ts`

**UI:**
- Columns: Time in | Lunch out | Lunch in | Time out | Selfies (4 thumbs) | Hours | Lunch | Overbreak badge | Location | OT | Status | Actions
- Lunch cell: `formatMinutes(item.lunchMinutes)` or `—`
- Overbreak: badge when `item.isOverbreak` showing `+Xm`
- Actions: for each missing legal action, button **Bypass…** (compute client-side from null slots + order, or use server `nextBypassActions` if added in Task 5)
- **Bypass punch** (top of tab): pick payroll-enabled employee (reuse tools employee search pattern) for rows that do not exist yet → opens same dialog with `time_in`
- Dialog fields: action label, optional checkbox “Use custom time” + datetime-local, note that admin profile photo will be used; Confirm calls `bypassPayrollAttendance`
- After success: `loadAttendance()`

Lunch vs end of day for admin bypass out: if action would be punch-out and Manila now ≥ 11:00 (or custom `at` ≥ 11:00), dialog asks Lunch vs End of day → maps to `lunch_out` vs `time_out`.

- [ ] **Step 1: Table columns + badges**

- [ ] **Step 2: Bypass dialog + API call**

- [ ] **Step 3: Manual check** (when servers up) against Verification in spec

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/admin/pages/payroll/payroll-page.component.html frontend/src/app/admin/pages/payroll/payroll-page.component.ts frontend/src/app/admin/services/admin-api.service.ts
git commit -m "feat(admin): attendance bypass and lunch columns"
```

---

### Task 8: Verification pass

- [ ] **Step 1:** `cd backend && npx jest src/admin/payroll/attendance-lunch.util.spec.ts src/admin/payroll/payroll-attendance-lunch.service.spec.ts --no-cache` — PASS

- [ ] **Step 2:** `cd frontend && npx ng build --configuration=development` — success

- [ ] **Step 3:** Spec checklist in `docs/superpowers/specs/2026-10-12-attendance-bypass-lunch-design.md` Verification — mark Pass/Partial for live UI

- [ ] **Step 4:** Apply migration `077` on staging/dev DB before manual test

- [ ] **Step 5:** Optional commit `docs: mark attendance bypass lunch plan complete` if checkboxes updated

---

## Spec coverage (self-review)

| Spec item | Task |
| --- | --- |
| Migration lunch + bypass columns | 1 |
| Confirm ≥11:00 / overbreak math | 2 |
| Employee lunch out/in + status | 3 |
| Admin bypass API + photo + fill-missing | 4 |
| listAttendance fields | 5 |
| Time Clock UI confirm | 6 |
| Attendance UI + bypass dialog | 7 |
| Gross hours / no pay change | 3–5 (no dayPayUnits changes) |
| Verification | 8 |
