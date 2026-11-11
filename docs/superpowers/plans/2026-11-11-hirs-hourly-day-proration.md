# HIRS Hourly Day Proration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pay daily-rate employees for hours worked (daily ÷ 8 × paid hours) on early outs / short days, replacing half-day buckets while keeping undertime grace, OT approval, and fixed-monthly behavior.

**Architecture:** Extract pure hour/unit helpers; wire them into `dayPayUnits` for the daily-rate path only; keep legacy 9h/half-day units for fixed monthly; switch OT hourly divisor to 8; update HIRS copy.

**Tech Stack:** NestJS + Jest util specs, Angular payroll page copy, existing payslip generation in `payroll.service.ts`.

**Spec:** `docs/superpowers/specs/2026-11-11-hirs-hourly-day-proration-design.md`

## Global Constraints

- Standard paid work hours = **8**; assumed break = **1h** when elapsed ≥ **5h**.
- Continuous proration replaces half-day buckets for **daily-rate** employees only.
- Undertime grace still bumps to full day when paid hours are within grace of 8.
- No time out → 0 pay for that day.
- OT eligibility stays **elapsed > 9**; OT pay stays **approval-gated**.
- OT hourly rate = **daily ÷ 8**.
- Fixed monthly path must keep **legacy** day units (9h full / 4h half) — no hourly proration.
- No DB migration.
- Do not change late / loan / commission / manual deduction rules.

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/admin/payroll/day-pay-hours.util.ts` | Pure: paid hours + day units + constants + label helper |
| `backend/src/admin/payroll/day-pay-hours.util.spec.ts` | Unit tests for formula |
| `backend/src/admin/payroll/payroll.service.ts` | Use helpers in day loops; OT hourly ÷ 8; fixed monthly legacy units |
| `frontend/src/app/admin/pages/payroll/payroll-page.component.html` | Replace half-day / 9h copy |

---

### Task 1: Day-pay hours helpers (TDD)

**Files:**
- Create: `backend/src/admin/payroll/day-pay-hours.util.ts`
- Create: `backend/src/admin/payroll/day-pay-hours.util.spec.ts`

**Interfaces:**
- Produces:
  - `STANDARD_WORK_HOURS = 8`
  - `ASSUMED_BREAK_HOURS = 1`
  - `BREAK_AFTER_ELAPSED_HOURS = 5`
  - `OT_ELAPSED_THRESHOLD_HOURS = 9`
  - `HALF_DAY_MIN_HOURS = 4` (legacy fixed-monthly only)
  - `LEGACY_FULL_DAY_ELAPSED_HOURS = 9` (legacy fixed-monthly only)
  - `toPaidHours(elapsedHours: number): number`
  - `dayPayUnitsHourly(paidHours: number, undertimeGraceMinutes: number): number` — returns 0..1
  - `dayPayUnitsFromElapsed(elapsedHours: number | null | undefined, undertimeGraceMinutes: number): number` — null/invalid → 0; else `dayPayUnitsHourly(toPaidHours(elapsed), grace)`
  - `dayPayUnitsLegacy(elapsedHours: number | null | undefined, undertimeGraceMinutes: number): number` — old 9h/half-day rules
  - `formatDayPayLabel(units: number, elapsedHours: number | null, paidHours: number | null, undertimeGraceMinutes: number): string`

- [ ] **Step 1: Write the failing tests**

```typescript
import {
  toPaidHours,
  dayPayUnitsHourly,
  dayPayUnitsFromElapsed,
  dayPayUnitsLegacy,
  formatDayPayLabel,
  STANDARD_WORK_HOURS,
} from './day-pay-hours.util';

describe('toPaidHours', () => {
  it('does not subtract break under 5 elapsed hours', () => {
    expect(toPaidHours(3)).toBe(3);
    expect(toPaidHours(4.99)).toBe(4.99);
  });

  it('subtracts 1h break at or above 5 elapsed hours', () => {
    expect(toPaidHours(5)).toBe(4);
    expect(toPaidHours(6)).toBe(5);
    expect(toPaidHours(9)).toBe(8);
  });
});

describe('dayPayUnitsHourly', () => {
  it('prorates by 8 paid hours', () => {
    expect(dayPayUnitsHourly(5, 30)).toBeCloseTo(5 / 8, 5);
    expect(dayPayUnitsHourly(8, 30)).toBe(1);
  });

  it('bumps to full day within undertime grace of 8', () => {
    // 7.6 paid hours, 30 min grace → threshold 7.5 → full day
    expect(dayPayUnitsHourly(7.6, 30)).toBe(1);
  });

  it('caps at 1 even if paid hours exceed 8', () => {
    expect(dayPayUnitsHourly(10, 30)).toBe(1);
  });
});

