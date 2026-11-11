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
  if (
    elapsedHours == null ||
    !Number.isFinite(elapsedHours) ||
    elapsedHours <= 0
  ) {
    return 0;
  }
  return dayPayUnitsHourly(toPaidHours(elapsedHours), undertimeGraceMinutes);
}

/** Legacy buckets for fixed-monthly employees only. */
export function dayPayUnitsLegacy(
  elapsedHours: number | null | undefined,
  undertimeGraceMinutes: number,
): number {
  if (
    elapsedHours == null ||
    !Number.isFinite(elapsedHours) ||
    elapsedHours <= 0
  ) {
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
