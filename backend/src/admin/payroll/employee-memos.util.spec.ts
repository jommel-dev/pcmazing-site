import { buildMemoNo, memoTypeLabel, normalizeMemoType } from './employee-memos.util';

describe('employee-memos.util', () => {
  it('normalizes memo types', () => {
    expect(normalizeMemoType('written_warning')).toBe('written_warning');
    expect(normalizeMemoType('Final Warning')).toBe('final_warning');
  });

  it('rejects invalid type', () => {
    expect(() => normalizeMemoType('ban')).toThrow(/invalid memo type/i);
  });

  it('builds memo numbers', () => {
    expect(buildMemoNo(7, new Date('2026-10-16T00:00:00Z'))).toBe('MEMO-2026-000007');
  });

  it('labels types', () => {
    expect(memoTypeLabel('verbal_reminder')).toBe('Verbal reminder');
  });
});
