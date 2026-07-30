import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getRoleHomeRoute } from '../../admin/rbac/admin-roles';
import { AdminAuthService } from '../../admin/services/admin-auth.service';

/** Guest-only portal login; authenticated users go to their role home. */
export const portalGuestGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (!adminAuth.isAuthenticated()) {
    return true;
  }

  const role = adminAuth.getStoredUser()?.role;
  return router.createUrlTree([getRoleHomeRoute(role)]);
};
