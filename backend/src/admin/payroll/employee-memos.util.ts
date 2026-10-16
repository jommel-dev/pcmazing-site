export type EmployeeMemoType =
  | 'verbal_reminder'
  | 'written_warning'
  | 'final_warning'
  | 'other';

const MEMO_TYPES: EmployeeMemoType[] = [
  'verbal_reminder',
  'written_warning',
  'final_warning',
  'other',
];

export function normalizeMemoType(value?: string | null): EmployeeMemoType {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if ((MEMO_TYPES as string[]).includes(normalized)) {
    return normalized as EmployeeMemoType;
  }
  throw new Error('Invalid memo type.');
}

export function memoTypeLabel(type: EmployeeMemoType): string {
  switch (type) {
    case 'verbal_reminder':
      return 'Verbal reminder';
    case 'written_warning':
      return 'Written warning';
    case 'final_warning':
      return 'Final warning';
    default:
      return 'Other';
  }
}

export function buildMemoNo(id: number, issuedAt: Date = new Date()): string {
  const year = issuedAt.getFullYear();
  return `MEMO-${year}-${String(id).padStart(6, '0')}`;
}
