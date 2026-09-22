import { pickSalaryAmountForLocation, locationPayLabelSuffix } from './location-pay.util';

describe('pickSalaryAmountForLocation', () => {
  it('uses office amount for office days', () => {
    expect(pickSalaryAmountForLocation('office', 800, 700)).toBe(800);
  });

  it('uses wfh amount for wfh days', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, 700)).toBe(700);
  });

  it('falls back to office when wfh is null', () => {
    expect(pickSalaryAmountForLocation('wfh', 800, null)).toBe(800);
  });

  it('returns null for off days (unpaid)', () => {
    expect(pickSalaryAmountForLocation('off', 800, 700)).toBe(null);
  });
});

describe('locationPayLabelSuffix', () => {
  it('labels office, wfh, and off', () => {
    expect(locationPayLabelSuffix('office')).toBe(' · Office');
    expect(locationPayLabelSuffix('wfh')).toBe(' · WFH');
    expect(locationPayLabelSuffix('off')).toBe(' · Off (unpaid)');
  });
});
