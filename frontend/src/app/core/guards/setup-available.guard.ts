import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SetupApiService } from '../services/setup-api.service';

export const setupAvailableGuard: CanActivateFn = async () => {
  const setupApi = inject(SetupApiService);
  const router = inject(Router);

  try {
    const response = await firstValueFrom(setupApi.getStatus());

    if (response.data.setupAvailable) {
      return true;
    }

    return router.createUrlTree(['/']);
  } catch {
    return true;
  }
};
