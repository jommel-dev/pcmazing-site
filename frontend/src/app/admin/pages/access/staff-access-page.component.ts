import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { getRoleHomeRoute } from '../../rbac/admin-roles';
import { AdminAuthService } from '../../services/admin-auth.service';
import { APP_CONFIG } from '../../../core/config/app-config';

@Component({
  selector: 'app-staff-access-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './staff-access-page.component.html',
})
export class StaffAccessPageComponent implements OnInit, OnDestroy {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private stopAuthWatch: (() => void) | null = null;

  readonly passcode = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit(): void {
    this.redirectIfAuthenticated();
    this.stopAuthWatch = this.adminAuth.onAuthStorageChange(() => this.redirectIfAuthenticated());

    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'staff-gate-expired') {
      this.notice.set('Your staff access session expired. Enter the passcode again to continue.');
    }
  }

  ngOnDestroy(): void {
    this.stopAuthWatch?.();
  }

  private redirectIfAuthenticated(): void {
    if (!this.adminAuth.isAuthenticated()) {
      return;
    }
    void this.router.navigateByUrl(getRoleHomeRoute(this.adminAuth.getStoredUser()?.role));
  }

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminAuth.verifyStaffPasscode(this.passcode().trim()),
      );
      this.adminAuth.saveStaffGateToken(response.data.staffGateToken);
      await this.router.navigateByUrl('/admin/login');
    } catch (error) {
      this.error.set(this.extractErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private extractErrorMessage(error: unknown): string {
    const unreachable = `Unable to reach the admin API at ${APP_CONFIG.apiUrl}. Make sure the backend is running.`;

    if (!error || typeof error !== 'object') {
      return unreachable;
    }

    const httpError = error as {
      status?: number;
      error?: { message?: string | string[] };
    };

    if (httpError.status === 0) {
      return unreachable;
    }

    const payload = httpError.error;
    const message = Array.isArray(payload?.message)
      ? payload.message.join(', ')
      : typeof payload?.message === 'string'
        ? payload.message
        : '';

    if (!message.trim() || /failed to fetch|networkerror|load failed/i.test(message)) {
      return unreachable;
    }

    return message;
  }
}
