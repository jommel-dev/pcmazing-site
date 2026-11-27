/** Display helpers shared by the employee portal screens (same rules as the MyPeoplePortal app). */

const MANILA_TZ = 'Asia/Manila';
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const HOURS_TARGET = 80;

function manilaParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "1:05 PM" in Manila time, or "—" when empty/invalid. */
export function formatManilaTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const p = manilaParts(date);
  return `${Number(p['hour'])}:${p['minute']} ${(p['dayPeriod'] ?? '').toUpperCase()}`;
}

/** "Jan 5, 2026  1:05 PM" in Manila time. */
export function formatManilaDateTime(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const p = manilaParts(date);
  const month = MONTH_NAMES[Number(p['month']) - 1]?.slice(0, 3) ?? '';
  return `${month} ${Number(p['day'])}, ${p['year']}  ${formatManilaTime(value)}`;
}

/** "8 h" / "7.5 h" (rounded to 2 decimals). */
export function formatHours(hours: number | null | undefined): string {
  const value = Math.round((hours ?? 0) * 100) / 100;
  return `${value} h`;
}

/** "1.0 hr" / "7.5 hrs" for the attendance day list. */
export function formatHoursShort(hours: number | null | undefined): string {
  if (hours == null) {
    return '—';
  }
  const value = Math.round(hours * 10) / 10;
  return `${value.toFixed(1)} ${value === 1 ? 'hr' : 'hrs'}`;
}

/** "14.5547 N, 121.0244 E" */
export function formatCoordinates(
  lat: number | null | undefined,
  lng: number | null | undefined,
): string | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)} ${ns}, ${Math.abs(lng).toFixed(4)} ${ew}`;
}

/** Semi-monthly window that contains a Manila work date: 1–15 or 16–end. */
export function cutoffWindow(workDate: string | null | undefined): {
  from: string;
  to: string;
  label: string;
} | null {
  const match = workDate?.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const last = new Date(year, month, 0).getDate();
  const start = day <= 15 ? 1 : 16;
  const end = day <= 15 ? 15 : last;
  const pad = (value: number) => String(value).padStart(2, '0');
  const monthName = MONTH_NAMES[month - 1]?.slice(0, 3) ?? '';
  return {
    from: `${year}-${pad(month)}-${pad(start)}`,
    to: `${year}-${pad(month)}-${pad(end)}`,
    label: `${monthName} ${start} – ${end}, ${year}`,
  };
}

/** Last place name in a saved address, without a trailing "City". */
export function shortPlace(label: string | null | undefined): string {
  const text = label?.trim();
  if (!text) {
    return '';
  }
  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? text;
  return last.replace(/\s+city$/i, '');
}

/** Hours as shown in the big stat: one decimal at most, no trailing zero. */
export function trimHours(hours: number | null | undefined): string {
  const value = Math.round((hours ?? 0) * 10) / 10;
  return String(value);
}

export function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return `₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Current month in Manila as "YYYY-MM". */
export function currentMonth(now = new Date()): string {
  const p = manilaParts(now);
  return `${p['year']}-${p['month']}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const index = year * 12 + (mon - 1) + delta;
  const nextYear = Math.floor(index / 12);
  const nextMonth = (index % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}

export function monthTitle(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  return `${MONTH_NAMES[(mon || 1) - 1] ?? ''} ${year}`;
}

export function daysInMonth(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon, 0).getDate();
}

/** 0 = Sunday for the first day of the month. */
export function weekdaySunday0(month: string, day: number): number {
  const [year, mon] = month.split('-').map(Number);
  return new Date(year, mon - 1, day).getDay();
}
