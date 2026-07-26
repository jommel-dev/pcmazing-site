/** Normalize tblrbac / JWT role names for comparison (e.g. "Super Admin" → "superadmin"). */
export function normalizeRoleKey(role?: string | null): string {
  return (role?.trim().toLowerCase() ?? '').replace(/[\s_-]+/g, '');
}

const FULL_ACCESS_ROLE_KEYS = new Set([
  'admin',
  'administrator',
  'superadmin',
  'superadministrator',
  'businessowner',
  'leadmarketing',
  'marketinglead',
]);

export function hasMarketingFullAccess(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }

  if (FULL_ACCESS_ROLE_KEYS.has(key)) {
    return true;
  }

  if (key.includes('super') && key.includes('admin')) {
    return true;
  }

  if (key.includes('marketing') && key.includes('lead')) {
    return true;
  }

  return false;
}

export function hasSuperAdminAccess(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }

  if (['superadmin', 'superadministrator'].includes(key)) {
    return true;
  }

  return key.includes('super') && key.includes('admin');
}

export function hasAdminMeetingOutcomeAccess(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }

  if (['admin', 'administrator', 'superadmin', 'superadministrator', 'businessowner'].includes(key)) {
    return true;
  }

  return key.includes('super') && key.includes('admin');
}

export function normalizeMarketingRole(role?: string | null): string {
  return role?.trim().toLowerCase() ?? '';
}

export function isSameUserId(
  left: number | string | null | undefined,
  right: number | string | null | undefined,
): boolean {
  if (left == null || right == null) {
    return false;
  }

  return Number(left) === Number(right);
}
