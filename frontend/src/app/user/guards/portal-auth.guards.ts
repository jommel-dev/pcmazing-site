import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { AdminAuthService } from '../../admin/services/admin-auth.service';
import { resolvePortalPostLoginRoute } from '../portal-post-login-route';

/** Signed-in employees only; everyone else is sent to the portal login and back afterwards. */
export const portalAuthGuard: CanActivateFn = (_route, state) => {
  const adminAuth = inject(AdminAuthService);
  const router = inject(Router);

  if (adminAuth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/user/login'], { queryParams: { returnUrl: state.url } });
};

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
