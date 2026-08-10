/** Coerce BIGSERIAL / query-string phase ids to a positive number. */
export function toPhaseId(value: string | number | null | undefined): number | null {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Prefer the requested phase when it belongs to the project; otherwise current.
 * Compares with Number() so string BIGSERIAL ids from pg still match.
 */
export function resolveSelectedPhaseId(
  phases: Array<{ id: string | number }>,
  currentPhaseId: number | null,
  phaseIdRaw?: string | number | null,
): number | null {
  const requested = toPhaseId(phaseIdRaw);
  if (
    requested != null &&
    phases.some((phase) => toPhaseId(phase.id) === requested)
  ) {
    return requested;
  }
  return currentPhaseId;
}
