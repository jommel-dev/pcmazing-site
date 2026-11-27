import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../admin/services/admin-api.service';
import { AdminAuthService, AdminAuthUser } from '../../admin/services/admin-auth.service';
import { resolvePortalPostLoginRoute } from '../portal-post-login-route';
import { PortalPromptComponent } from '../portal/ui/portal-prompt.component';

@Component({
  selector: 'app-portal-login-page',
  imports: [FormsModule, RouterLink, PortalPromptComponent],
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
  readonly showPassword = signal(false);
  readonly forgotHint = signal(false);
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
      let session: { accessToken: string; user: AdminAuthUser } | undefined;
      try {
        session = (await firstValueFrom(this.adminAuth.portalLogin(this.username(), this.password())))
          ?.data;
      } catch (error) {
        this.error.set(this.extractLoginError(error));
        return;
      }

      if (!session?.accessToken || !session.user) {
        console.error('portal-login returned an unexpected body', session);
        this.error.set('Signed in, but the server sent an unexpected reply. Please try again.');
        return;
      }

      this.adminAuth.saveSession(session.accessToken, session.user);

      // The sign-in itself worked; anything failing from here on is about opening the portal,
      // so it must not be reported as a connection or password problem.
      try {
        const url = await this.resolveLanding(session.user.role);
        await this.router.navigateByUrl(url);
      } catch (error) {
        console.error('Signed in, but the portal screen failed to open', error);
        const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
        this.error.set(`Signed in, but the portal could not open.${detail}`);
      }
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
    const status =
      error && typeof error === 'object' && 'status' in error
        ? Number((error as { status?: number }).status)
        : 0;

    if (status === 0) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
    if (status >= 500) {
      return 'The server could not sign you in right now. Please try again in a moment.';
    }

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
