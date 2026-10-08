import type { AdminModuleKey } from './admin-roles';
import { getAllowedModuleKeys, isSuperAdmin } from './admin-roles';

const MODULE_KEYS: AdminModuleKey[] = [
  'dashboard',
  'marketing_dashboard',
  'sales_dashboard',
  'developers_dashboard',
  'contact_inquiries',
  'customer_reviews',
  'demo_requests',
  'sales_order',
  'job_order',
  'quotation',
  'local_price_lists',
  'inventory',
  'customers',
  'company_expenses',
  'lead_generation',
  'organization_team',
  'projects',
  'kanban',
  'developers_team',
  'payroll',
  'accounting',
  'user_management',
  'settings',
  'printing_generator',
  'profile',
  'time_clock',
];

export function hasPermission(
  keys: string[] | null | undefined,
  required: string | string[],
): boolean {
  if (!keys?.length) {
    return false;
  }
  if (keys.includes('*')) {
    return true;
  }
  const need = Array.isArray(required) ? required : [required];
  return need.every((key) => keys.includes(key));
}

export function modulesFromPermissions(
  keys: string[] | null | undefined,
): Set<AdminModuleKey> | 'all' {
  if (keys?.includes('*')) {
    return 'all';
  }
  const set = new Set<AdminModuleKey>();
  for (const moduleKey of MODULE_KEYS) {
    if (hasPermission(keys, `${moduleKey}.view`)) {
      set.add(moduleKey);
    }
  }
  if (!set.has('profile')) {
    set.add('profile');
  }
  return set;
}

/** Resolve modules for nav/guards: prefer permission keys; fall back to legacy role maps. */
export function resolveAllowedModules(options: {
  role?: string | null;
  permissionKeys?: string[] | null;
  payrollEnabled?: boolean;
}): Set<AdminModuleKey> | 'all' {
  const keys = options.permissionKeys;
  let allowed: Set<AdminModuleKey> | 'all';

  if (keys?.length) {
    allowed = modulesFromPermissions(keys);
  } else if (isSuperAdmin(options.role)) {
    allowed = 'all';
  } else {
    allowed = getAllowedModuleKeys(options.role);
  }

  if (!options.payrollEnabled && allowed !== 'all') {
    const next = new Set(allowed);
    next.delete('time_clock');
    return next;
  }

  return allowed;
}

export function canAccessModuleWithPermissions(
  options: {
    role?: string | null;
    permissionKeys?: string[] | null;
    payrollEnabled?: boolean;
  },
  moduleKey: AdminModuleKey,
): boolean {
  if (moduleKey === 'time_clock' && !options.payrollEnabled) {
    return false;
  }
  const allowed = resolveAllowedModules(options);
  if (allowed === 'all') {
    return true;
  }
  return allowed.has(moduleKey);
}
