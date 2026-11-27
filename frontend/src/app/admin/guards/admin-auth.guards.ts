import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { canAccessModuleWithPermissions } from '../rbac/admin-permissions';
import {
  AdminModuleKey,
  getRoleHomeRoute,
  isSalesRestrictedInventory,
  isSuperAdmin,
} from '../rbac/admin-roles';
import { AdminAuthService } from '../services/admin-auth.service';

function roleHomeTree(adminAuth: AdminAuthService, router: Router): UrlTree {
  const role = adminAuth.getStoredUser()?.role;
  return router.createUrlTree([getRoleHomeRoute(role)]);
}

export const staffGateGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.isAuthenticated()) {
    return roleHomeTree(adminAuth, router);
  }

  if (adminAuth.hasStaffGateAccess()) {
    return true;
  }

  return router.createUrlTree(['/admin/access']);
};

export const adminGuestGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (!adminAuth.isAuthenticated()) {
    return true;
  }

  return roleHomeTree(adminAuth, router);
};

export const adminAuthGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.isAuthenticated()) {
    return true;
  }

  if (adminAuth.hasStaffGateAccess()) {
    return router.createUrlTree(['/admin/login']);
  }

  return router.createUrlTree(['/admin/access']);
};

/** Only Super Admin keeps the admin clock; every other employee clocks in from the portal. */
export const portalTimeClockRedirectGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (isSuperAdmin(adminAuth.getStoredUser()?.role)) {
    return true;
  }

  return router.createUrlTree(['/user/clock']);
};

export const adminRoleGuard: CanActivateFn = (route) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);
  const user = adminAuth.getStoredUser();
  const role = user?.role;
  const moduleKey = (route.data?.['module'] ?? null) as AdminModuleKey | null;

  if (!moduleKey) {
    return true;
  }

  if (
    moduleKey === 'inventory' &&
    route.data?.['inventoryWrite'] &&
    isSalesRestrictedInventory(role)
  ) {
    return router.createUrlTree(['/admin/inventory']);
  }

  if (
    canAccessModuleWithPermissions(
      {
        role,
        permissionKeys: user?.permissionKeys,
        payrollEnabled: Boolean(user?.payrollEnabled),
      },
      moduleKey,
    )
  ) {
    return true;
  }

  // Super admin dashboard module key
  if (moduleKey === 'dashboard' && isSuperAdmin(role)) {
    return true;
  }

  return router.createUrlTree([getRoleHomeRoute(role)]);
};
