import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-admin-login-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-login-page.component.html',
})
export class AdminLoginPageComponent {
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
        this.adminAuth.login(this.username(), this.password(), this.rememberMe()),
      );

      this.adminAuth.saveSession(
        response.data.accessToken,
        response.data.user,
        this.rememberMe(),
      );

      await this.router.navigateByUrl('/admin/dashboard');
    } catch (error) {
      if (this.adminAuth.isStaffGateAuthError(error)) {
        this.adminAuth.clearStaffGateAccess();
        await this.router.navigate(['/admin/access'], {
          queryParams: { reason: 'staff-gate-expired' },
        });
        return;
      }

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
