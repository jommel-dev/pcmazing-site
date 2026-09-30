### Task 1: Shared post-login resolver + wire login + guest guard

**Files:**
- Create: `frontend/src/app/user/portal-post-login-route.ts`
- Modify: `frontend/src/app/user/pages/portal-login-page.component.ts`
- Modify: `frontend/src/app/user/guards/portal-auth.guards.ts`
- Modify: `docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md` (Status â†’ Implemented)

**Interfaces:**
- Consumes: `getRoleHomeRoute(role)`, `AdminApiService.getPortalTimeClockStatus()` â†’ `{ success; data: TimeClockStatus }` with `data.canTimeIn`
- Produces: `resolvePortalPostLoginRoute({ role, returnUrl, fetchCanTimeIn }): Promise<string>`

- [ ] **Step 1: Add shared resolver**

Create `frontend/src/app/user/portal-post-login-route.ts`:

```typescript
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
    // Fall through to role home â€” never block login on status failure.
  }

  return roleHome;
}
```

- [ ] **Step 2: Wire portal login page**

In `frontend/src/app/user/pages/portal-login-page.component.ts`:

1. Import `AdminApiService` and `resolvePortalPostLoginRoute` (remove local `isSafeAdminReturnUrl` / sync `resolvePostLoginRoute`).
2. Inject `AdminApiService`.
3. Replace redirect + submit navigation with async resolve:

```typescript
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { AdminAuthService } from '../../admin/services/admin-auth.service';
import { resolvePortalPostLoginRoute } from '../portal-post-login-route';

@Component({
  selector: 'app-portal-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './portal-login-page.component.html',
})
export class PortalLoginPageComponent implements OnInit, OnDestroy {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private stopAuthWatch: (() => void) | null = null;

  readonly username = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    void this.redirectIfAuthenticated();
    this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => {
      void this.redirectIfAuthenticated();
    });
  }

  ngOnDestroy(): void {
    this.stopAuthWatch?.();
  }

  private async redirectIfAuthenticated(): Promise<void> {
    if (!this.adminAuth.isAuthenticated()) {
      return;
    }
    const url = await this.resolveLanding(this.adminAuth.getStoredUser()?.role);
    await this.router.navigateByUrl(url);
  }

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminAuth.portalLogin(this.username(), this.password(), this.rememberMe()),
      );

      this.adminAuth.saveSession(
        response.data.accessToken,
        response.data.user,
        this.rememberMe(),
      );

      const url = await this.resolveLanding(response.data.user.role);
      await this.router.navigateByUrl(url);
    } catch (error) {
      this.error.set(this.extractLoginError(error));
    } finally {
      this.loading.set(false);
    }
  }

  private resolveLanding(role?: string | null): Promise<string> {
    return resolvePortalPostLoginRoute({
      role,
      returnUrl: this.route.snapshot.queryParamMap.get('returnUrl'),
      fetchCanTimeIn: async () => {
        const status = await firstValueFrom(this.adminApi.getPortalTimeClockStatus());
        return Boolean(status?.data?.canTimeIn);
      },
    });
  }

  private extractLoginError(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string | string[] } }).error;

      if (Array.isArray(payload?.message)) {
        return payload.message.join(', ');
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }

    return 'Invalid username or password.';
  }
}
```

Keep the HTML template unchanged.

- [ ] **Step 3: Wire portal guest guard**

Replace `frontend/src/app/user/guards/portal-auth.guards.ts` so already-authed users use the same landing rules (and honor `returnUrl` from the activated route):

```typescript
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
```

- [ ] **Step 4: Mark spec implemented**

In `docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md`, set:

`**Status:** Implemented`

- [ ] **Step 5: Typecheck frontend**

Run (from repo root, PowerShell):

```powershell
cd frontend; npx ng build --configuration=development
```

Expected: build succeeds (exit 0). If `env` generation is required first: `npm run env; npx ng build --configuration=development`.

- [ ] **Step 6: Manual acceptance (quick)**

With Nest + `ng serve` running:

1. Payroll-enabled user, not clocked in, `/user/login` â†’ lands on `/admin/time-clock`.
2. Time in, logout, login again â†’ role home (sales â†’ `/admin/sales-dashboard`).
3. `/user/login?returnUrl=/admin/time-clock` â†’ that URL after login.
4. Optional: disable network to status or use non-payroll user â†’ still reaches role home.

- [ ] **Step 7: Commit**

```powershell
git add frontend/src/app/user/portal-post-login-route.ts frontend/src/app/user/pages/portal-login-page.component.ts frontend/src/app/user/guards/portal-auth.guards.ts docs/superpowers/specs/2026-09-30-clock-gated-portal-landing-design.md
git commit -m "Gate portal login landing on time-clock canTimeIn."
```

