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
