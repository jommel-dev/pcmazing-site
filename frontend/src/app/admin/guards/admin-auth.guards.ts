import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

export const staffGateGuard: CanActivateFn = () => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

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

  return router.createUrlTree(['/admin/dashboard']);
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
