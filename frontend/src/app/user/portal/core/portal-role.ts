export type WorkTrack = 'quota' | 'tasks' | 'progress';

function roleKey(role: string | null | undefined): string {
  return (role ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isOjtRole(role: string | null | undefined): boolean {
  const key = roleKey(role);
  return key.includes('ojt') || key.includes('intern') || key.includes('trainee');
}

/** Which "work" tab a role sees (matches the app's bottom bar). */
export function workTrack(role: string | null | undefined): WorkTrack {
  const key = roleKey(role);
  if (isOjtRole(role)) {
    return 'progress';
  }
  if (key === 'developer' || key === 'developers') {
    return 'tasks';
  }
  if (
    key.includes('technician') ||
    key.includes('sales') ||
    key === 'manager' ||
    key === 'assistantmanager' ||
    key === 'assistantsalesmanager'
  ) {
    return 'quota';
  }
  return 'progress';
}

/** "SalesManager" / "sales_manager" -> "Sales Manager". */
export function roleLabel(role: string | null | undefined): string {
  return (role ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function workTrackLabel(role: string | null | undefined): string {
  switch (workTrack(role)) {
    case 'quota':
      return 'Quota';
    case 'tasks':
      return 'Tasks';
    default:
      return 'Progress';
  }
}
