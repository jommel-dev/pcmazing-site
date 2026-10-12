import {
  assertBypassAllowed,
  lunchMinutes,
  overbreakMinutes,
  punchOutRequiresLunchConfirm,
} from './attendance-lunch.util';

describe('attendance-lunch.util', () => {
  // 2026-10-12T03:00:00.000Z == 11:00 Asia/Manila; 02:00:00.000Z == 10:00 Manila
  const after11 = '2026-10-12T03:00:00.000Z';
  const before11 = '2026-10-12T02:00:00.000Z';
  const timedIn = {
    timeIn: '2026-10-12T00:00:00.000Z',
    lunchOut: null as string | null,
    lunchIn: null as string | null,
    timeOut: null as string | null,
    workDate: '2026-10-12',
  };

  it('requires lunch confirm at/after 11:00 Manila when timed in with no lunch/out', () => {
    expect(punchOutRequiresLunchConfirm(after11, timedIn)).toBe(true);
  });

  it('does not require confirm before 11:00 Manila', () => {
    expect(punchOutRequiresLunchConfirm(before11, timedIn)).toBe(false);
  });

  it('does not require confirm when lunch out already set', () => {
    expect(
      punchOutRequiresLunchConfirm(after11, {
        ...timedIn,
        lunchOut: '2026-10-12T03:05:00.000Z',
      }),
    ).toBe(false);
  });

  it('computes lunch minutes between out and in', () => {
    expect(
      lunchMinutes(
        '2026-10-12T03:00:00.000Z',
        '2026-10-12T04:15:00.000Z',
      ),
    ).toBe(75);
  });

  it('computes overbreak as max(0, lunch - 60)', () => {
    expect(overbreakMinutes(75)).toBe(15);
    expect(overbreakMinutes(45)).toBe(0);
    expect(overbreakMinutes(null)).toBe(0);
  });

  it('rejects bypass overwrite of filled time_out', () => {
    expect(() =>
      assertBypassAllowed(
        'time_out',
        { ...timedIn, timeOut: '2026-10-12T09:00:00.000Z' },
        new Date('2026-10-12T09:30:00.000Z'),
      ),
    ).toThrow(/already/i);
  });

  it('allows bypass lunch_out when timed in and slots empty', () => {
    expect(() =>
      assertBypassAllowed(
        'lunch_out',
        timedIn,
        new Date('2026-10-12T03:30:00.000Z'),
      ),
    ).not.toThrow();
  });

  it('rejects lunch_in before lunch_out', () => {
    expect(() =>
      assertBypassAllowed(
        'lunch_in',
        timedIn,
        new Date('2026-10-12T04:00:00.000Z'),
      ),
    ).toThrow(/lunch out/i);
  });
});
