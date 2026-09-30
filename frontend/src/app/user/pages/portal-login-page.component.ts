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
