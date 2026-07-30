/** Normalize role names for comparison (e.g. "Sales Manager" → "salesmanager"). */
export function normalizeRoleKey(role?: string | null): string {
  return (role?.trim().toLowerCase() ?? '').replace(/[\s_-]+/g, '');
}

export const BUSINESS_ROLE_LABELS = [
  'Super Admin',
  'Admin',
  'Marketing Lead',
  'Marketing',
  'Sales Manager',
  'Assistant Sales Manager',
  'Developer',
  'Project Manager',
] as const;

export type AdminModuleKey =
  | 'dashboard'
  | 'marketing_dashboard'
  | 'sales_dashboard'
  | 'developers_dashboard'
  | 'contact_inquiries'
  | 'customer_reviews'
  | 'demo_requests'
  | 'job_order'
  | 'quotation'
  | 'inventory'
  | 'customers'
  | 'lead_generation'
  | 'organization_team'
  | 'projects'
  | 'kanban'
  | 'developers_team'
  | 'payroll'
  | 'accounting'
  | 'user_management'
  | 'settings'
  | 'printing_generator'
  | 'profile';

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

export function isSales(role?: string | null): boolean {
  if (isSuperAdmin(role)) {
    return true;
  }
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }
  if (
    key === 'sales' ||
    key === 'salesmanager' ||
    key === 'assistantsalesmanager' ||
    key === 'assistantmanager'
  ) {
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
  return isDeveloper(role) || isProjectManager(role) || isSuperAdmin(role);
}

export function isSalesRestrictedInventory(role?: string | null): boolean {
  if (isSuperAdmin(role)) {
    return false;
  }
  const key = normalizeRoleKey(role);
  if (!key) {
    return false;
  }
  if (
    key === 'sales' ||
    key === 'salesmanager' ||
    key === 'assistantsalesmanager' ||
    key === 'assistantmanager'
  ) {
    return true;
  }
  return key.includes('sales') && (key.includes('manager') || key.includes('assistant'));
}

export function canSeeInventoryCosts(role?: string | null): boolean {
  return !isSalesRestrictedInventory(role);
}

export function getAllowedModuleKeys(role?: string | null): Set<AdminModuleKey> | 'all' {
  if (isSuperAdmin(role)) {
    return 'all';
  }

  if (isMarketingLead(role)) {
    return new Set([
      'marketing_dashboard',
      'lead_generation',
      'organization_team',
      'profile',
    ]);
  }

  if (isMarketing(role)) {
    return new Set(['marketing_dashboard', 'lead_generation', 'profile']);
  }

  if (isSalesRestrictedInventory(role)) {
    return new Set([
      'sales_dashboard',
      'contact_inquiries',
      'customer_reviews',
      'quotation',
      'inventory',
      'profile',
    ]);
  }

  if (isDeveloper(role) || isProjectManager(role)) {
    return new Set(['developers_dashboard', 'projects', 'kanban', 'profile']);
  }

  return new Set(['profile']);
}

export function canAccessModule(role: string | null | undefined, moduleKey: AdminModuleKey): boolean {
  const allowed = getAllowedModuleKeys(role);
  if (allowed === 'all') {
    return true;
  }
  return allowed.has(moduleKey);
}

export function getRoleHomeRoute(role?: string | null): string {
  if (isSuperAdmin(role)) {
    return '/admin/dashboard';
  }
  if (isMarketingLead(role) || isMarketing(role)) {
    return '/admin/marketing-dashboard';
  }
  if (isSalesRestrictedInventory(role)) {
    return '/admin/sales-dashboard';
  }
  if (isDeveloper(role) || isProjectManager(role)) {
    return '/admin/developers-dashboard';
  }
  return '/admin/profile';
}

/** Where to send the user after logout / when picking an entry URL by role. */
export function getLoginEntryRoute(role?: string | null): string {
  return isSuperAdmin(role) ? '/admin/access' : '/user/portal';
}

export function getLogoutRoute(role?: string | null): string {
  return getLoginEntryRoute(role);
}
