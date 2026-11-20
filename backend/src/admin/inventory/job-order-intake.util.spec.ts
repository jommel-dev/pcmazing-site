import {
  JO_ACCESSORY_KEYS,
  mapJobStatusToFormChecks,
  normalizeAccessories,
  normalizeDeviceType,
  normalizeServiceArrangement,
  normalizeUnitCondition,
} from './job-order-intake.util';

describe('normalizeServiceArrangement', () => {
  it('accepts known values', () => {
    expect(normalizeServiceArrangement('in_store')).toBe('in_store');
    expect(normalizeServiceArrangement('ONSITE_HOME')).toBe('onsite_home');
    expect(normalizeServiceArrangement('onsite_office')).toBe('onsite_office');
  });

  it('returns null for empty or unknown', () => {
    expect(normalizeServiceArrangement(null)).toBeNull();
    expect(normalizeServiceArrangement('')).toBeNull();
    expect(normalizeServiceArrangement('walkin')).toBeNull();
  });
});

describe('normalizeDeviceType', () => {
  it('accepts known device types', () => {
    expect(normalizeDeviceType('Laptop')).toBe('laptop');
    expect(normalizeDeviceType('others')).toBe('others');
  });

  it('returns null for unknown', () => {
    expect(normalizeDeviceType('tablet')).toBeNull();
  });
});

describe('normalizeUnitCondition', () => {
  it('accepts known conditions', () => {
    expect(normalizeUnitCondition('good')).toBe('good');
    expect(normalizeUnitCondition('DEFECTIVE')).toBe('defective');
  });

  it('returns null for unknown', () => {
    expect(normalizeUnitCondition('broken')).toBeNull();
  });
});

describe('normalizeAccessories', () => {
  it('filters to known unique keys', () => {
    expect(
      normalizeAccessories([
        'charger',
        'CHARGER',
        'mouse',
        'not-a-key',
        'bag_case',
      ]),
    ).toEqual(['charger', 'mouse', 'bag_case']);
  });

  it('returns empty for null/empty', () => {
    expect(normalizeAccessories(null)).toEqual([]);
    expect(normalizeAccessories([])).toEqual([]);
  });

  it('locks accessory catalog size', () => {
    expect(JO_ACCESSORY_KEYS).toHaveLength(15);
  });
});

describe('mapJobStatusToFormChecks', () => {
  it('maps pending / in progress / for release / done', () => {
    expect(mapJobStatusToFormChecks('Pending')).toEqual({
      pending: true,
      inProgress: false,
      forRelease: false,
      completed: false,
    });
    expect(mapJobStatusToFormChecks('In Progress')).toEqual({
      pending: false,
      inProgress: true,
      forRelease: false,
      completed: false,
    });
    expect(mapJobStatusToFormChecks('For Release')).toEqual({
      pending: false,
      inProgress: false,
      forRelease: true,
      completed: false,
    });
    expect(mapJobStatusToFormChecks('Done')).toEqual({
      pending: false,
      inProgress: false,
      forRelease: false,
      completed: true,
    });
  });
});
