import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  PayrollCommissionType,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-settings-payroll-page',
  imports: [FormsModule],
  templateUrl: './settings-payroll-page.component.html',
})
export class SettingsPayrollPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly commissionTypes = signal<PayrollCommissionType[]>([]);
  readonly commissionTypeName = signal('');
  readonly editingCommissionTypeId = signal<number | null>(null);

  ngOnInit(): void {
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.listPayrollCommissionTypes());
      this.commissionTypes.set(response.data);
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to load payroll settings.'));
    } finally {
      this.loading.set(false);
    }
  }

  async saveCommissionType(): Promise<void> {
    const name = this.commissionTypeName().trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      const id = this.editingCommissionTypeId();
      if (id == null) {
        await firstValueFrom(this.adminApi.createPayrollCommissionType({ name }));
      } else {
        await firstValueFrom(this.adminApi.updatePayrollCommissionType(id, { name }));
      }
      this.commissionTypeName.set('');
      this.editingCommissionTypeId.set(null);
      await this.reload();
      this.success.set('Commission type saved.');
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to save commission type.'));
    } finally {
      this.saving.set(false);
    }
  }

  editCommissionType(item: PayrollCommissionType): void {
    this.editingCommissionTypeId.set(item.id);
    this.commissionTypeName.set(item.name);
    this.success.set('');
  }

  cancelEdit(): void {
    this.editingCommissionTypeId.set(null);
    this.commissionTypeName.set('');
  }

  async toggleCommissionType(item: PayrollCommissionType): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    try {
      await firstValueFrom(
        this.adminApi.updatePayrollCommissionType(item.id, { isActive: !item.isActive }),
      );
      await this.reload();
      this.success.set(`Commission type ${item.isActive ? 'disabled' : 'enabled'}.`);
    } catch (err) {
      this.error.set(this.readError(err, 'Unable to update commission type.'));
    } finally {
      this.saving.set(false);
    }
  }

  private readError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string } })?.error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }
}
