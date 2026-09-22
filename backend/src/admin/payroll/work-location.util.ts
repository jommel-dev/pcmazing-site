export const WORK_LOCATION_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type WorkLocationDayKey = (typeof WORK_LOCATION_DAY_KEYS)[number];

export const WORK_LOCATION_TYPES = ['office', 'wfh', 'off'] as const;
export type WorkLocationType = (typeof WORK_LOCATION_TYPES)[number];

export type WeeklyLocationSchedule = Record<WorkLocationDayKey, WorkLocationType>;

export function isWorkLocationType(value: unknown): value is WorkLocationType {
  return typeof value === 'string' && (WORK_LOCATION_TYPES as readonly string[]).includes(value);
}

export function normalizeWeeklyLocationSchedule(
  value: unknown,
): WeeklyLocationSchedule | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const result = {} as WeeklyLocationSchedule;
  for (const key of WORK_LOCATION_DAY_KEYS) {
    const dayValue = record[key];
    if (!isWorkLocationType(dayValue)) {
      return null;
    }
    result[key] = dayValue;
  }
  return result;
}

export function defaultWeeklyLocationSchedule(
  workWeek: 'mon_fri' | 'mon_sat' | 'day_off_basis',
): WeeklyLocationSchedule {
  const officeDays =
    workWeek === 'mon_sat'
      ? new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
      : workWeek === 'day_off_basis'
        ? new Set(WORK_LOCATION_DAY_KEYS)
        : new Set(['mon', 'tue', 'wed', 'thu', 'fri']);

  const result = {} as WeeklyLocationSchedule;
  for (const key of WORK_LOCATION_DAY_KEYS) {
    result[key] = officeDays.has(key) ? 'office' : 'off';
  }
  return result;
}

/** ISO date YYYY-MM-DD → weekday key (Asia/Manila calendar date). */
export function weekdayKeyFromIsoDate(isoDate: string): WorkLocationDayKey {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 4, 0, 0)); // Manila is UTC+8; noon Manila ≈ 04:00 UTC
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
  }).format(utcNoon);
  switch (weekday) {
    case 'Mon':
      return 'mon';
    case 'Tue':
      return 'tue';
    case 'Wed':
      return 'wed';
    case 'Thu':
      return 'thu';
    case 'Fri':
      return 'fri';
    case 'Sat':
      return 'sat';
    default:
      return 'sun';
  }
}

export function resolveExpectedLocation(
  schedule: WeeklyLocationSchedule | null | undefined,
  workWeek: 'mon_fri' | 'mon_sat' | 'day_off_basis',
  workDate: string,
): WorkLocationType {
  const map = schedule ?? defaultWeeklyLocationSchedule(workWeek);
  return map[weekdayKeyFromIsoDate(workDate)];
}
