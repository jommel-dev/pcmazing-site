import { getRoleHomeRoute } from '../admin/rbac/admin-roles';

const TIME_CLOCK_ROUTE = '/admin/time-clock';

export function isSafeAdminReturnUrl(url: string): boolean {
  return url.startsWith('/admin/') && !url.startsWith('//') && !url.includes('://');
}

/**
 * Portal landing after auth:
 * 1) safe returnUrl
 * 2) /admin/time-clock when canTimeIn
 * 3) role home otherwise (including status errors)
 */
export async function resolvePortalPostLoginRoute(options: {
  role?: string | null;
  returnUrl: string | null | undefined;
  fetchCanTimeIn: () => Promise<boolean>;
}): Promise<string> {
  const returnUrl = (options.returnUrl ?? '').trim();
  if (returnUrl && isSafeAdminReturnUrl(returnUrl)) {
    return returnUrl;
  }

  const roleHome = getRoleHomeRoute(options.role);

  try {
    const canTimeIn = await options.fetchCanTimeIn();
    if (canTimeIn === true) {
      return TIME_CLOCK_ROUTE;
    }
  } catch {
    // Fall through to role home — never block login on status failure.
  }

  return roleHome;
}
