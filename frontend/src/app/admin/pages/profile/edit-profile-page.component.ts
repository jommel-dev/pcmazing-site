import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService, AdminAuthUser } from '../../services/admin-auth.service';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
  selector: 'app-edit-profile-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './edit-profile-page.component.html',
})
export class EditProfilePageComponent implements OnInit {
  private readonly adminAuth = inject(AdminAuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly passwordSaving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly passwordError = signal('');
  readonly actionMessage = signal('');
  readonly profile = signal<AdminAuthUser | null>(null);
  readonly profilePreviewUrl = signal<string | null>(null);
  readonly pendingProfileFile = signal<File | null>(null);

  readonly profileForm = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: ['', [Validators.email]],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    void this.loadProfile();
  }

  async loadProfile(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminAuth.getProfile());
      this.profile.set(response.data);
      this.profileForm.patchValue({
        fullName: response.data.fullName,
        email: response.data.email ?? '',
      });
      this.profilePreviewUrl.set(this.adminApi.resolveProfileImageUrl(response.data.profileImageUrl));
    } catch {
      this.error.set('Unable to load your profile.');
    } finally {
      this.loading.set(false);
    }
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.pendingProfileFile.set(file);
    this.profilePreviewUrl.set(URL.createObjectURL(file));
  }

  async removeProfileImage(): Promise<void> {
    this.pendingProfileFile.set(null);
    const preview = this.profilePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    if (!this.profile()?.profileImageUrl) {
      this.profilePreviewUrl.set(null);
      return;
    }

    try {
      const response = await firstValueFrom(this.adminAuth.removeMyProfileImage());
      this.applyProfileUpdate(response.data);
      this.actionMessage.set('Profile image removed.');
    } catch {
      this.formError.set('Unable to remove profile image.');
    }
  }

  async saveProfile(): Promise<void> {
    this.formError.set('');
    this.actionMessage.set('');

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.formError.set('Please check your profile details.');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.profileForm.getRawValue();
      const response = await firstValueFrom(
        this.adminAuth.updateProfile({
          fullName: value.fullName.trim(),
          email: value.email.trim() || undefined,
        }),
      );

      let profile = response.data;
      const pendingFile = this.pendingProfileFile();
      if (pendingFile) {
        const imageResponse = await firstValueFrom(this.adminAuth.uploadMyProfileImage(pendingFile));
        profile = imageResponse.data;
        this.pendingProfileFile.set(null);
      }

      this.applyProfileUpdate(profile);
      this.actionMessage.set('Profile updated.');
    } catch {
      this.formError.set('Unable to save profile changes.');
    } finally {
      this.saving.set(false);
    }
  }

  async savePassword(): Promise<void> {
    this.passwordError.set('');
    this.actionMessage.set('');

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.passwordError.set('Enter a valid password.');
      return;
    }

    const value = this.passwordForm.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.passwordError.set('Passwords do not match.');
      return;
    }

    this.passwordSaving.set(true);

    try {
      await firstValueFrom(this.adminAuth.changeMyPassword(value.password));
      this.passwordForm.reset({ password: '', confirmPassword: '' });
      this.actionMessage.set('Password updated.');
    } catch {
      this.passwordError.set('Unable to update password.');
    } finally {
      this.passwordSaving.set(false);
    }
  }

  userInitials(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return 'AD';
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }

  profilePreview(): string | null {
    return this.profilePreviewUrl();
  }

  private applyProfileUpdate(profile: AdminAuthUser): void {
    this.profile.set(profile);
    this.adminAuth.updateStoredUser(profile, this.adminAuth.usesRememberMe());
    this.profilePreviewUrl.set(this.adminApi.resolveProfileImageUrl(profile.profileImageUrl));
    this.profileForm.patchValue({
      fullName: profile.fullName,
      email: profile.email ?? '',
    });
  }
}
