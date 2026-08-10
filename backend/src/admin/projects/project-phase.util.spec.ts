import { resolveSelectedPhaseId, toPhaseId } from './project-phase.util';

describe('project-phase.util', () => {
  describe('toPhaseId', () => {
    it('coerces numeric strings from BIGSERIAL', () => {
      expect(toPhaseId('12')).toBe(12);
      expect(toPhaseId(12)).toBe(12);
    });

    it('rejects empty and non-positive values', () => {
      expect(toPhaseId(null)).toBeNull();
      expect(toPhaseId(undefined)).toBeNull();
      expect(toPhaseId('')).toBeNull();
      expect(toPhaseId(0)).toBeNull();
      expect(toPhaseId('abc')).toBeNull();
    });
  });

  describe('resolveSelectedPhaseId', () => {
    const phases = [{ id: 10 }, { id: '20' }, { id: 30 }];

    it('returns the requested phase when it exists (string or number id)', () => {
      expect(resolveSelectedPhaseId(phases, 10, 20)).toBe(20);
      expect(resolveSelectedPhaseId(phases, 10, '30')).toBe(30);
    });

    it('falls back to current when request is missing or unknown', () => {
      expect(resolveSelectedPhaseId(phases, 10, undefined)).toBe(10);
      expect(resolveSelectedPhaseId(phases, 10, 999)).toBe(10);
      expect(resolveSelectedPhaseId(phases, null, undefined)).toBeNull();
    });
  });
});
