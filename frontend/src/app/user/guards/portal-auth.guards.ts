import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { AdminAuthService } from '../../admin/services/admin-auth.service';
import { resolvePortalPostLoginRoute } from '../portal-post-login-route';

/** Guest-only portal login; authenticated users go to clock-gated landing. */
export const portalGuestGuard: CanActivateFn = async (route) => {
  const adminAuth = inject(AdminAuthService);
  const adminApi = inject(AdminApiService);
  const router = inject(Router);

  if (!adminAuth.isAuthenticated()) {
    return true;
  }

  const url = await resolvePortalPostLoginRoute({
    role: adminAuth.getStoredUser()?.role,
    returnUrl: route.queryParamMap.get('returnUrl'),
    fetchCanTimeIn: async () => {
      const status = await firstValueFrom(adminApi.getPortalTimeClockStatus());
      return Boolean(status?.data?.canTimeIn);
    },
  });

  return router.parseUrl(url);
};
