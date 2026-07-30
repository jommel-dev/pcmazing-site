import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { getRoleHomeRoute, isSuperAdmin } from '../../admin/rbac/admin-roles';
import { AdminAuthService } from '../../admin/services/admin-auth.service';

@Component({
  selector: 'app-portal-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './portal-login-page.component.html',
})
export class PortalLoginPageComponent {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly username = signal('');
  readonly password = signal('');
  readonly rememberMe = signal(false);
  readonly showPassword = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

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

      if (isSuperAdmin(response.data.user.role)) {
        this.adminAuth.logout();
        this.error.set('Super Admin must sign in at the Admin Portal.');
        return;
      }

      this.adminAuth.saveSession(
        response.data.accessToken,
        response.data.user,
        this.rememberMe(),
      );

      await this.router.navigateByUrl(getRoleHomeRoute(response.data.user.role));
    } catch (error) {
      this.error.set(this.extractLoginError(error));
    } finally {
      this.loading.set(false);
    }
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
