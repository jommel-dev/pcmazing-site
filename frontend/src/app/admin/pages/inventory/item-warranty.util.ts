export type WarrantyUnit = 'day' | 'week' | 'month' | 'year';

const UNITS = new Set<WarrantyUnit>(['day', 'week', 'month', 'year']);

export const WARRANTY_PRESETS: Array<{ label: string; value: number; unit: WarrantyUnit }> = [
  { label: '7 Days', value: 7, unit: 'day' },
  { label: '1 Month', value: 1, unit: 'month' },
  { label: '3 Months', value: 3, unit: 'month' },
  { label: '1 Year', value: 1, unit: 'year' },
];

export function normalizeWarrantyInput(
  value?: number | null,
  unit?: string | null,
): { warrantyValue: number; warrantyUnit: WarrantyUnit } | null {
  const hasValue = value != null && !(typeof value === 'number' && Number.isNaN(value));
  const rawUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  if (!hasValue && !rawUnit) {
    return null;
  }
  if (!hasValue || !rawUnit || !UNITS.has(rawUnit as WarrantyUnit)) {
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return null;
  }
  return { warrantyValue: n, warrantyUnit: rawUnit as WarrantyUnit };
}

export function formatWarrantyLabel(
  value?: number | null,
  unit?: string | null,
): string {
  const normalized = normalizeWarrantyInput(value, unit);
  if (!normalized) {
    return '';
  }
  const labels: Record<WarrantyUnit, [string, string]> = {
    day: ['Day', 'Days'],
    week: ['Week', 'Weeks'],
    month: ['Month', 'Months'],
    year: ['Year', 'Years'],
  };
  const [one, many] = labels[normalized.warrantyUnit];
  return `${normalized.warrantyValue} ${normalized.warrantyValue === 1 ? one : many}`;
}
