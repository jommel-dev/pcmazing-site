import {
  assertBypassAllowed,
  nextBypassActions,
  punchOutRequiresLunchConfirm,
} from './attendance-lunch.util';

/**
 * Focused state-machine checks for lunch / bypass rules used by PayrollService.
 * Full DB punch flows are covered by manual verification + util tests.
 */
describe('payroll attendance lunch state machine', () => {
  const after11 = '2026-10-12T03:00:00.000Z';
  const row = {
    timeIn: '2026-10-12T00:00:00.000Z',
    lunchOut: null as string | null,
    lunchIn: null as string | null,
    timeOut: null as string | null,
    workDate: '2026-10-12',
  };

  it('requires intent at/after 11:00 when timed in', () => {
    expect(punchOutRequiresLunchConfirm(after11, row)).toBe(true);
  });

  it('offers lunch_out and time_out as next bypass actions when timed in', () => {
    expect(nextBypassActions(row)).toEqual(['lunch_out', 'time_out']);
  });

  it('offers only lunch_in while on lunch', () => {
    expect(
      nextBypassActions({
        ...row,
        lunchOut: '2026-10-12T03:10:00.000Z',
      }),
    ).toEqual(['lunch_in']);
  });

  it('rejects end-of-day bypass while lunch is open', () => {
    expect(() =>
      assertBypassAllowed(
        'time_out',
        { ...row, lunchOut: '2026-10-12T03:10:00.000Z' },
        new Date('2026-10-12T05:00:00.000Z'),
      ),
    ).toThrow(/Lunch in is required/i);
  });
});
