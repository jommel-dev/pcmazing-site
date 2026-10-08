import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AdminPermissionGroup,
  AdminRoleRecord,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-settings-roles-page',
  imports: [FormsModule],
  templateUrl: './settings-roles-page.component.html',
})
export class SettingsRolesPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly roles = signal<AdminRoleRecord[]>([]);
  readonly catalog = signal<AdminPermissionGroup[]>([]);
  readonly selectedId = signal<number | null>(null);
  readonly draftName = signal('');
  readonly draftActive = signal(true);
  readonly draftKeys = signal<Set<string>>(new Set());
  readonly creating = signal(false);

  readonly selected = computed(() =>
    this.roles().find((role) => role.id === this.selectedId()) ?? null,
  );

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [rolesRes, catalogRes] = await Promise.all([
        firstValueFrom(this.adminApi.listAdminRoles()),
        firstValueFrom(this.adminApi.getPermissionCatalog()),
      ]);
      this.roles.set(rolesRes.data ?? []);
      this.catalog.set(catalogRes.data ?? []);
      const current = this.selectedId();
      if (current == null || !this.roles().some((role) => role.id === current)) {
        this.selectRole(this.roles()[0] ?? null);
      } else {
        this.selectRole(this.roles().find((role) => role.id === current) ?? null);
      }
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to load roles.'));
    } finally {
      this.loading.set(false);
    }
  }

  selectRole(role: AdminRoleRecord | null): void {
    this.creating.set(false);
    this.success.set('');
    this.error.set('');
    if (!role) {
      this.selectedId.set(null);
      this.draftName.set('');
      this.draftActive.set(true);
      this.draftKeys.set(new Set());
      return;
    }
    this.selectedId.set(role.id);
    this.draftName.set(role.name);
    this.draftActive.set(role.isActive);
    this.draftKeys.set(new Set(role.permissionKeys));
  }

  startCreate(): void {
    this.creating.set(true);
    this.selectedId.set(null);
    this.draftName.set('');
    this.draftActive.set(true);
    this.draftKeys.set(new Set(['profile.view']));
    this.success.set('');
    this.error.set('');
  }

  toggleKey(key: string, checked: boolean): void {
    const next = new Set(this.draftKeys());
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.draftKeys.set(next);
  }

  isChecked(key: string): boolean {
    return this.draftKeys().has(key);
  }

  async save(): Promise<void> {
    const name = this.draftName().trim();
    if (name.length < 2) {
      this.error.set('Role name must be at least 2 characters.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const permissionKeys = [...this.draftKeys()];
      if (this.creating()) {
        const created = await firstValueFrom(
          this.adminApi.createAdminRole({ name, permissionKeys }),
        );
        this.success.set('Role created.');
        await this.reload();
        this.selectRole(created.data);
      } else {
        const id = this.selectedId();
        if (id == null) {
          return;
        }
        const updated = await firstValueFrom(
          this.adminApi.updateAdminRole(id, {
            name,
            isActive: this.draftActive(),
            permissionKeys,
          }),
        );
        this.success.set('Role updated.');
        await this.reload();
        this.selectRole(updated.data);
      }
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to save role.'));
    } finally {
      this.saving.set(false);
    }
  }

  async softDelete(): Promise<void> {
    const role = this.selected();
    if (!role || role.isSystem) {
      return;
    }
    if (!confirm(`Soft delete role "${role.name}"? Users must be reassigned first.`)) {
      return;
    }
    this.saving.set(true);
    this.error.set('');
    try {
      await firstValueFrom(this.adminApi.softDeleteAdminRole(role.id));
      this.success.set('Role soft deleted.');
      await this.reload();
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to soft delete role.'));
    } finally {
      this.saving.set(false);
    }
  }

  private readError(err: unknown, fallback: string): string {
    if (
      typeof err === 'object' &&
      err &&
      'error' in err &&
      typeof (err as { error?: { message?: string } }).error?.message === 'string'
    ) {
      return (err as { error: { message: string } }).error.message;
    }
    return fallback;
  }
}
