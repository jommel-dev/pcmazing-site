import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AdminUser,
  CreateInventoryServicePayload,
  MaterialItem,
} from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';

const DEFAULT_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done'];

@Component({
  selector: 'app-inventory-service-create-page',
  imports: [ReactiveFormsModule, RouterLink, InventorySubnavComponent, DecimalPipe],
  templateUrl: './inventory-service-create-page.component.html',
})
export class InventoryServiceCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly statuses = DEFAULT_STATUSES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly users = signal<AdminUser[]>([]);
  readonly materials = signal<MaterialItem[]>([]);
  readonly partQueries = signal<string[]>([]);
  readonly serviceId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.serviceId() !== null);

  readonly form = this.formBuilder.nonNullable.group({
    customerName: ['', [Validators.required, Validators.maxLength(180)]],
    serviceName: ['', [Validators.required, Validators.maxLength(180)]],
    personInChargeUserId: [''],
    type: ['', [Validators.required, Validators.maxLength(120)]],
    cost: [0, [Validators.min(0)]],
    labor: [0, [Validators.min(0)]],
    status: ['Active', [Validators.required, Validators.maxLength(60)]],
    startedAt: [''],
    endedAt: [''],
    notes: ['', [Validators.maxLength(2000)]],
    parts: this.formBuilder.array([]),
    customParts: this.formBuilder.array([]),
  });

  readonly totalSelectedParts = computed(() => this.partsArray.controls.length);
  readonly totalCustomParts = computed(() => this.customPartsArray.controls.length);

  ngOnInit(): void {
    void this.initialize();
  }

  get partsArray(): FormArray {
    return this.form.controls.parts;
  }

  get customPartsArray(): FormArray {
    return this.form.controls.customParts;
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const routeId = Number(this.route.snapshot.paramMap.get('id'));
      this.serviceId.set(Number.isFinite(routeId) && routeId > 0 ? routeId : null);

      const [usersResponse, materialsResponse, serviceResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listUsers(1, 100, '')),
        firstValueFrom(this.adminApi.listMaterials(1, 100, '')),
        this.serviceId()
          ? firstValueFrom(this.adminApi.getInventoryService(this.serviceId()!))
          : Promise.resolve(null),
      ]);
      this.users.set(usersResponse.data);
      this.materials.set(materialsResponse.data);
      if (serviceResponse?.data) {
        const item = serviceResponse.data;
        this.form.patchValue({
          customerName: item.customerName,
          serviceName: item.serviceName,
          personInChargeUserId:
            item.personInChargeUserId && item.personInChargeSource
              ? `${item.personInChargeUserId}|${item.personInChargeSource}`
              : '',
          type: item.type,
          cost: item.cost ?? 0,
          labor: item.labor ?? 0,
          status: item.status || 'Active',
          startedAt: item.startedAt ?? '',
          endedAt: item.endedAt ?? '',
          notes: item.notes ?? '',
        });
        this.partsArray.clear();
        this.customPartsArray.clear();
        this.partQueries.set([]);
        for (const part of item.parts ?? []) {
          if (part.materialId) {
            this.addPartRow(
              String(part.materialId),
              part.quantity || 1,
              part.unitPrice ?? 0,
              part.materialName ?? '',
            );
          } else if (part.customItemName) {
            this.customPartsArray.push(
              this.formBuilder.nonNullable.group({
                customItemName: [part.customItemName],
                quantity: [part.quantity || 1, [Validators.required, Validators.min(0.01)]],
                unitPrice: [part.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
              }),
            );
          }
        }
      } else {
        this.addCustomPart();
      }
      this.syncCostWithParts();
    } catch {
      this.error.set('Unable to load service form options.');
    } finally {
      this.loading.set(false);
    }
  }

  addPart(): void {
    this.addPartRow();
  }

  private addPartRow(materialId = '', quantity = 1, unitPrice = 0, label = ''): void {
    this.partsArray.push(
      this.formBuilder.nonNullable.group({
        materialId: [materialId],
        quantity: [quantity, [Validators.required, Validators.min(0.01)]],
        unitPrice: [unitPrice, [Validators.min(0)]],
      }),
    );
    this.partQueries.update((items) => [...items, label]);
    this.syncCostWithParts();
  }

  removePart(index: number): void {
    this.partsArray.removeAt(index);
    this.partQueries.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.syncCostWithParts();
  }

  addCustomPart(): void {
    this.customPartsArray.push(
      this.formBuilder.nonNullable.group({
        customItemName: [''],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
      }),
    );
    this.syncCostWithParts();
  }

  removeCustomPart(index: number): void {
    this.customPartsArray.removeAt(index);
    this.syncCostWithParts();
  }

  materialName(materialId: string): string {
    const id = Number(materialId);
    return this.materials().find((item) => item.id === id)?.materialName ?? 'Unknown material';
  }

  partQuery(index: number): string {
    return this.partQueries()[index] ?? '';
  }

  onPartQueryInput(index: number, value: string): void {
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = value;
      return next;
    });
  }

  onPartMaterialChange(index: number): void {
    const group = this.partsArray.at(index);
    if (!group) {
      return;
    }

    const { materialId } = group.getRawValue() as { materialId: string };
    const item = this.materials().find((entry) => entry.id === Number(materialId));
    group.patchValue(
      {
        unitPrice: item?.orderCost ?? item?.unitPrice ?? item?.sellPrice ?? 0,
      },
      { emitEvent: false },
    );
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = item?.materialName ?? '';
      return next;
    });
    this.syncCostWithParts();
  }

  filteredMaterials(index: number): MaterialItem[] {
    const query = this.partQuery(index).trim().toLowerCase();
    const currentId = Number((this.partsArray.at(index)?.getRawValue() as { materialId: string })?.materialId);
    const selectedIds = new Set(
      this.partsArray.controls
        .map((control, controlIndex) =>
          controlIndex === index ? null : Number((control.getRawValue() as { materialId: string }).materialId),
        )
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    );

    const filtered = this.materials()
      .filter((item) => !selectedIds.has(item.id))
      .filter((item) => item.id === currentId || !query || item.materialName.toLowerCase().includes(query));

    return filtered;
  }

  partUnitAmount(materialId: string): number {
    const id = Number(materialId);
    const item = this.materials().find((entry) => entry.id === id);
    if (!item) {
      return 0;
    }

    return item.sellPrice || item.unitPrice || item.orderCost || 0;
  }

  partSubtotal(index: number): number {
    const group = this.partsArray.at(index);
    if (!group) {
      return 0;
    }

    const { quantity, unitPrice } = group.getRawValue() as {
      quantity: number | string;
      unitPrice: number | string;
    };
    return (Number(quantity) || 0) * (Number(unitPrice) || 0);
  }

  customPartSubtotal(index: number): number {
    const group = this.customPartsArray.at(index);
    if (!group) {
      return 0;
    }

    const { quantity, unitPrice } = group.getRawValue() as { quantity: number | string; unitPrice: number | string };
    return (Number(quantity) || 0) * (Number(unitPrice) || 0);
  }

  partsSubtotal(): number {
    const inventoryTotal = this.partsArray.controls.reduce((total, _, index) => total + this.partSubtotal(index), 0);
    const customTotal = this.customPartsArray.controls.reduce(
      (total, _, index) => total + this.customPartSubtotal(index),
      0,
    );

    return inventoryTotal + customTotal;
  }

  totalCustomerPayment(): number {
    return this.partsSubtotal() + (Number(this.form.controls.labor.value) || 0);
  }

  syncCostWithParts(): void {
    this.form.controls.cost.setValue(Number(this.partsSubtotal().toFixed(2)), { emitEvent: false });
  }

  async submit(): Promise<void> {
    this.formError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fill in the required fields.');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      const [personIdRaw, personSourceRaw] = value.personInChargeUserId.split('|');
      const personInChargeUserId = Number(personIdRaw);
      const personInChargeSource =
        personSourceRaw === 'pcmazing_admin_users' ? 'pcmazing_admin_users' : 'tblusers';
      const startedAt = value.startedAt ? new Date(value.startedAt) : null;
      const endedAt = value.endedAt ? new Date(value.endedAt) : null;

      if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
        this.formError.set('End date/time must be later than the start date/time.');
        this.saving.set(false);
        return;
      }

      const rawParts = value.parts as Array<{
        materialId: string;
        quantity: number | string;
        unitPrice: number | string;
      }>;
      const inventoryParts = rawParts
        .map((part) => ({
          materialId: Number(part.materialId),
          quantity: Number(part.quantity) || 0,
          unitPrice: Number(part.unitPrice) || 0,
        }))
        .filter((part) => Number.isFinite(part.materialId) && part.materialId > 0 && part.quantity > 0);

      const rawCustomParts = value.customParts as Array<{
        customItemName: string;
        quantity: number | string;
        unitPrice: number | string;
      }>;
      const customParts = rawCustomParts
        .map((part) => ({
          customItemName: part.customItemName.trim(),
          quantity: Number(part.quantity) || 0,
          unitPrice: Number(part.unitPrice) || 0,
        }))
        .filter((part) => part.customItemName && part.quantity > 0);

      const parts = [...inventoryParts, ...customParts];

      const payload: CreateInventoryServicePayload = {
        customerName: value.customerName.trim(),
        serviceName: value.serviceName.trim(),
        personInChargeUserId:
          Number.isFinite(personInChargeUserId) && personInChargeUserId > 0
            ? personInChargeUserId
            : undefined,
        personInChargeSource:
          Number.isFinite(personInChargeUserId) && personInChargeUserId > 0
            ? personInChargeSource
            : undefined,
        type: value.type.trim(),
        parts,
        cost: Number(value.cost) || 0,
        labor: Number(value.labor) || 0,
        status: value.status.trim() || 'Active',
        startedAt: startedAt ? startedAt.toISOString() : undefined,
        endedAt: endedAt ? endedAt.toISOString() : undefined,
        notes: value.notes.trim() || undefined,
      };
      const response = await firstValueFrom(
        this.isEditMode() && this.serviceId()
          ? this.adminApi.updateInventoryService(this.serviceId()!, payload)
          : this.adminApi.createInventoryService(payload),
      );
      void response;
      await this.router.navigate(['/admin/inventory/services']);
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : (msg || 'Unknown error');
      this.formError.set(`Unable to ${this.isEditMode() ? 'update' : 'create'} service: ${detail}`);
    } finally {
      this.saving.set(false);
    }
  }
}
