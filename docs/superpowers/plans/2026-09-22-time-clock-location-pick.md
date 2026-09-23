# Time-Clock Office / WFH Pick Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Employee picks Office or WFH at time-in; store on punch; period/payslip pay follows punch type (schedule is default + banner only).

**Architecture:** Extend time-in multipart with required `workLocationType`. `resolvePunchLocation` uses the client pick (not schedule). Pay builders read `attendance.work_location_type` instead of `resolveExpectedLocation` for rate selection. Stop setting `locationMismatch` for Off / schedule divergence.

**Tech Stack:** NestJS time-clock + Angular time-clock page; existing `work_location_type` column.

**Spec:** `docs/superpowers/specs/2026-09-22-time-clock-location-pick-design.md`

## Global Constraints

- Pick controls tagging **and** pay.
- `workLocationType` on time-in: required `office` | `wfh` only (never `off`).
- Schedule pre-selects when Office/WFH; Off → no pre-select (must choose).
- Soft Off warning; do **not** set `locationMismatch` for Off or schedule≠pick.
- WFH pick → GPS + optional label (existing soft GPS denial).
- Time-out: no picker.
- Off-day approval out of scope; Off + pick is paid this slice.
- PowerShell: use `;` not `&&`.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/.../payroll.service.ts` | timeIn + resolvePunchLocation; pay from punch type; clear mismatch |
| `backend/.../time-clock.controller.ts` | Accept `workLocationType` body field |
| `frontend/.../time-clock-api.service.ts` | Pass `workLocationType` in FormData |
| `frontend/.../time-clock-page.component.ts` | Picker state + validation |
| `frontend/.../time-clock-page.component.html` | Office / WFH control UI |

---

### Task 1: Backend time-in accepts pick + stores it

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts`
- Modify: `backend/src/admin/payroll/time-clock.controller.ts`

**Interfaces:**
- `TimeClockLocationInput` gains optional `workLocationType?: 'office' | 'wfh' | null` **or** pass pick as separate arg to `timeIn` — prefer separate required arg:
  - `timeIn(username, selfie, workLocationType: 'office' | 'wfh', location?: TimeClockLocationInput | null)`
- `resolvePunchLocation(picked: 'office' | 'wfh', location?)` — **no longer takes expected schedule for type/mismatch**

- [ ] **Step 1: Update `resolvePunchLocation`**

```typescript
private resolvePunchLocation(
  picked: 'office' | 'wfh',
  location?: TimeClockLocationInput | null,
): {
  workLocationType: 'office' | 'wfh';
  locationLat: number | null;
  locationLng: number | null;
  locationLabel: string | null;
  locationMismatch: boolean;
} {
  const label = location?.locationLabel?.trim() || null;
  const lat = this.toNullableNumber(location?.locationLat ?? null);
  const lng = this.toNullableNumber(location?.locationLng ?? null);
  const storeCoords = picked === 'wfh';

  return {
    workLocationType: picked,
    locationLat: storeCoords ? lat : null,
    locationLng: storeCoords ? lng : null,
    locationLabel: storeCoords ? (label ? label.slice(0, 200) : null) : null,
    locationMismatch: false,
  };
}
```

- [ ] **Step 2: Update `timeIn` signature and call**

- Parse/validate pick: only `office` | `wfh`; else `BadRequestException('Choose Office or Work from home before time in.')`.
- Call `resolvePunchLocation(picked, location)`.
- Keep INSERT columns as today.

- [ ] **Step 3: Status empty / ready mismatch**

In `getTimeClockStatus` and empty status in controller: set `locationMismatch: false` always (remove `expectedLocation === 'off'` mismatch). Keep Off soft message text when `expectedLocation === 'off'`.

- [ ] **Step 4: Controller**

```typescript
timeIn(
  @Body('username') username: string,
  @Body('workLocationType') workLocationType?: string,
  @Body('locationLat') locationLat?: string,
  @Body('locationLng') locationLng?: string,
  @Body('locationLabel') locationLabel?: string,
  @UploadedFile() selfie?: Express.Multer.File,
) {
  // validate username + selfie as today
  const picked = (workLocationType ?? '').trim().toLowerCase();
  if (picked !== 'office' && picked !== 'wfh') {
    throw new BadRequestException('Choose Office or Work from home before time in.');
  }
  return this.payrollService
    .timeIn(value, selfie, picked, this.parseLocation(locationLat, locationLng, locationLabel))
    .then(...)
}
```

- [ ] **Step 5: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts backend/src/admin/payroll/time-clock.controller.ts
git commit -m "Accept Office/WFH pick on time-in and store on attendance."
```

---

### Task 2: Pay from punched location type

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts` — `buildPayslipDaysAndTotals`, `buildPeriodRow`, and punch SELECTs feeding them

**Interfaces:**
- Punch rows must include `work_location_type: string | null`
- For a punched day:  
  `locationType = normalizeStoredLocationType(row.work_location_type)`  
  - if `null` or `'off'` → unpaid (legacy / invalid)  
  - if `'office' | 'wfh'` → `pickSalaryAmountForLocation(locationType, ...)`
- Do **not** use `resolveExpectedLocation` for day pay / OT unpaid gates anymore.
- Fixed monthly: do **not** zero units just because schedule is Off; zero only when punch type is null/`off`.
- Day label suffix: `locationPayLabelSuffix(locationType ?? 'off')` when punched; for null punch type use Off unpaid suffix.

