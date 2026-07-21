import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';

@Component({
  selector: 'app-staff-access-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './staff-access-page.component.html',
})
export class StaffAccessPageComponent implements OnInit {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly passcode = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'staff-gate-expired') {
      this.notice.set('Your staff access session expired. Enter the passcode again to continue.');
    }
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
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string | string[] } }).error;

      if (Array.isArray(payload?.message)) {
        return payload.message.join(', ');
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }

    return 'Unable to reach the admin API. Make sure the backend is running on port 3000.';
  }
}
