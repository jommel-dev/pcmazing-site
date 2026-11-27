import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService } from '../../../admin/services/admin-api.service';
import { AdminAuthService } from '../../../admin/services/admin-auth.service';
import { roleLabel } from '../core/portal-role';
import { portalErrorMessage, PortalWorkspaceService } from '../core/portal-workspace.service';
import { PortalIconComponent } from '../ui/portal-icon.component';
import { PortalPromptComponent } from '../ui/portal-prompt.component';

const PROFILE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

interface EmploymentCard {
  employeeCode: string | null;
  department: string | null;
  positionTitle: string | null;
  salaryType: 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff';
  payoutMethod: 'cash' | 'online';
  bankHint: string | null;
  payrollEnabled: boolean;
  joinedAt: string | null;
}

@Component({
  selector: 'app-portal-profile-page',
  standalone: true,
  imports: [FormsModule, RouterLink, PortalIconComponent, PortalPromptComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './portal-profile-page.component.html',
})
export class PortalProfilePageComponent implements OnInit {
  protected readonly workspace = inject(PortalWorkspaceService);
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AdminAuthService);

  protected readonly employment = signal<EmploymentCard | null>(null);
  protected readonly photoUploading = signal(false);
  protected readonly photoError = signal('');
  protected readonly editing = signal(false);
  protected readonly draftName = signal('');
  protected readonly draftEmail = signal('');
  protected readonly detailsSaving = signal(false);
  protected readonly detailsError = signal('');
  protected readonly detailsSaved = signal('');
  protected readonly passwordOpen = signal(false);
  protected readonly password = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly passwordSaving = signal(false);
  protected readonly passwordError = signal('');
  protected readonly passwordSaved = signal('');
  protected readonly initial = computed(() => this.workspace.firstName().slice(0, 1).toUpperCase());
  protected readonly greeting = computed(() => manilaGreeting(this.workspace.clock()?.serverNow));
  protected readonly jobTitle = computed(
    () => this.employment()?.positionTitle?.trim() || roleLabel(this.workspace.role()) || 'Employee',
  );
  protected readonly active = computed(() => this.workspace.user()?.payrollEnabled !== false);
  protected readonly workLocation = computed(() => {
    switch (this.workspace.clock()?.expectedLocation) {
      case 'wfh':
        return 'Work from home';
      case 'off':
        return 'Day off';
      case 'office':
        return 'Head office';
      default:
        return '—';
    }
  });
  protected readonly paySchedule = computed(() => salaryLabel(this.employment()?.salaryType));
  protected readonly joined = computed(() => formatJoined(this.employment()?.joinedAt));
  protected readonly email = computed(() => this.workspace.user()?.email?.trim() || '—');
  protected readonly paymentDetail = computed(() => {
    const card = this.employment();
    if (!card) {
      return 'Loading payout details';
    }
    if (card.bankHint) {
      return card.bankHint;
    }
    return card.payoutMethod === 'online' ? 'Online payout' : 'Paid in cash';
  });

  ngOnInit(): void {
    void this.load();
  }

  protected signOut(): void {
    this.workspace.signOut();
  }

  protected startEdit(): void {
    const user = this.workspace.user();
    this.draftName.set(user?.fullName ?? '');
    this.draftEmail.set(user?.email ?? '');
    this.detailsError.set('');
    this.detailsSaved.set('');
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.detailsError.set('');
  }

  protected async saveDetails(): Promise<void> {
    const fullName = this.draftName().trim();
    const email = this.draftEmail().trim();
    this.detailsError.set('');
    this.detailsSaved.set('');
    if (fullName.length < 2) {
      this.detailsError.set('Enter your full name.');
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.detailsError.set('Enter a valid work email.');
      return;
    }

    this.detailsSaving.set(true);
    try {
      const response = await firstValueFrom(
        this.auth.updateProfile({
          fullName,
          ...(email ? { email } : {}),
        }),
      );
      this.workspace.setUser(response.data);
      this.editing.set(false);
      this.detailsSaved.set('Personal details saved.');
    } catch (error) {
      this.detailsError.set(portalErrorMessage(error, 'Could not save your details.'));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  protected togglePassword(): void {
    this.passwordError.set('');
    this.passwordSaved.set('');
    this.passwordOpen.update((open) => !open);
  }

  protected async savePassword(): Promise<void> {
    const password = this.password();
    this.passwordError.set('');
    this.passwordSaved.set('');
    if (password.trim().length < 6) {
      this.passwordError.set('Use at least 6 characters.');
      return;
    }
    if (password !== this.confirmPassword()) {
      this.passwordError.set('Passwords do not match.');
      return;
    }

    this.passwordSaving.set(true);
    try {
      await firstValueFrom(this.auth.changeMyPassword(password));
      this.password.set('');
      this.confirmPassword.set('');
      this.passwordOpen.set(false);
      this.passwordSaved.set('Password updated.');
    } catch (error) {
      this.passwordError.set(portalErrorMessage(error, 'Could not update the password.'));
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.photoError.set('');
    if (!PROFILE_IMAGE_TYPES.has(file.type)) {
      this.photoError.set('Use a JPEG, PNG, WEBP, or GIF.');
      return;
    }
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      this.photoError.set('Photo must be 2MB or smaller.');
      return;
    }

    this.photoUploading.set(true);
    try {
      const response = await firstValueFrom(this.auth.uploadMyProfileImage(file));
      this.workspace.setUser(response.data);
    } catch (error) {
      this.photoError.set(portalErrorMessage(error, 'Could not upload that photo.'));
    } finally {
      this.photoUploading.set(false);
    }
  }

  protected async removePhoto(): Promise<void> {
    if (!this.workspace.avatarUrl() || this.photoUploading()) {
      return;
    }
    this.photoError.set('');
    this.photoUploading.set(true);
    try {
      const response = await firstValueFrom(this.auth.removeMyProfileImage());
      this.workspace.setUser(response.data);
    } catch (error) {
      this.photoError.set(portalErrorMessage(error, 'Could not remove the photo.'));
    } finally {
      this.photoUploading.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const response = await firstValueFrom(this.api.getEmployeeEmployment());
      this.employment.set(response.data);
    } catch {
      this.employment.set(null);
    }
  }
}

function salaryLabel(value: EmploymentCard['salaryType'] | undefined): string {
  switch (value) {
    case 'weekly':
      return 'Weekly';
    case 'semi_monthly':
      return 'Semi-monthly';
    case 'cutoff':
      return 'Cut-off';
    case 'monthly':
      return 'Monthly';
    default:
      return '—';
  }
}

function formatJoined(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function manilaGreeting(serverNow: string | null | undefined): string {
  const date = serverNow ? new Date(serverNow) : new Date();
  const hour =
    Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(Number.isNaN(date.getTime()) ? new Date() : date),
    ) % 24;
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
