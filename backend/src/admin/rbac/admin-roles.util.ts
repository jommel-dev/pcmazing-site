/** Normalize role names for comparison (e.g. "Sales Manager" → "salesmanager"). */
export function normalizeRoleKey(role?: string | null): string {
  return (role?.trim().toLowerCase() ?? '').replace(/[\s_-]+/g, '');
}

const SUPER_ADMIN_KEYS = new Set([
  'admin',
  'administrator',
  'superadmin',
  'superadministrator',
  'businessowner',
]);

export function isSuperAdmin(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }
  if (SUPER_ADMIN_KEYS.has(key)) {
    return true;
  }
  return key.includes('super') && key.includes('admin');
}

export function isMarketingLead(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }
  if (key === 'marketinglead' || key === 'leadmarketing') {
    return true;
  }
  return key.includes('marketing') && key.includes('lead');
}

export function isMarketing(role?: string | null): boolean {
  if (isMarketingLead(role) || isSuperAdmin(role)) {
    return true;
  }
  const key = normalizeRoleKey(role);
  return key === 'marketing' || (key.includes('marketing') && !key.includes('lead'));
}

/** Store operations Manager / Assistant Manager — full Job Order, Sales Order, and Quotation access. */
export function isOperationsManager(role?: string | null): boolean {
  if (isSuperAdmin(role)) {
    return false;
  }
  const key = normalizeRoleKey(role);
  if (key === 'manager' || key === 'assistantmanager' || key === 'assistantsalesmanager') {
    return true;
  }
  return (
    key.includes('manager') &&
    key.includes('assistant') &&
    !key.includes('project') &&
    !key.includes('marketing') &&
    !key.includes('sales')
  );
}

export function isSalesRestrictedInventory(role?: string | null): boolean {
  if (isSuperAdmin(role) || isOperationsManager(role)) {
    return false;
  }
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }
  if (key === 'sales' || key === 'salesmanager' || key === 'assistantsalesmanager') {
    return true;
  }
  return key.includes('sales') && (key.includes('manager') || key.includes('assistant'));
}

export function isDeveloper(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  return key === 'developer' || key === 'developers';
}

export function isProjectManager(role?: string | null): boolean {
  const key = normalizeRoleKey(role);
  return (
    key === 'projectmanager' ||
    key === 'pm' ||
    (key.includes('project') && key.includes('manager'))
  );
}

export function isDeveloperOrPm(role?: string | null): boolean {
  return isDeveloper(role) || isProjectManager(role);
}

export function canSeeInventoryCosts(role?: string | null): boolean {
  return !isSalesRestrictedInventory(role);
}

/** Admin or Super Admin — may sign in at /admin/login. */
export function canUseAdminLogin(role?: string | null): boolean {
  return isSuperAdmin(role);
}

/** Roles allowed at /user/login (MyPeoplePortal). */
export function canUsePortalLogin(role?: string | null): boolean {
  if (canUseAdminLogin(role)) {
    return true;
  }
  return (
    isMarketing(role) ||
    isOperationsManager(role) ||
    isSalesRestrictedInventory(role) ||
    isDeveloper(role) ||
    isProjectManager(role)
  );
}

export function rolesMatch(userRole: string | null | undefined, required: string): boolean {
  const userKey = normalizeRoleKey(userRole);
  const requiredKey = normalizeRoleKey(required);
  if (!userKey || !requiredKey) {
    return false;
  }
  if (userKey === requiredKey) {
    return true;
  }
  if (requiredKey === 'admin' && isSuperAdmin(userRole)) {
    return true;
  }
  if (requiredKey === 'sales' && isSalesRestrictedInventory(userRole)) {
    return true;
  }
  return false;
}

export const BUSINESS_ROLE_LABELS = [
  'Super Admin',
  'Admin',
  'Manager',
  'Assistant Manager',
  'Marketing Lead',
  'Marketing',
  'Sales Manager',
  'Assistant Sales Manager',
  'Developer',
  'Project Manager',
] as const;