describe('dayPayUnitsFromElapsed', () => {
  it('maps 6 elapsed → 5 paid → 0.625 units', () => {
    expect(dayPayUnitsFromElapsed(6, 30)).toBeCloseTo(0.625, 5);
  });

  it('returns 0 for null / invalid', () => {
    expect(dayPayUnitsFromElapsed(null, 30)).toBe(0);
    expect(dayPayUnitsFromElapsed(undefined, 30)).toBe(0);
  });
});

describe('dayPayUnitsLegacy', () => {
  it('keeps half-day and full-day buckets', () => {
    expect(dayPayUnitsLegacy(3, 30)).toBe(0);
    expect(dayPayUnitsLegacy(5, 30)).toBe(0.5);
    expect(dayPayUnitsLegacy(9, 30)).toBe(1);
  });
});

describe('formatDayPayLabel', () => {
  it('labels incomplete, full, undertime, partial, unpaid', () => {
    expect(formatDayPayLabel(0, null, null, 30)).toBe('Incomplete');
    expect(formatDayPayLabel(1, 9, 8, 30)).toBe('Full day');
    expect(formatDayPayLabel(1, 8.67, 7.67, 30)).toMatch(/Undertime \(paid/);
    expect(formatDayPayLabel(0.625, 6, 5, 30)).toBe('Partial (5h)');
    expect(formatDayPayLabel(0, 0, 0, 30)).toBe('Unpaid');
  });
});

describe('constants', () => {
  it('locks standard work hours at 8', () => {
    expect(STANDARD_WORK_HOURS).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/admin/payroll/day-pay-hours.util.spec.ts --verbose`  
Expected: FAIL (module / exports missing)

- [ ] **Step 3: Implement helpers**

```typescript
export const STANDARD_WORK_HOURS = 8;
export const ASSUMED_BREAK_HOURS = 1;
export const BREAK_AFTER_ELAPSED_HOURS = 5;
export const OT_ELAPSED_THRESHOLD_HOURS = 9;
export const HALF_DAY_MIN_HOURS = 4;
export const LEGACY_FULL_DAY_ELAPSED_HOURS = 9;

function normalizeGraceMinutes(value: number): number {
  if (!Number.isFinite(value)) return 30;
  return Math.min(90, Math.max(0, Math.round(value)));
}

export function toPaidHours(elapsedHours: number): number {
  if (!Number.isFinite(elapsedHours) || elapsedHours <= 0) return 0;
  if (elapsedHours < BREAK_AFTER_ELAPSED_HOURS) return elapsedHours;
  return Math.max(0, elapsedHours - ASSUMED_BREAK_HOURS);
}

export function dayPayUnitsHourly(
  paidHours: number,
  undertimeGraceMinutes: number,
): number {
  if (!Number.isFinite(paidHours) || paidHours <= 0) return 0;
  const capped = Math.min(paidHours, STANDARD_WORK_HOURS);
  const graceHours = normalizeGraceMinutes(undertimeGraceMinutes) / 60;
  const fullThreshold = Math.max(0, STANDARD_WORK_HOURS - graceHours);
  if (capped + 0.0001 >= fullThreshold) return 1;
  return Math.round((capped / STANDARD_WORK_HOURS) * 1_000_000) / 1_000_000;
}

export function dayPayUnitsFromElapsed(
  elapsedHours: number | null | undefined,
  undertimeGraceMinutes: number,
): number {
  if (elapsedHours == null || !Number.isFinite(elapsedHours) || elapsedHours <= 0) {
    return 0;
  }
  return dayPayUnitsHourly(toPaidHours(elapsedHours), undertimeGraceMinutes);
}

/** Legacy buckets for fixed-monthly employees only. */
export function dayPayUnitsLegacy(
  elapsedHours: number | null | undefined,
  undertimeGraceMinutes: number,
): number {
  if (elapsedHours == null || !Number.isFinite(elapsedHours) || elapsedHours <= 0) {
    return 0;
  }
  const graceHours = normalizeGraceMinutes(undertimeGraceMinutes) / 60;
  const fullDayThreshold = Math.max(
    HALF_DAY_MIN_HOURS,
    LEGACY_FULL_DAY_ELAPSED_HOURS - graceHours,
  );
  if (elapsedHours + 0.0001 >= fullDayThreshold) return 1;
  if (elapsedHours >= HALF_DAY_MIN_HOURS) return 0.5;
  return 0;
}

export function formatDayPayLabel(
  units: number,
  elapsedHours: number | null,
  paidHours: number | null,
  undertimeGraceMinutes: number,
): string {
  if (elapsedHours == null) return 'Incomplete';
  const grace = normalizeGraceMinutes(undertimeGraceMinutes);
  if (units >= 1) {
    const paid = paidHours ?? toPaidHours(elapsedHours);
    if (paid + 0.0001 < STANDARD_WORK_HOURS) {
      return `Undertime (paid, ≤${grace}m)`;
    }
    return 'Full day';
  }
  if (units > 0) {
    const paid = paidHours ?? toPaidHours(elapsedHours);
    const rounded = Math.round(paid * 100) / 100;
    return `Partial (${rounded}h)`;
  }
  return 'Unpaid';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/admin/payroll/day-pay-hours.util.spec.ts --verbose`  
Expected: all PASS

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add backend/src/admin/payroll/day-pay-hours.util.ts backend/src/admin/payroll/day-pay-hours.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(payroll): add hourly day-pay hour helpers

EOF
)"
```

---

### Task 2: Wire helpers into payroll.service day pay + OT hourly

**Files:**
- Modify: `backend/src/admin/payroll/payroll.service.ts`

**Interfaces:**
- Consumes: helpers from Task 1
- Behavior:
  - Daily-rate path: `dayPayUnitsFromElapsed(hours, grace)`
  - Fixed-monthly path: `dayPayUnitsLegacy(hours, grace)`
  - Labels: `formatDayPayLabel(units, hours, hours == null ? null : toPaidHours(hours), grace)`
  - `resolvePayRates` / fixed hourly: divide by `STANDARD_WORK_HOURS` (8), not 9
  - OT request eligibility messages / thresholds: keep `OT_ELAPSED_THRESHOLD_HOURS` (9) for elapsed comparison
  - `regularHours` aggregation may still cap display with 9 elapsed or switch to `min(toPaidHours(hours), 8)` — prefer `min(toPaidHours(hours), STANDARD_WORK_HOURS)` for daily-rate consistency; fixed monthly may keep `min(hours, 9)`

- [ ] **Step 1: Import helpers and replace local FULL_DAY_HOURS / HALF_DAY_MIN_HOURS usages carefully**

At top of `payroll.service.ts`, import:

```typescript
import {
  STANDARD_WORK_HOURS,
  OT_ELAPSED_THRESHOLD_HOURS,
  LEGACY_FULL_DAY_ELAPSED_HOURS,
  toPaidHours,
  dayPayUnitsFromElapsed,
  dayPayUnitsLegacy,
  formatDayPayLabel,
} from './day-pay-hours.util';
```

Remove private constants `FULL_DAY_HOURS` / `HALF_DAY_MIN_HOURS` only after every reference is updated. Keep a local alias during migration if needed:

```typescript
/** Elapsed hours before OT may be requested (approval still required). */
const OT_THRESHOLD = OT_ELAPSED_THRESHOLD_HOURS;
```

- [ ] **Step 2: Replace `dayPayUnits` private method**

```typescript
private dayPayUnits(
  hours: number | null | undefined,
  undertimeGraceMinutes = 30,
  mode: 'hourly' | 'legacy' = 'hourly',
): number {
  return mode === 'legacy'
    ? dayPayUnitsLegacy(hours, undertimeGraceMinutes)
    : dayPayUnitsFromElapsed(hours, undertimeGraceMinutes);
}
```

- [ ] **Step 3: In both day loops (`buildPeriodRow` and the detailed day builder ~line 4360), choose mode**

```typescript
const unitMode: 'hourly' | 'legacy' = usesFixedSalary ? 'legacy' : 'hourly';
let units = this.dayPayUnits(hours, undertimeGraceMinutes, unitMode);
```

And labels:

```typescript
dayType:
  formatDayPayLabel(
    units,
    hours,
    hours == null ? null : toPaidHours(hours),
    undertimeGraceMinutes,
  ) + locationPayLabelSuffix(punchedType ?? 'off'),
```

Delete or thin the private `dayPayLabel` method so it delegates to `formatDayPayLabel` (avoid divergent strings).

- [ ] **Step 4: OT hourly divisor → 8; OT eligibility stays 9 elapsed**

In `resolvePayRates` and fixed-salary hourly construction, change:

```typescript
hourlyRate: amount / STANDARD_WORK_HOURS
// and
hourlyRate: dailyRate / STANDARD_WORK_HOURS
// and fixed:
hourlyRate: fixedMonthly / 22 / STANDARD_WORK_HOURS
```

Everywhere OT is *requested* or validated against worked span, keep:

```typescript
hours > OT_ELAPSED_THRESHOLD_HOURS
// error text: `... more than ${OT_ELAPSED_THRESHOLD_HOURS} hours.`
```

Weekly hour-base helpers that intentionally use “hours per workday elapsed” may keep `LEGACY_FULL_DAY_ELAPSED_HOURS` (9) — do **not** silently change work-week expected hours in this task unless a call site is clearly “paid work hours”; prefer leaving week-base math on 9 elapsed to avoid scope creep.

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd backend
npx jest src/admin/payroll/day-pay-hours.util.spec.ts src/admin/payroll/payroll-payslip-generation.service.spec.ts src/admin/payroll/payroll-period-summary.service.spec.ts --verbose
```

Expected: PASS (update any fixtures that assumed half-day 0.5 units for daily-rate scenarios if they fail — adjust expected `basePay` / units to hourly math).

- [ ] **Step 6: Manual sanity (optional if API up)**

Generate/preview a payslip for a daily-rate employee with a 6h elapsed day → day pay = `daily × 5/8`.

- [ ] **Step 7: Commit** (only if user asked)

```bash
git add backend/src/admin/payroll/payroll.service.ts
git commit -m "$(cat <<'EOF'
feat(payroll): prorate daily-rate day pay by paid hours

EOF
)"
```

---

### Task 3: Update HIRS payroll UI copy

**Files:**
- Modify: `frontend/src/app/admin/pages/payroll/payroll-page.component.html`

**Interfaces:**
- Consumes: none (copy only)
- Produces: accurate user-facing description of the new rule

- [ ] **Step 1: Replace the header blurb (~line 8)**

From half-day / 9h wording to:

```html
Weekly and Semi-Monthly Amount is a daily rate: 8 paid working hours (+1h break) = full day.
Owner-agreed undertime (default 30 min early) still pays a full day. Shorter days pay for hours worked (daily ÷ 8).
Overtime over 9 clocked hours needs employee request + admin approval.
```

- [ ] **Step 2: Update undertime help (~line 750) if it still implies half-day**

Keep grace meaning; ensure it does not say half day. Example:

```html
Undertime grace ({{ undertimeGraceMinutes() }} min) still pays a full day if paid hours are just under 8 for an owner-approved early out.
```

- [ ] **Step 3: Update adjustment approval hint (~line 1325) similarly**

```html
Approving writes that time onto the attendance record. If paid hours still fall within undertime grace of a full 8-hour day, payroll pays a full day.
```

- [ ] **Step 4: Visual check**

Open HIRS → Payroll tab; confirm the three strings read correctly on desktop.

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add frontend/src/app/admin/pages/payroll/payroll-page.component.html
git commit -m "$(cat <<'EOF'
docs(payroll): describe hourly day proration in HIRS copy

EOF
)"
```

---

### Task 4: End-to-end verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Unit suite green**

Run: `cd backend && npx jest src/admin/payroll/day-pay-hours.util.spec.ts --verbose`  
Expected: PASS

- [ ] **Step 2: Related payroll specs green**

Run:

```bash
cd backend
npx jest src/admin/payroll/payroll-payslip-generation.service.spec.ts src/admin/payroll/payroll-period-summary.service.spec.ts src/admin/payroll/payroll-ledger.util.spec.ts --verbose
```

Expected: PASS

- [ ] **Step 3: Spec acceptance matrix**

| Case | Expect |
|------|--------|
| Daily ₱800, 09:00–15:00 | Day pay ₱500, label `Partial (5h)` |
| Daily ₱800, 09:00–18:00 | ₱800, `Full day` |
| Daily within grace of 8 paid hours | ₱800, `Undertime (paid, …)` |
| Time in only | ₱0, `Incomplete` |
| Unapproved OT after 9 elapsed | No OT pay added |
| Approved OT | OT uses hourly = daily/8 × 1.25 |
| Fixed monthly employee early out | Legacy half/full buckets (not hourly) |

- [ ] **Step 4: Mark spec status**

In `docs/superpowers/specs/2026-11-11-hirs-hourly-day-proration-design.md`, set **Status:** to `Implemented` after the checklist passes.

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Paid hours break rule (5h / −1h) | Task 1 |
| Units = paid/8 + grace | Task 1–2 |
| Replace half-day for daily-rate | Task 2 |
| Fixed monthly unchanged (legacy) | Task 2 |
| No time out → 0 | Task 1–2 |
| OT after 9 elapsed + approval | Task 2 |
| OT hourly daily÷8 | Task 2 |
| No migration | (implicit) |
| UI copy | Task 3 |
| Tests / examples | Task 1, 4 |

No placeholders left; helper names are consistent across tasks.
