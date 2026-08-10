import { DecimalPipe, NgClass } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AdminUser,
  CreateInventoryServicePayload,
  MaterialItem,
  ServiceTypeItem,
} from '../../services/admin-api.service';
import {
  applyPhSpecialDiscount,
  normalizePhDiscountType,
  type PhDiscountType,
} from './ph-discount.util';

const DEFAULT_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done'];
const DISCOUNT_OPTIONS: Array<{ value: PhDiscountType; label: string }> = [
  { value: 'none', label: 'No discount' },
  { value: 'senior', label: 'Senior Citizen (20%)' },
  { value: 'pwd', label: 'PWD (20%)' },
];

@Component({
  selector: 'app-inventory-service-create-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, NgClass],
  templateUrl: './inventory-service-create-page.component.html',
})
export class InventoryServiceCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = DEFAULT_STATUSES;
  readonly discountOptions = DISCOUNT_OPTIONS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly users = signal<AdminUser[]>([]);
  readonly materials = signal<MaterialItem[]>([]);
  readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  readonly partQueries = signal<string[]>([]);
  readonly materialSearchResults = signal<Record<number, MaterialItem[]>>({});
  readonly openPartSearchIndex = signal<number | null>(null);
  readonly partSearchLoading = signal(false);
  private materialSearchTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private partSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly serviceId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.serviceId() !== null);
  readonly pendingDelete = signal(false);
  readonly deleting = signal(false);
  readonly referenceNo = signal<string | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly completionUploading = signal(false);
  readonly isMobileDevice = signal(false);
  readonly selectedStatus = signal<string>('Active');
  readonly loadedStatus = signal<string>('Active');
  readonly markingDone = signal(false);
  private persistedImageUrl: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    customerName: ['', [Validators.required, Validators.maxLength(180)]],
    serviceName: ['', [Validators.required, Validators.maxLength(180)]],
    personInChargeUserId: [''],
    type: ['', [Validators.required, Validators.maxLength(120)]],
    cost: [0, [Validators.min(0)]],
    labor: [0, [Validators.min(0)]],
    laborDiscountType: ['none' as PhDiscountType],
    status: ['Active', [Validators.required, Validators.maxLength(60)]],
    startedAt: [''],
    endedAt: [''],
    notes: ['', [Validators.maxLength(2000)]],
    parts: this.formBuilder.array([]),
    customParts: this.formBuilder.array([]),
  });

  readonly totalSelectedParts = computed(() => this.partsArray.controls.length);
  readonly totalCustomParts = computed(() => this.customPartsArray.controls.length);
  readonly completionImageSrc = computed(() =>
    this.adminApi.resolveServiceImageUrl(this.imageUrl()),
  );
  readonly statusSelectClass = computed(() => this.statusPillClass(this.selectedStatus()));

  ngOnInit(): void {
    this.isMobileDevice.set(this.detectMobileDevice());
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        const nextStatus = this.normalizeJobStatus(status);
        this.selectedStatus.set(nextStatus);
        if (this.normalizeJobStatus(this.loadedStatus()) === 'Done' && nextStatus !== 'Done') {
          this.imageUrl.set(null);
        } else if (nextStatus === 'Done') {
          this.imageUrl.set(this.persistedImageUrl);
        }
      });
    void this.initialize();
  }

  private detectMobileDevice(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    return coarsePointer || mobileUa;
  }

  normalizeJobStatus(status: string | null | undefined): string {
    const value = String(status ?? '').trim().toLowerCase();
    const match = this.statuses.find((option) => option.toLowerCase() === value);
    return match ?? 'Active';
  }

  statusPillClass(status: string | null | undefined): string {
    switch (this.normalizeJobStatus(status).toLowerCase()) {
      case 'done':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 border-blue-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 border-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 border-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200 border-red-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 border-slate-200';
    }
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

      const [usersResponse, materialsResponse, typesResponse, serviceResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listUsers(1, 100, '')),
        firstValueFrom(this.adminApi.listMaterials(1, 100, '')),
        firstValueFrom(this.adminApi.listServiceTypes(true)),
        this.serviceId()
          ? firstValueFrom(this.adminApi.getInventoryService(this.serviceId()!))
          : Promise.resolve(null),
      ]);
      this.users.set(usersResponse.data);
      this.materials.set(materialsResponse.data.map((item) => this.normalizeMaterial(item)));
      let types = typesResponse.data;
      if (serviceResponse?.data) {
        const item = serviceResponse.data;
        if (item.type && !types.some((type) => type.name === item.type)) {
          types = [
            {
              id: 0,
              name: item.type,
              description: null,
              laborPrice: 0,
              usageCount: 0,
              totalLaborCollected: 0,
              isActive: false,
              updatedAt: null,
            },
            ...types,
          ];
        }
        this.serviceTypes.set(types);
        this.referenceNo.set(item.referenceNo ?? null);
        this.persistedImageUrl = item.imageUrl ?? null;
        this.imageUrl.set(item.imageUrl ?? null);
        const normalizedStatus = this.normalizeJobStatus(item.status);
        this.loadedStatus.set(normalizedStatus);
        this.selectedStatus.set(normalizedStatus);
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
          laborDiscountType: normalizePhDiscountType(item.laborDiscountType),
          status: normalizedStatus,
          startedAt: item.startedAt ?? '',
          endedAt: item.endedAt ?? '',
          notes: item.notes ?? '',
        });
        this.partsArray.clear();
        this.customPartsArray.clear();
        this.partQueries.set([]);
        for (const part of item.parts ?? []) {
          if (part.materialId) {
            const materialId = Number(part.materialId);
            if (
              Number.isFinite(materialId) &&
              materialId > 0 &&
              !this.materials().some((entry) => Number(entry.id) === materialId)
            ) {
              try {
                const materialResponse = await firstValueFrom(this.adminApi.getMaterial(materialId));
                this.upsertMaterials([materialResponse.data]);
              } catch {
                // Keep going even if one linked material cannot be loaded.
              }
            }
            this.addPartRow(
              String(part.materialId),
              part.quantity || 1,
              part.unitPrice ?? this.resolveMaterialUnitPrice(
                this.materials().find((entry) => Number(entry.id) === materialId),
              ),
              part.materialName ?? '',
              normalizePhDiscountType(part.discountType),
            );
          } else if (part.customItemName) {
            this.customPartsArray.push(
              this.formBuilder.nonNullable.group({
                customItemName: [part.customItemName],
                quantity: [part.quantity || 1, [Validators.required, Validators.min(0.01)]],
                unitPrice: [part.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
                labor: [part.labor ?? 0, [Validators.min(0)]],
                discountType: [normalizePhDiscountType(part.discountType)],
              }),
            );
          }
        }
      } else {
        this.serviceTypes.set(types);
      }
      this.syncCostWithParts();
    } catch {
      this.error.set('Unable to load service form options.');
    } finally {
      this.loading.set(false);
    }
  }

  onServiceTypeChange(): void {
    const typeName = this.form.controls.type.value;
    const match = this.serviceTypes().find((type) => type.name === typeName);
    if (!match) {
      return;
    }
    this.form.controls.labor.setValue(Number(match.laborPrice) || 0);
  }

  addPart(): void {
    this.addPartRow();
  }

  private addPartRow(
    materialId = '',
    quantity = 1,
    unitPrice = 0,
    label = '',
    discountType: PhDiscountType = 'none',
  ): void {
    this.partsArray.push(
      this.formBuilder.nonNullable.group({
        materialId: [materialId],
        quantity: [quantity, [Validators.required, Validators.min(0.01)]],
        unitPrice: [unitPrice, [Validators.min(0)]],
        discountType: [discountType],
      }),
    );
    this.partQueries.update((items) => [...items, label]);
    this.syncCostWithParts();
  }

  removePart(index: number): void {
    this.partsArray.removeAt(index);
    this.partQueries.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.materialSearchResults.update((current) => {
      const next: Record<number, MaterialItem[]> = {};
      for (const [key, value] of Object.entries(current)) {
        const oldIndex = Number(key);
        if (oldIndex < index) {
          next[oldIndex] = value;
        } else if (oldIndex > index) {
          next[oldIndex - 1] = value;
        }
      }
      return next;
    });
    if (this.openPartSearchIndex() === index) {
      this.openPartSearchIndex.set(null);
    } else {
      const openIndex = this.openPartSearchIndex();
      if (openIndex != null && openIndex > index) {
        this.openPartSearchIndex.set(openIndex - 1);
      }
    }
    this.syncCostWithParts();
  }

  addCustomPart(): void {
    this.customPartsArray.push(
      this.formBuilder.nonNullable.group({
        customItemName: [''],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        labor: [0, [Validators.min(0)]],
        discountType: ['none' as PhDiscountType],
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
    return this.materials().find((item) => Number(item.id) === id)?.materialName ?? 'Unknown material';
  }

  materialLabel(item: MaterialItem): string {
    const price = this.resolveMaterialUnitPrice(item);
    const priceLabel = price > 0 ? ` — ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
    return `${item.materialName}${priceLabel}`;
  }

  private normalizeMaterial(item: MaterialItem): MaterialItem {
    return {
      ...item,
      id: Number(item.id),
      unitPrice: item.unitPrice == null ? null : Number(item.unitPrice),
      orderCost: item.orderCost == null ? null : Number(item.orderCost),
      sellPrice: item.sellPrice == null ? null : Number(item.sellPrice),
    };
  }

  private upsertMaterials(items: MaterialItem[]): void {
    const byId = new Map(this.materials().map((item) => [Number(item.id), item]));
    for (const item of items) {
      const normalized = this.normalizeMaterial(item);
      byId.set(normalized.id, normalized);
    }
    this.materials.set([...byId.values()]);
  }

  resolveMaterialUnitPrice(item: MaterialItem | undefined | null): number {
    if (!item) {
      return 0;
    }
    // Customer-facing unit price: prefer sell/SRP, then fall back to other price fields.
    const candidates = [item.sellPrice, item.unitPrice, item.orderCost];
    for (const value of candidates) {
      if (value != null && Number.isFinite(Number(value)) && Number(value) > 0) {
        return Number(value);
      }
    }
    return 0;
  }

  partQuery(index: number): string {
    return this.partQueries()[index] ?? '';
  }

  selectedMaterialIds(exceptIndex?: number): Set<number> {
    return new Set(
      this.partsArray.controls
        .map((control, controlIndex) =>
          controlIndex === exceptIndex
            ? null
            : Number((control.getRawValue() as { materialId: string }).materialId),
        )
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    );
  }

  openPartSearch(index: number): void {
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    this.openPartSearchIndex.set(index);
    void this.searchMaterialsForPart(index, this.partQuery(index));
  }

  scheduleClosePartSearch(): void {
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
    }
    this.partSearchCloseTimer = setTimeout(() => {
      this.openPartSearchIndex.set(null);
      this.partSearchCloseTimer = null;
    }, 150);
  }

  onPartQueryInput(index: number, value: string): void {
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = value;
      return next;
    });

    const group = this.partsArray.at(index);
    if (group) {
      const { materialId } = group.getRawValue() as { materialId: string };
      if (materialId) {
        const selectedName = this.materialName(materialId);
        if (value.trim() !== selectedName) {
          group.patchValue({ materialId: '', unitPrice: 0 }, { emitEvent: false });
          this.syncCostWithParts();
        }
      }
    }

    this.openPartSearchIndex.set(index);
    this.scheduleMaterialSearch(index, value);
  }

  private scheduleMaterialSearch(index: number, value: string): void {
    const existing = this.materialSearchTimers.get(index);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      void this.searchMaterialsForPart(index, value);
    }, 250);
    this.materialSearchTimers.set(index, timer);
  }

  private async searchMaterialsForPart(index: number, value: string): Promise<void> {
    const query = value.trim();
    this.partSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.listMaterials(1, 100, query));
      const results = response.data.map((item) => this.normalizeMaterial(item));
      this.upsertMaterials(results);
      this.materialSearchResults.update((current) => ({
        ...current,
        [index]: results,
      }));
    } catch {
      // Keep existing local materials if search fails.
    } finally {
      this.partSearchLoading.set(false);
    }
  }

  selectPartMaterial(index: number, item: MaterialItem): void {
    const group = this.partsArray.at(index);
    if (!group) {
      return;
    }

    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }

    const unitPrice = this.resolveMaterialUnitPrice(item);
    group.patchValue(
      {
        materialId: String(item.id),
        unitPrice,
      },
      { emitEvent: false },
    );
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = item.materialName;
      return next;
    });
    this.openPartSearchIndex.set(null);
    this.syncCostWithParts();
  }

  onPartSuggestionPointerDown(event: Event, index: number, item: MaterialItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectPartMaterial(index, item);
  }

  clearPartMaterial(index: number): void {
    const group = this.partsArray.at(index);
    if (!group) {
      return;
    }
    group.patchValue({ materialId: '', unitPrice: 0 }, { emitEvent: false });
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = '';
      return next;
    });
    this.openPartSearch(index);
    this.syncCostWithParts();
  }

  filteredMaterials(index: number): MaterialItem[] {
    const query = this.partQuery(index).trim().toLowerCase();
    const currentId = Number(
      (this.partsArray.at(index)?.getRawValue() as { materialId: string })?.materialId,
    );
    const selectedIds = this.selectedMaterialIds(index);
    const searched = this.materialSearchResults()[index];
    const source =
      searched ??
      this.materials().filter(
        (item) =>
          Number(item.id) === currentId ||
          !query ||
          item.materialName.toLowerCase().includes(query) ||
          (item.materialCode ?? '').toLowerCase().includes(query),
      );

    return source
      .filter((item) => {
        const id = Number(item.id);
        if (selectedIds.has(id)) {
          return false;
        }
        if (Number.isFinite(currentId) && currentId > 0 && id === currentId) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          item.materialName.toLowerCase().includes(query) ||
          (item.materialCode ?? '').toLowerCase().includes(query) ||
          (item.brandName ?? '').toLowerCase().includes(query)
        );
      })
      .slice(0, 25);
  }

  partUnitAmount(materialId: string): number {
    const id = Number(materialId);
    const item = this.materials().find((entry) => Number(entry.id) === id);
    return this.resolveMaterialUnitPrice(item);
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

  partDiscountType(index: number): PhDiscountType {
    const group = this.partsArray.at(index);
    if (!group) {
      return 'none';
    }
    return normalizePhDiscountType(
      (group.getRawValue() as { discountType?: string }).discountType,
    );
  }

  partNetAmount(index: number): number {
    return applyPhSpecialDiscount(this.partSubtotal(index), this.partDiscountType(index)).net;
  }

  partDiscountAmount(index: number): number {
    return applyPhSpecialDiscount(this.partSubtotal(index), this.partDiscountType(index))
      .discountAmount;
  }

  customPartSubtotal(index: number): number {
    const group = this.customPartsArray.at(index);
    if (!group) {
      return 0;
    }

    const { quantity, unitPrice } = group.getRawValue() as { quantity: number | string; unitPrice: number | string };
    return (Number(quantity) || 0) * (Number(unitPrice) || 0);
  }

  customPartLabor(index: number): number {
    const group = this.customPartsArray.at(index);
    if (!group) {
      return 0;
    }

    const { labor } = group.getRawValue() as { labor: number | string };
    return Number(labor) || 0;
  }

  customPartGross(index: number): number {
    return this.customPartSubtotal(index) + this.customPartLabor(index);
  }

  customPartDiscountType(index: number): PhDiscountType {
    const group = this.customPartsArray.at(index);
    if (!group) {
      return 'none';
    }
    return normalizePhDiscountType(
      (group.getRawValue() as { discountType?: string }).discountType,
    );
  }

  customPartNetAmount(index: number): number {
    return applyPhSpecialDiscount(this.customPartGross(index), this.customPartDiscountType(index))
      .net;
  }

  customPartDiscountAmount(index: number): number {
    return applyPhSpecialDiscount(this.customPartGross(index), this.customPartDiscountType(index))
      .discountAmount;
  }

  customLaborTotal(): number {
    return this.customPartsArray.controls.reduce(
      (total, _, index) => total + this.customPartLabor(index),
      0,
    );
  }

  totalLabor(): number {
    return (Number(this.form.controls.labor.value) || 0) + this.customLaborTotal();
  }

  laborDiscountType(): PhDiscountType {
    return normalizePhDiscountType(this.form.controls.laborDiscountType.value);
  }

  serviceLaborGross(): number {
    return Number(this.form.controls.labor.value) || 0;
  }

  serviceLaborNet(): number {
    return applyPhSpecialDiscount(this.serviceLaborGross(), this.laborDiscountType()).net;
  }

  serviceLaborDiscountAmount(): number {
    return applyPhSpecialDiscount(this.serviceLaborGross(), this.laborDiscountType())
      .discountAmount;
  }

  partsSubtotal(): number {
    const inventoryTotal = this.partsArray.controls.reduce((total, _, index) => total + this.partSubtotal(index), 0);
    const customTotal = this.customPartsArray.controls.reduce(
      (total, _, index) => total + this.customPartSubtotal(index),
      0,
    );

    return inventoryTotal + customTotal;
  }

  partsNetSubtotal(): number {
    const inventoryTotal = this.partsArray.controls.reduce(
      (total, _, index) => total + this.partNetAmount(index),
      0,
    );
    const customTotal = this.customPartsArray.controls.reduce(
      (total, _, index) => total + this.customPartNetAmount(index),
      0,
    );
    return inventoryTotal + customTotal;
  }

  totalDiscountAmount(): number {
    const inventoryDiscount = this.partsArray.controls.reduce(
      (total, _, index) => total + this.partDiscountAmount(index),
      0,
    );
    const customDiscount = this.customPartsArray.controls.reduce(
      (total, _, index) => total + this.customPartDiscountAmount(index),
      0,
    );
    return inventoryDiscount + customDiscount + this.serviceLaborDiscountAmount();
  }

  totalLaborNet(): number {
    return this.serviceLaborNet();
  }

  totalCustomerPayment(): number {
    return this.partsNetSubtotal() + this.serviceLaborNet();
  }

  syncCostWithParts(): void {
    this.form.controls.cost.setValue(Number(this.partsSubtotal().toFixed(2)), { emitEvent: false });
  }

  private buildPayload(
    statusOverride?: string,
  ): { payload: CreateInventoryServicePayload } | { error: string } {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return { error: 'Please fill in the required fields.' };
    }

    const value = this.form.getRawValue();
    const [personIdRaw, personSourceRaw] = value.personInChargeUserId.split('|');
    const personInChargeUserId = Number(personIdRaw);
    const personInChargeSource =
      personSourceRaw === 'pcmazing_admin_users' ? 'pcmazing_admin_users' : 'tblusers';
    const startedAt = value.startedAt ? new Date(value.startedAt) : null;
    const endedAt = value.endedAt ? new Date(value.endedAt) : null;

    if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime()) {
      return { error: 'End date/time must be later than the start date/time.' };
    }

    const rawParts = value.parts as Array<{
      materialId: string;
      quantity: number | string;
      unitPrice: number | string;
      discountType?: string;
    }>;
    const inventoryParts = rawParts
      .map((part) => ({
        materialId: Number(part.materialId),
        quantity: Number(part.quantity) || 0,
        unitPrice: Number(part.unitPrice) || 0,
        discountType: normalizePhDiscountType(part.discountType),
      }))
      .filter((part) => Number.isFinite(part.materialId) && part.materialId > 0 && part.quantity > 0);

    const rawCustomParts = value.customParts as Array<{
      customItemName: string;
      quantity: number | string;
      unitPrice: number | string;
      labor: number | string;
      discountType?: string;
    }>;
    const customParts = rawCustomParts
      .map((part) => ({
        customItemName: part.customItemName.trim(),
        quantity: Number(part.quantity) || 0,
        unitPrice: Number(part.unitPrice) || 0,
        labor: Number(part.labor) || 0,
        discountType: normalizePhDiscountType(part.discountType),
      }))
      .filter((part) => part.customItemName && part.quantity > 0);

    const status = this.normalizeJobStatus(statusOverride ?? value.status) || 'Active';

    return {
      payload: {
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
        parts: [...inventoryParts, ...customParts],
        cost: Number(value.cost) || 0,
        labor: Number(value.labor) || 0,
        laborDiscountType: normalizePhDiscountType(value.laborDiscountType),
        status,
        startedAt: startedAt ? startedAt.toISOString() : undefined,
        endedAt: endedAt ? endedAt.toISOString() : undefined,
        notes: value.notes.trim() || undefined,
      },
    };
  }

  async submit(): Promise<void> {
    this.formError.set('');

    const built = this.buildPayload();
    if ('error' in built) {
      this.formError.set(built.error);
      return;
    }

    this.saving.set(true);

    try {
      await firstValueFrom(
        this.isEditMode() && this.serviceId()
          ? this.adminApi.updateInventoryService(this.serviceId()!, built.payload)
          : this.adminApi.createInventoryService(built.payload),
      );
      await this.router.navigate(['/admin/job-order']);
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : (msg || 'Unknown error');
      this.formError.set(`Unable to ${this.isEditMode() ? 'update' : 'create'} service: ${detail}`);
    } finally {
      this.saving.set(false);
    }
  }

  requestDelete(): void {
    this.formError.set('');
    this.pendingDelete.set(true);
  }

  cancelDelete(): void {
    if (this.deleting()) {
      return;
    }
    this.pendingDelete.set(false);
  }

  async confirmDelete(): Promise<void> {
    const id = this.serviceId();
    if (!id) {
      return;
    }

    this.deleting.set(true);
    this.formError.set('');

    try {
      await firstValueFrom(this.adminApi.deleteInventoryService(id));
      this.pendingDelete.set(false);
      await this.router.navigate(['/admin/job-order']);
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(`Unable to delete job order: ${detail}`);
      this.pendingDelete.set(false);
    } finally {
      this.deleting.set(false);
    }
  }

  async onCompletionImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    const id = this.serviceId();
    if (!file || !id) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.formError.set('Please choose an image file.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.formError.set('Image must be 2MB or smaller.');
      return;
    }

    this.completionUploading.set(true);
    this.formError.set('');

    try {
      const response = await firstValueFrom(this.adminApi.uploadInventoryServiceImage(id, file));
      this.persistedImageUrl = response.data.imageUrl ?? null;
      this.imageUrl.set(response.data.imageUrl ?? null);
      this.loadedStatus.set('Done');
      if (this.selectedStatus() !== 'Done') {
        this.form.controls.status.setValue('Done');
        this.selectedStatus.set('Done');
      }
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(`Unable to upload completion image: ${detail}`);
    } finally {
      this.completionUploading.set(false);
    }
  }

  async markAsDone(): Promise<void> {
    const id = this.serviceId();
    if (!id || !this.isEditMode() || this.selectedStatus() === 'Done' || this.markingDone()) {
      return;
    }

    this.formError.set('');
    const built = this.buildPayload('Done');
    if ('error' in built) {
      this.formError.set(built.error);
      return;
    }

    this.markingDone.set(true);

    try {
      // Persist discounts and other form edits before opening the receipt.
      const response = await firstValueFrom(
        this.adminApi.updateInventoryService(id, built.payload),
      );
      this.form.controls.status.setValue('Done');
      this.selectedStatus.set('Done');
      this.loadedStatus.set('Done');
      this.persistedImageUrl = response.data.imageUrl ?? this.persistedImageUrl;
      this.imageUrl.set(this.persistedImageUrl);
      await this.router.navigate(['/admin/job-order', id, 'receipt'], {
        queryParams: { print: '1' },
      });
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(`Unable to mark job as Done: ${detail}`);
    } finally {
      this.markingDone.set(false);
    }
  }
}
