import { getRoleHomeRoute, isSuperAdmin } from '../admin/rbac/admin-roles';

export const PORTAL_HOME_ROUTE = '/user/home';
export const PORTAL_CLOCK_ROUTE = '/user/clock';
const ADMIN_TIME_CLOCK_ROUTE = '/admin/time-clock';

function isSafeInternalUrl(url: string, prefix: string): boolean {
  return url.startsWith(prefix) && !url.startsWith('//') && !url.includes('://');
}

export function isSafeAdminReturnUrl(url: string): boolean {
  return isSafeInternalUrl(url, '/admin/');
}

export function isSafePortalReturnUrl(url: string): boolean {
  return isSafeInternalUrl(url, '/user/') && !url.startsWith('/user/login');
}

/** Old links point at the admin clock; employees use the portal clock instead. */
function isAdminTimeClockUrl(url: string): boolean {
  return url === ADMIN_TIME_CLOCK_ROUTE || url.startsWith(`${ADMIN_TIME_CLOCK_ROUTE}?`);
}

/**
 * Portal landing after auth:
 * 1) safe returnUrl (portal screens, or admin pages; /admin/time-clock becomes /user/clock for employees)
 * 2) employees: the portal time clock when they can time in (like the app), otherwise Home
 * 3) Super Admin: /admin/time-clock when canTimeIn, otherwise the admin role home
 */
export async function resolvePortalPostLoginRoute(options: {
  role?: string | null;
  returnUrl: string | null | undefined;
  fetchCanTimeIn: () => Promise<boolean>;
}): Promise<string> {
  const admin = isSuperAdmin(options.role);
  const returnUrl = (options.returnUrl ?? '').trim();

  if (returnUrl && isSafeAdminReturnUrl(returnUrl) && isAdminTimeClockUrl(returnUrl) && !admin) {
    return PORTAL_CLOCK_ROUTE;
  }
  if (returnUrl && (isSafePortalReturnUrl(returnUrl) || isSafeAdminReturnUrl(returnUrl))) {
    return returnUrl;
  }

  let canTimeIn = false;
  try {
    canTimeIn = (await options.fetchCanTimeIn()) === true;
  } catch {
    // Never block login on a status failure.
  }

  if (admin) {
    return canTimeIn ? ADMIN_TIME_CLOCK_ROUTE : getRoleHomeRoute(options.role);
  }
  return canTimeIn ? PORTAL_CLOCK_ROUTE : PORTAL_HOME_ROUTE;
}
