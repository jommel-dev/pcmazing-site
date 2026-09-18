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
  readonly viewOpen = signal(false);
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly passwordOpen = signal(false);
  readonly passwordSaving = signal(false);
  readonly passwordError = signal('');
  readonly actionMessage = signal('');
  readonly profilePreviewUrl = signal<string | null>(null);
  readonly pendingProfileFile = signal<File | null>(null);
  readonly qrPreviewUrl = signal<string | null>(null);
  readonly pendingQrFile = signal<File | null>(null);
  readonly qrLightboxUrl = signal<string | null>(null);
  readonly salaryTypeOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'semi_monthly', label: 'Semi-Monthly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'cutoff', label: 'By Cutoff' },
  ] as const;
  readonly payoutMethodOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'online', label: 'Online' },
  ] as const;

  readonly userForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(80)]],
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    email: ['', [Validators.email]],
    role: ['staff', [Validators.required]],
    isActive: [true],
    password: ['', [Validators.minLength(6)]],
    employeeCode: [''],
    department: [''],
    positionTitle: [''],
    salaryType: ['monthly' as 'weekly' | 'semi_monthly' | 'monthly' | 'cutoff'],
    monthlySalary: [''],
    fixedMonthlySalary: [''],
    payoutMethod: ['cash' as 'cash' | 'online'],
    bankDetails: [''],
    payrollEnabled: [false],
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
    this.clearQrSelection();
    this.userForm.enable({ emitEvent: false });
    this.userForm.reset({
      username: '',
      fullName: '',
      email: '',
      role: 'staff',
      isActive: true,
      password: '',
      employeeCode: '',
      department: '',
      positionTitle: '',
      salaryType: 'monthly',
      monthlySalary: '',
      fixedMonthlySalary: '',
      payoutMethod: 'cash',
      bankDetails: '',
      payrollEnabled: false,
    });
    this.userForm.controls.username.enable();
    this.userForm.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  openViewForm(user: AdminUser): void {
    this.selectedUser.set(user);
    this.viewOpen.set(true);
  }

  closeViewForm(): void {
    this.viewOpen.set(false);
    this.qrLightboxUrl.set(null);
  }

  openEditForm(user: AdminUser): void {
    this.viewOpen.set(false);
    this.populateUserForm(user);
    this.formMode.set('edit');
    this.userForm.enable({ emitEvent: false });
    this.userForm.controls.username.disable({ emitEvent: false });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
    this.formOpen.set(true);
  }

  startEditFromView(): void {
    const user = this.selectedUser();
    if (!user) {
      return;
    }
    this.openEditForm(user);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.formError.set('');
    this.userForm.enable({ emitEvent: false });
    this.clearProfileSelection();
    this.clearQrSelection();
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

  onQrImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.formError.set('Please choose a QR or payout image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.formError.set('QR image must be 2MB or smaller.');
      return;
    }

    this.pendingQrFile.set(file);
    this.qrPreviewUrl.set(URL.createObjectURL(file));
    this.formError.set('');
  }

  async removeQrImage(): Promise<void> {
    const user = this.selectedUser();
    if (!user) {
      this.clearQrSelection();
      return;
    }

    if (user.qrImageUrl) {
      try {
        const response = await firstValueFrom(this.adminApi.removeUserPayrollQr(user.id));
        this.selectedUser.set(response.data);
        this.actionMessage.set('Payroll QR image removed.');
        await this.load();
      } catch {
        this.formError.set('Unable to remove payroll QR image.');
        return;
      }
    }

    this.clearQrSelection();
  }

  clearQrSelection(): void {
    const preview = this.qrPreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    this.qrPreviewUrl.set(null);
    this.pendingQrFile.set(null);
  }

  isOnlinePayout(): boolean {
    return this.userForm.controls.payoutMethod.value === 'online';
  }

  salaryTypeLabel(value: string | null | undefined): string {
    return this.salaryTypeOptions.find((option) => option.value === value)?.label || 'Monthly';
  }

  payoutMethodLabel(value: string | null | undefined): string {
    return value === 'online' ? 'Online' : 'Cash';
  }

  formatMoney(value: number | null | undefined): string {
    if (value == null) {
      return '—';
    }
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 2,
    }).format(value);
  }

  displayValue(value: string | null | undefined): string {
    const text = value?.trim();
    return text ? text : '—';
  }

  qrImageFor(user: AdminUser): string | null {
    return this.adminApi.resolveProfileImageUrl(user.qrImageUrl);
  }

  openQrLightbox(url: string, event?: Event): void {
    event?.stopPropagation();
    this.qrLightboxUrl.set(url);
  }

  closeQrLightbox(): void {
    this.qrLightboxUrl.set(null);
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
      this.formError.set('Please fill in the required fields correctly.');
      return;
    }

    this.saving.set(true);
    this.formError.set('');

    const {
      username,
      fullName,
      email,
      role,
      isActive,
      password,
      employeeCode,
      department,
      positionTitle,
      salaryType,
      monthlySalary,
      fixedMonthlySalary,
      payoutMethod,
      bankDetails,
      payrollEnabled,
    } = this.userForm.getRawValue();

    const salaryText = monthlySalary == null ? '' : String(monthlySalary).trim();
    const salaryValue = salaryText === '' ? null : Number(salaryText);
    if (salaryText !== '' && (Number.isNaN(salaryValue) || (salaryValue ?? 0) < 0)) {
      this.formError.set('Salary amount must be a valid number.');
      this.saving.set(false);
      return;
    }

    const fixedText = fixedMonthlySalary == null ? '' : String(fixedMonthlySalary).trim();
    const fixedValue = fixedText === '' ? null : Number(fixedText);
    if (fixedText !== '' && (Number.isNaN(fixedValue) || (fixedValue ?? 0) < 0)) {
      this.formError.set('Fixed monthly salary must be a valid number.');
      this.saving.set(false);
      return;
    }

    const payrollPayload = {
      employeeCode: employeeCode.trim() || undefined,
      department: department.trim() || undefined,
      positionTitle: positionTitle.trim() || undefined,
      salaryType,
      ...(salaryValue == null ? {} : { monthlySalary: salaryValue }),
      fixedMonthlySalary: fixedValue,
      payoutMethod,
      bankDetails: bankDetails.trim() || null,
      payrollEnabled,
    };

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
            ...payrollPayload,
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
        const qrFile = this.pendingQrFile();
        if (qrFile) {
          await firstValueFrom(this.adminApi.uploadUserPayrollQr(createdUser.id, qrFile));
        }

        this.actionMessage.set('User created successfully.');
      } else {
        const user = this.selectedUser();
        if (!user) {
          this.saving.set(false);
          return;
        }

        const response = await firstValueFrom(
          this.adminApi.updateUser(user.id, {
            fullName: fullName.trim(),
            email: email.trim() || undefined,
            role,
            isActive,
            ...payrollPayload,
            monthlySalary: salaryValue,
            fixedMonthlySalary: fixedValue,
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
        const qrFile = this.pendingQrFile();
        if (qrFile) {
          const uploadResponse = await firstValueFrom(
            this.adminApi.uploadUserPayrollQr(user.id, qrFile),
          );
          updatedUser = uploadResponse.data;
        }

        this.syncCurrentUserProfile(updatedUser);
        this.actionMessage.set('User updated successfully.');
      }

      this.closeForm();
      await this.load();
    } catch (error) {
      this.formError.set(this.extractErrorMessage(error, 'Unable to save user. Check the details and try again.'));
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

  qrPreview(): string | null {
    return this.qrPreviewUrl();
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

  private populateUserForm(user: AdminUser): void {
    this.selectedUser.set(user);
    this.formError.set('');
    this.clearProfileSelection();
    this.clearQrSelection();
    this.profilePreviewUrl.set(this.adminApi.resolveProfileImageUrl(user.profileImageUrl));
    this.qrPreviewUrl.set(this.adminApi.resolveProfileImageUrl(user.qrImageUrl));
    this.userForm.reset({
      username: user.username,
      fullName: user.fullName,
      email: user.email ?? '',
      role: user.role,
      isActive: user.isActive,
      password: '',
      employeeCode: user.employeeCode ?? '',
      department: user.department ?? '',
      positionTitle: user.positionTitle ?? '',
      salaryType: user.salaryType ?? 'monthly',
      monthlySalary: user.monthlySalary != null ? String(user.monthlySalary) : '',
      fixedMonthlySalary: user.fixedMonthlySalary != null ? String(user.fixedMonthlySalary) : '',
      payoutMethod: user.payoutMethod ?? 'cash',
      bankDetails: user.bankDetails ?? '',
      payrollEnabled: user.payrollEnabled ?? false,
    });
    this.userForm.controls.password.clearValidators();
    this.userForm.controls.password.updateValueAndValidity();
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

  private extractErrorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const payload = (error as { error?: { message?: string | string[] } }).error;

      if (Array.isArray(payload?.message)) {
        const joined = payload.message.join(', ').trim();
        if (joined) {
          return joined;
        }
      }

      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message.trim();
      }
    }

    return fallback;
  }
}
