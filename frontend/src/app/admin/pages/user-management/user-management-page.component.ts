import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AdminUser,
  PaginationMeta,
  RbacStatus,
} from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';

type FormMode = 'create' | 'edit';

@Component({
  selector: 'app-user-management-page',
  imports: [FormsModule, ReactiveFormsModule],
  templateUrl: './user-management-page.component.html',
})
export class UserManagementPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly formBuilder = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly items = signal<AdminUser[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly roles = signal<string[]>([]);
  readonly rbacStatus = signal<RbacStatus | null>(null);
  readonly formOpen = signal(false);
  readonly formMode = signal<FormMode>('create');
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly passwordOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly actionMessage = signal('');
  readonly profilePreviewUrl = signal<string | null>(null);
  readonly pendingProfileFile = signal<File | null>(null);

  readonly userForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: ['', [Validators.email]],
    role: ['staff', [Validators.required]],
    isActive: [true],
    password: ['', [Validators.minLength(6)]],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  ngOnInit(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const [rbacResponse, rolesResponse] = await Promise.all([
        firstValueFrom(this.adminApi.getRbacStatus()),
        firstValueFrom(this.adminApi.listUserRoles()),
      ]);

      this.rbacStatus.set(rbacResponse.data);
      this.roles.set(rolesResponse.data);
      await this.load();
    } catch {
      this.error.set('Unable to load user management.');
      this.loading.set(false);
    }
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listUsers(this.page(), 20, this.search()),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load users.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchUsers(): Promise<void> {
    this.page.set(1);
    await this.load();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.load();
  }

  openCreateForm(): void {
    this.formMode.set('create');
    this.selectedUser.set(null);
    this.formError.set('');
    this.clearProfileSelection();
    this.userForm.reset({
      username: '',
      fullName: '',
      email: '',
      role: 'staff',
      isActive: true,
      password: '',
    });
    this.userForm.controls.username.enable();
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  openEditForm(user: AdminUser): void {
    this.formMode.set('edit');
    this.selectedUser.set(user);
    this.formError.set('');
    this.clearProfileSelection();
    this.profilePreviewUrl.set(this.adminApi.resolveProfileImageUrl(user.profileImageUrl));
    this.userForm.reset({
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? '',
      role: user.role,
      isActive: user.isActive,
      password: '',
    });
    this.userForm.controls.username.disable();
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.clearProfileSelection();
  }

  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.formError.set('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.formError.set('Profile image must be 2MB or smaller.');
      return;
    }

    this.pendingProfileFile.set(file);
    this.profilePreviewUrl.set(URL.createObjectURL(file));
    this.formError.set('');
  }

  async removeProfileImage(): Promise<void> {
    const user = this.selectedUser();
    if (!user) {
      this.clearProfileSelection();
      return;
    }

    if (user.profileImageUrl) {
      try {
        const response = await firstValueFrom(this.adminApi.removeUserProfileImage(user.id));
        this.selectedUser.set(response.data);
        this.syncCurrentUserProfile(response.data);
        this.actionMessage.set('Profile image removed.');
        await this.load();
      } catch {
        this.formError.set('Unable to remove profile image.');
        return;
      }
    }

    this.clearProfileSelection();
  }

  clearProfileSelection(): void {
    const preview = this.profilePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    this.profilePreviewUrl.set(null);
    this.pendingProfileFile.set(null);
  }

  openPasswordForm(user: AdminUser): void {
    this.selectedUser.set(user);
    this.passwordError.set('');
    this.passwordForm.reset({ password: '', confirmPassword: '' });
    this.passwordOpen.set(true);
  }

  closePasswordForm(): void {
    this.passwordOpen.set(false);
    this.passwordError.set('');
  }

  async submitForm(): Promise<void> {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const { username, fullName, email, role, isActive, password } = this.userForm.getRawValue();

    try {
      if (this.formMode() === 'create') {
        const response = await firstValueFrom(
          this.adminApi.createUser({
            username: username.trim(),
            fullName: fullName.trim(),
            email: email.trim() || undefined,
            role,
            isActive,
            password,
          }),
        );

        const createdUser = response.data;
        const profileFile = this.pendingProfileFile();
        if (profileFile) {
          const uploadResponse = await firstValueFrom(
            this.adminApi.uploadUserProfileImage(createdUser.id, profileFile),
          );
          this.syncCurrentUserProfile(uploadResponse.data);
        }

        this.actionMessage.set('User created successfully.');
      } else {
        const user = this.selectedUser();
        if (!user) {
          return;
        }

        const response = await firstValueFrom(
          this.adminApi.updateUser(user.id, {
            fullName: fullName.trim(),
            email: email.trim() || undefined,
            role,
            isActive,
          }),
        );

        let updatedUser = response.data;
        const profileFile = this.pendingProfileFile();
        if (profileFile) {
          const uploadResponse = await firstValueFrom(
            this.adminApi.uploadUserProfileImage(user.id, profileFile),
          );
          updatedUser = uploadResponse.data;
        }

        this.syncCurrentUserProfile(updatedUser);
        this.actionMessage.set('User updated successfully.');
      }

      this.closeForm();
      await this.load();
    } catch {
      this.formError.set('Unable to save user. Check the details and try again.');
    } finally {
      this.saving.set(false);
    }
  }

  async submitPasswordForm(): Promise<void> {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.passwordForm.getRawValue();
    if (password !== confirmPassword) {
      this.passwordError.set('Passwords do not match.');
      return;
    }

    const user = this.selectedUser();
    if (!user) {
      return;
    }

    this.passwordSaving.set(true);
    this.passwordError.set('');

    try {
      await firstValueFrom(this.adminApi.changeUserPassword(user.id, password));
      this.actionMessage.set('Password updated successfully.');
      this.closePasswordForm();
    } catch {
      this.passwordError.set('Unable to update password.');
    } finally {
      this.passwordSaving.set(false);
    }
  }

  async deactivateUser(user: AdminUser): Promise<void> {
    if (!user.isActive) {
      return;
    }

    const currentUser = this.adminAuth.getStoredUser();
    if (currentUser?.id === user.id && currentUser?.source === user.source) {
      this.actionMessage.set('You cannot deactivate your own account.');
      return;
    }

    if (!confirm(`Deactivate ${user.fullName}? They will no longer be able to sign in.`)) {
      return;
    }

    try {
      await firstValueFrom(this.adminApi.deactivateUser(user.id));
      this.actionMessage.set(`${user.fullName} was deactivated.`);
      await this.load();
    } catch {
      this.actionMessage.set('Unable to deactivate user.');
    }
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString();
  }

  isCurrentUser(user: AdminUser): boolean {
    const currentUser = this.adminAuth.getStoredUser();
    return currentUser?.id === user.id && currentUser?.source === user.source;
  }

  profileImageFor(user: AdminUser): string | null {
    return this.adminApi.resolveProfileImageUrl(user.profileImageUrl);
  }

  profilePreview(): string | null {
    return this.profilePreviewUrl();
  }

  userInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return 'U';
    }

    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
  }

  private syncCurrentUserProfile(user: AdminUser): void {
    const currentUser = this.adminAuth.getStoredUser();
    if (
      !currentUser ||
      currentUser.id !== user.id ||
      currentUser.source !== user.source
    ) {
      return;
    }

    const updatedUser = {
      ...currentUser,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      profileImageUrl: user.profileImageUrl,
    };

    const rememberMe = Boolean(localStorage.getItem('pcmazing-admin-access-token'));
    this.adminAuth.updateStoredUser(updatedUser, rememberMe);
  }
}
