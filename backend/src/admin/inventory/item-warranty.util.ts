import { BadRequestException } from '@nestjs/common';

export type WarrantyUnit = 'day' | 'week' | 'month' | 'year';

const UNITS = new Set<WarrantyUnit>(['day', 'week', 'month', 'year']);

export type NormalizedWarranty = {
  warrantyValue: number;
  warrantyUnit: WarrantyUnit;
} | null;

export function normalizeWarranty(
  value?: number | null,
  unit?: string | null,
): NormalizedWarranty {
  const hasValue = value != null && !(typeof value === 'number' && Number.isNaN(value));
  const rawUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  const hasUnit = rawUnit.length > 0;

  if (!hasValue && !hasUnit) {
    return null;
  }
  if (!hasValue || !hasUnit) {
    throw new BadRequestException('Warranty requires both a value and a unit.');
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException('Warranty value must be a whole number of at least 1.');
  }
  if (!UNITS.has(rawUnit as WarrantyUnit)) {
    throw new BadRequestException('Warranty unit must be day, week, month, or year.');
  }
  return { warrantyValue: n, warrantyUnit: rawUnit as WarrantyUnit };
}

export function formatWarrantyLabel(
  value?: number | null,
  unit?: string | null,
): string {
  const hasValue = value != null && !(typeof value === 'number' && Number.isNaN(value));
  const rawUnit = typeof unit === 'string' ? unit.trim().toLowerCase() : '';
  if (!hasValue || !rawUnit || !UNITS.has(rawUnit as WarrantyUnit)) {
    return '';
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    return '';
  }
  const labels: Record<WarrantyUnit, [string, string]> = {
    day: ['Day', 'Days'],
    week: ['Week', 'Weeks'],
    month: ['Month', 'Months'],
    year: ['Year', 'Years'],
  };
  const [one, many] = labels[rawUnit as WarrantyUnit];
  return `${n} ${n === 1 ? one : many}`;
}