- [ ] **Step 1: Ensure punch queries select `work_location_type`**

Find all queries that load punches for `buildPayslipDaysAndTotals` / `buildPeriodRow` / generate preview and add `work_location_type` to SELECT + TypeScript row types.

- [ ] **Step 2: Replace schedule-based expected with punch type in both builders**

Example for payslip day branch:

```typescript
const punchedType = this.normalizeStoredLocationType(row.work_location_type);
// punchedType: 'office' | 'wfh' | null  (treat 'off' as null unpaid via normalize or explicit)

let units = this.dayPayUnits(hours, undertimeGraceMinutes);
// ...
if (usesFixedSalary && fixedRates) {
  if (punchedType == null || punchedType === 'off') {
    units = 0;
  }
  // dayPay / OT using fixed rates; OT pay 0 when unpaid type
} else {
  const amount =
    punchedType == null || punchedType === 'off'
      ? null
      : pickSalaryAmountForLocation(punchedType, input.salaryAmount, input.wfhSalary);
  // same as before when amount null → units 0, dayPay 0, OT pay 0
}
```

Same pattern in `buildPeriodRow`.

- [ ] **Step 3: Typecheck**

Run: `cd backend; npx tsc --noEmit -p tsconfig.build.json`  
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add backend/src/admin/payroll/payroll.service.ts
git commit -m "Use punched work location for Office vs WFH day pay."
```

---

### Task 3: Time-clock frontend picker

**Files:**
- Modify: `frontend/src/app/core/services/time-clock-api.service.ts`
- Modify: `frontend/src/app/website/pages/time-clock/time-clock-page.component.ts`
- Modify: `frontend/src/app/website/pages/time-clock/time-clock-page.component.html`

- [ ] **Step 1: API**

```typescript
timeIn(
  username: string,
  selfie: Blob,
  workLocationType: 'office' | 'wfh',
  location?: TimeClockLocationPayload | null,
) {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('selfie', selfie, 'time-in-selfie.jpg');
  formData.append('workLocationType', workLocationType);
  this.appendLocation(formData, location);
  // post as today
}
```

- [ ] **Step 2: Component state**

- `pickedLocation = signal<'office' | 'wfh' | null>(null)`
- On successful `lookup` / status ready:
  - if `expectedLocation === 'office' | 'wfh'` → set `pickedLocation` to that
  - if `expectedLocation === 'off'` or missing → set `null`
- When `pickedLocation() === 'wfh'` and can time in → request geolocation (reuse existing)
- `punch('in')`: if `pickedLocation()` is null → error `Choose Office or Work from home before time in.`; pass pick to API; only attach GPS payload when pick is `wfh`

- [ ] **Step 3: Template**

When `current.canTimeIn`, above selfie / Time In button:

```html
<div class="mt-3 ...">
  <p class="text-xs font-bold uppercase ...">Working from</p>
  <div class="mt-2 grid grid-cols-2 gap-2">
    <button type="button" ... [class]="pickedLocation() === 'office' ? 'selected' : ''" (click)="pickedLocation.set('office')">Office</button>
    <button type="button" ... [class]="pickedLocation() === 'wfh' ? 'selected' : ''" (click)="pickedLocation.set('wfh'); requestGeolocation()">WFH</button>
  </div>
  @if (current.expectedLocation === 'off') {
    <p class="mt-2 text-xs text-amber-800">Scheduled day off — choose Office or WFH if you still need to clock in.</p>
  }
</div>
```

Show existing WFH GPS/label block when `pickedLocation() === 'wfh'` (not only when `expectedLocation === 'wfh'`).

Disable Time In when `!pickedLocation()` or `!selfieBlob()`.

Match existing Tailwind/styles on the page (no new design system).

- [ ] **Step 4: Frontend build**

Run: `cd frontend; npx ng build --configuration=development`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/core/services/time-clock-api.service.ts frontend/src/app/website/pages/time-clock/time-clock-page.component.ts frontend/src/app/website/pages/time-clock/time-clock-page.component.html
git commit -m "Add Office/WFH picker on time clock before time in."
```

---

### Task 4: Verify

- [ ] **Step 1: Automated**

```
cd backend; npx tsc --noEmit -p tsconfig.build.json
cd frontend; npx ng build --configuration=development
```

- [ ] **Step 2: Manual (when Nest running)**

1. Schedule Office → picker defaults Office; pick WFH → GPS; payslip WFH rate.  
2. Schedule WFH → default WFH.  
3. Schedule Off → empty pick; warning; must choose; paid; mismatch false.  
4. Time In without pick on Off → blocked.

- [ ] **Step 3: Mark spec Implemented** in `docs/superpowers/specs/2026-09-22-time-clock-location-pick-design.md` and commit.

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Required Office/WFH pick UI | Task 3 |
| Default from schedule; Off empty | Task 3 |
| POST `workLocationType` | Task 1 |
| Store on `work_location_type` | Task 1 |
| WFH GPS path on pick | Task 1 + 3 |
| No locationMismatch | Task 1 |
| Pay from punch type | Task 2 |
| Soft Off warning | Task 3 |
| Off approval | Out of scope |
