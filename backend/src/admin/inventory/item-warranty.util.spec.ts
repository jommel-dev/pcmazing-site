import { BadRequestException } from '@nestjs/common';
import { formatWarrantyLabel, normalizeWarranty } from './item-warranty.util';

describe('normalizeWarranty', () => {
  it('returns null when both empty', () => {
    expect(normalizeWarranty(null, null)).toBeNull();
    expect(normalizeWarranty(undefined, undefined)).toBeNull();
  });

  it('accepts value + unit', () => {
    expect(normalizeWarranty(1, 'year')).toEqual({ warrantyValue: 1, warrantyUnit: 'year' });
  });

  it('rejects partial or invalid', () => {
    expect(() => normalizeWarranty(1, null)).toThrow(BadRequestException);
    expect(() => normalizeWarranty(null, 'day')).toThrow(BadRequestException);
    expect(() => normalizeWarranty(0, 'day')).toThrow(BadRequestException);
    expect(() => normalizeWarranty(1, 'hour')).toThrow(BadRequestException);
  });
});

describe('formatWarrantyLabel', () => {
  it('formats singular and plural', () => {
    expect(formatWarrantyLabel(1, 'year')).toBe('1 Year');
    expect(formatWarrantyLabel(7, 'day')).toBe('7 Days');
    expect(formatWarrantyLabel(3, 'month')).toBe('3 Months');
    expect(formatWarrantyLabel(null, null)).toBe('');
  });
});
