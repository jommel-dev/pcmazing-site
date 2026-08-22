import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminApiService,
  AdminUser,
  CreateInventoryServicePayload,
  InventoryServiceItem,
  JobOrderCustomerSuggestion,
  MaterialItem,
  ServiceTypeItem,
} from '../../services/admin-api.service';
import {
  applyLineDiscount,
  applyPhSpecialDiscount,
  normalizePhDiscountType,
} from './ph-discount.util';

const DEFAULT_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done'];
const SETTLEMENT_PAYMENT_METHODS = ['Cash', 'Gcash', 'Bank Transfer'] as const;

@Component({
  selector: 'app-inventory-service-create-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  templateUrl: './inventory-service-create-page.component.html',
})
export class InventoryServiceCreatePageComponent implements OnInit, OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = DEFAULT_STATUSES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly formSuccess = signal('');
  readonly users = signal<AdminUser[]>([]);
  readonly materials = signal<MaterialItem[]>([]);
  readonly serviceTypes = signal<ServiceTypeItem[]>([]);
  readonly partQuery = signal('');
  readonly materialSearchResults = signal<MaterialItem[]>([]);
  readonly openPartSearch = signal(false);
  readonly partSearchLoading = signal(false);
  private materialSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private partSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly customerQuery = signal('');
  readonly customerSearchResults = signal<JobOrderCustomerSuggestion[]>([]);
  readonly openCustomerSearch = signal(false);
  readonly customerSearchLoading = signal(false);
  private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private customerSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly serviceQuery = signal('');
  readonly openServiceSearch = signal(false);
  private serviceSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  readonly pendingPaymentReview = signal(false);
  readonly pendingSettlement = signal(false);
  readonly settlementAmountReceived = signal(0);
  readonly settlementPaymentMethod = signal('');
  readonly settlementError = signal('');
  readonly settlementPaymentMethods = SETTLEMENT_PAYMENT_METHODS;
  readonly serviceId = signal<number | null>(null);
  readonly isEditMode = computed(() => this.serviceId() !== null);
  readonly pendingDelete = signal(false);
  readonly deleting = signal(false);
  readonly referenceNo = signal<string | null>(null);
  readonly imageUrl = signal<string | null>(null);
  readonly laptopImageUploading = signal(false);
  readonly pendingLaptopFile = signal<File | null>(null);
  readonly pendingLaptopPreview = signal<string | null>(null);
  readonly laptopImageFailed = signal(false);
  readonly isMobileDevice = signal(false);
  readonly selectedStatus = signal<string>('Pending');
  readonly loadedStatus = signal<string>('Pending');
  readonly markingDone = signal(false);
  private persistedImageUrl: string | null = null;
  private pendingLaptopObjectUrl: string | null = null;

  readonly form = this.formBuilder.nonNullable.group({
    customerName: ['', [Validators.maxLength(180)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(180)]],
    customerContact: ['', [Validators.maxLength(60)]],
    customerAddress: ['', [Validators.maxLength(2000)]],
    deviceBrand: ['', [Validators.maxLength(120)]],
    deviceModel: ['', [Validators.maxLength(180)]],
    deviceSerial: ['', [Validators.maxLength(120)]],
    serviceName: ['', [Validators.maxLength(180)]],
    personInChargeUserId: [''],
    cost: [0, [Validators.min(0)]],
    customDiscount: [0, [Validators.min(0)]],
    downpayment: [0, [Validators.min(0)]],
    paymentMethod: [''],
    status: ['Pending', [Validators.maxLength(60)]],
    startedAt: [''],
    endedAt: [''],
    notes: ['', [Validators.maxLength(2000)]],
    services: this.formBuilder.array([]),
    parts: this.formBuilder.array([]),
  });

  readonly totalSelectedServices = computed(() => this.servicesArray.controls.length);
  readonly totalSelectedParts = computed(() => this.partsArray.controls.length);
  readonly laptopImageSrc = computed(() => {
    if (this.laptopImageFailed()) {
      return null;
    }
    return this.pendingLaptopPreview() || this.adminApi.resolveServiceImageUrl(this.imageUrl());
  });
  readonly isDoneStatus = computed(() => this.normalizeJobStatus(this.selectedStatus()) === 'Done');

  ngOnInit(): void {
    this.isMobileDevice.set(this.detectMobileDevice());
    this.form.controls.status.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((status) => {
        this.selectedStatus.set(this.normalizeJobStatus(status));
      });
    void this.initialize();
  }

  ngOnDestroy(): void {
    this.revokePendingLaptopPreview();
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
    return match ?? 'Pending';
  }

  get servicesArray(): FormArray {
    return this.form.controls.services;
  }

  get partsArray(): FormArray {
    return this.form.controls.parts;
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
        this.laptopImageFailed.set(false);
        const normalizedStatus = this.normalizeJobStatus(item.status);
        this.loadedStatus.set(normalizedStatus);
        this.selectedStatus.set(normalizedStatus);
        this.form.patchValue({
          customerName: item.customerName,
          customerEmail: item.customerEmail ?? '',
          customerContact: item.customerContact ?? '',
          customerAddress: item.customerAddress ?? '',
          deviceBrand: item.deviceBrand ?? '',
          deviceModel: item.deviceModel ?? '',
          deviceSerial: item.deviceSerial ?? '',
          serviceName: item.serviceName,
          personInChargeUserId:
            item.personInChargeUserId && item.personInChargeSource
              ? `${item.personInChargeUserId}|${item.personInChargeSource}`
              : '',
          cost: item.cost ?? 0,
          customDiscount: item.customDiscount ?? 0,
          downpayment: item.downpayment ?? 0,
          paymentMethod: item.paymentMethod ?? '',
          status: normalizedStatus,
          startedAt: item.startedAt ?? '',
          endedAt: item.endedAt ?? '',
          notes: item.notes ?? '',
        });
        this.customerQuery.set(item.customerName ?? '');
        this.partsArray.clear();
        this.servicesArray.clear();
        this.partQuery.set('');
        this.serviceQuery.set('');
        for (const part of item.parts ?? []) {
          if (part.serviceTypeId) {
            const amount = this.resolveServiceLineAmount(part);
            this.addServiceRow(
              String(part.serviceTypeId),
              part.customItemName ||
                types.find((type) => Number(type.id) === Number(part.serviceTypeId))?.name ||
                'Service',
              amount,
              this.initialDiscountAmount(amount, part.discountAmount, part.discountType),
            );
          } else if (part.materialId) {
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
              this.initialDiscountAmount(
                (part.quantity || 1) * (part.unitPrice ?? 0),
                part.discountAmount,
                part.discountType,
              ),
              part.materialName ?? '',
              false,
              part.brandName ??
                this.materials().find((entry) => Number(entry.id) === materialId)?.brandName ??
                '',
            );
          } else if (part.customItemName) {
            const amount = this.resolveServiceLineAmount(part);
            this.addServiceRow(
              '',
              part.customItemName,
              amount,
              this.initialDiscountAmount(amount, part.discountAmount, part.discountType),
              true,
            );
          }
        }
        if (this.servicesArray.length === 0 && item.type?.trim()) {
          const typeName = item.type.trim();
          const match = types.find((type) => type.name.toLowerCase() === typeName.toLowerCase());
          this.addServiceRow(
            match ? String(match.id) : '',
            typeName,
            item.labor ?? 0,
            this.initialDiscountAmount(item.labor ?? 0, undefined, item.laborDiscountType),
          );
        }
      } else {
        this.serviceTypes.set(types);
        this.assignLoggedInPerson();
      }
      this.syncCostWithParts();
    } catch {
      this.error.set('Unable to load service form options.');
    } finally {
      this.loading.set(false);
    }
  }

  private assignLoggedInPerson(): void {
    const currentUser = this.adminAuth.getStoredUser();
    if (!currentUser?.id) {
      return;
    }

    const alreadyListed = this.users().some(
      (user) => Number(user.id) === Number(currentUser.id) && user.source === currentUser.source,
    );
    if (!alreadyListed) {
      this.users.update((list) => [
        {
          id: currentUser.id,
          username: currentUser.username,
          fullName: currentUser.fullName,
          email: currentUser.email,
          role: currentUser.role,
          profileImageUrl: currentUser.profileImageUrl ?? null,
          isActive: true,
          source: currentUser.source,
          readOnly: false,
          createdAt: '',
          updatedAt: '',
        },
        ...list,
      ]);
    }

    this.form.controls.personInChargeUserId.setValue(`${currentUser.id}|${currentUser.source}`);
  }

  addServiceFromCatalog(type: ServiceTypeItem): void {
    if (this.isDoneStatus()) {
      return;
    }
    const selectedIds = this.selectedServiceTypeIds();
    if (selectedIds.has(Number(type.id))) {
      this.serviceQuery.set('');
      this.openServiceSearch.set(false);
      return;
    }
    this.addServiceRow(String(type.id), type.name, Number(type.laborPrice) || 0);
    this.serviceQuery.set('');
    this.openServiceSearch.set(false);
    this.syncCostWithParts();
  }

  addTypedService(): void {
    if (this.isDoneStatus()) {
      return;
    }
    const name = this.serviceQuery().trim();
    if (!name || !this.canCreateNewService()) {
      const exact = this.exactCatalogMatch();
      if (exact) {
        this.addServiceFromCatalog(exact);
      }
      return;
    }
    this.addServiceRow('', name, 0, 0, true);
    this.serviceQuery.set('');
    this.openServiceSearch.set(false);
    this.syncCostWithParts();
  }

  canCreateNewService(): boolean {
    const name = this.serviceQuery().trim();
    if (!name) {
      return false;
    }
    if (this.selectedServiceNames().has(name.toLowerCase())) {
      return false;
    }
    return !this.serviceTypes().some((type) => type.name.toLowerCase() === name.toLowerCase());
  }

  exactCatalogMatch(): ServiceTypeItem | null {
    const name = this.serviceQuery().trim().toLowerCase();
    if (!name) {
      return null;
    }
    const selectedIds = this.selectedServiceTypeIds();
    return (
      this.serviceTypes().find(
        (type) => type.name.toLowerCase() === name && !selectedIds.has(Number(type.id)),
      ) ?? null
    );
  }

  isNewService(index: number): boolean {
    const group = this.servicesArray.at(index);
    if (!group) {
      return false;
    }
    return Boolean((group.getRawValue() as { isNew?: boolean }).isNew);
  }

  onServiceSearchKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Enter') {
      return;
    }
    keyboard.preventDefault();
    this.addTypedService();
  }

  private addServiceRow(
    serviceTypeId = '',
    name = '',
    labor = 0,
    discountAmount = 0,
    isNew = false,
  ): void {
    this.servicesArray.push(
      this.formBuilder.nonNullable.group({
        serviceTypeId: [serviceTypeId],
        name: [name],
        labor: [labor, [Validators.min(0)]],
        discountAmount: [discountAmount, [Validators.min(0)]],
        isNew: [isNew],
      }),
    );
  }

  removeService(index: number): void {
    if (this.isDoneStatus()) {
      return;
    }
    this.servicesArray.removeAt(index);
    this.syncCostWithParts();
  }

  selectedServiceTypeIds(): Set<number> {
    return new Set(
      this.servicesArray.controls
        .map((control) => Number((control.getRawValue() as { serviceTypeId: string }).serviceTypeId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }

  selectedServiceNames(): Set<string> {
    return new Set(
      this.servicesArray.controls
        .map((control) =>
          String((control.getRawValue() as { name?: string }).name ?? '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
  }

  filteredServiceTypes(): ServiceTypeItem[] {
    const query = this.serviceQuery().trim().toLowerCase();
    const selectedIds = this.selectedServiceTypeIds();
    return this.serviceTypes()
      .filter((type) => {
        if (selectedIds.has(Number(type.id))) {
          return false;
        }
        if (this.selectedServiceNames().has(type.name.toLowerCase())) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          type.name.toLowerCase().includes(query) ||
          (type.description ?? '').toLowerCase().includes(query)
        );
      })
      .slice(0, 25);
  }

  openCatalogServiceSearch(): void {
    if (this.isDoneStatus()) {
      return;
    }
    if (this.serviceSearchCloseTimer) {
      clearTimeout(this.serviceSearchCloseTimer);
      this.serviceSearchCloseTimer = null;
    }
    this.openServiceSearch.set(true);
  }

  scheduleCloseServiceSearch(): void {
    if (this.serviceSearchCloseTimer) {
      clearTimeout(this.serviceSearchCloseTimer);
    }
    this.serviceSearchCloseTimer = setTimeout(() => {
      this.openServiceSearch.set(false);
      this.serviceSearchCloseTimer = null;
    }, 150);
  }

  onServiceQueryInput(value: string): void {
    if (this.isDoneStatus()) {
      return;
    }
    this.serviceQuery.set(value);
    this.openServiceSearch.set(true);
  }

  onServiceSuggestionPointerDown(event: Event, type: ServiceTypeItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.addServiceFromCatalog(type);
  }

  openCustomerLookup(): void {
    if (this.isDoneStatus()) {
      return;
    }
    if (this.customerSearchCloseTimer) {
      clearTimeout(this.customerSearchCloseTimer);
      this.customerSearchCloseTimer = null;
    }
    this.openCustomerSearch.set(true);
    void this.searchCustomers(this.customerQuery());
  }

  scheduleCloseCustomerSearch(): void {
    if (this.customerSearchCloseTimer) {
      clearTimeout(this.customerSearchCloseTimer);
    }
    this.customerSearchCloseTimer = setTimeout(() => {
      this.openCustomerSearch.set(false);
      this.customerSearchCloseTimer = null;
    }, 150);
  }

  onCustomerQueryInput(value: string): void {
    if (this.isDoneStatus()) {
      return;
    }
    this.customerQuery.set(value);
    this.form.controls.customerName.setValue(value);
    this.openCustomerSearch.set(true);
    if (this.customerSearchTimer) {
      clearTimeout(this.customerSearchTimer);
    }
    this.customerSearchTimer = setTimeout(() => {
      void this.searchCustomers(value);
    }, 250);
  }

  private async searchCustomers(value: string): Promise<void> {
    this.customerSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.searchJobOrderCustomers(value));
      this.customerSearchResults.set(response.data ?? []);
    } catch {
      this.customerSearchResults.set([]);
    } finally {
      this.customerSearchLoading.set(false);
    }
  }

  selectCustomer(customer: JobOrderCustomerSuggestion): void {
    this.customerQuery.set(customer.name);
    this.form.patchValue({
      customerName: customer.name,
      customerEmail: customer.email ?? '',
      customerContact: customer.contact ?? '',
      customerAddress: customer.address ?? '',
    });
    this.openCustomerSearch.set(false);
  }

  onCustomerSuggestionPointerDown(event: Event, customer: JobOrderCustomerSuggestion): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCustomer(customer);
  }

  addPartFromCatalog(item: MaterialItem): void {
    if (this.isDoneStatus()) {
      return;
    }
    if (this.selectedMaterialIds().has(Number(item.id))) {
      this.partQuery.set('');
      this.openPartSearch.set(false);
      return;
    }
    const unitPrice = this.resolveMaterialUnitPrice(item);
    this.addPartRow(String(item.id), 1, unitPrice, 0, item.materialName, false, item.brandName ?? '');
    this.partQuery.set('');
    this.openPartSearch.set(false);
    this.syncCostWithParts();
  }

  addTypedPart(): void {
    if (this.isDoneStatus()) {
      return;
    }
    const name = this.partQuery().trim();
    if (!name || !this.canCreateNewPart()) {
      const exact = this.exactMaterialMatch();
      if (exact) {
        this.addPartFromCatalog(exact);
      }
      return;
    }
    this.addPartRow('', 1, 0, 0, name, true);
    this.partQuery.set('');
    this.openPartSearch.set(false);
    this.syncCostWithParts();
  }

  canCreateNewPart(): boolean {
    const name = this.partQuery().trim();
    if (!name) {
      return false;
    }
    if (this.selectedPartNames().has(name.toLowerCase())) {
      return false;
    }
    return !this.materials().some((item) => item.materialName.toLowerCase() === name.toLowerCase());
  }

  exactMaterialMatch(): MaterialItem | null {
    const name = this.partQuery().trim().toLowerCase();
    if (!name) {
      return null;
    }
    const selectedIds = this.selectedMaterialIds();
    return (
      this.materials().find(
        (item) => item.materialName.toLowerCase() === name && !selectedIds.has(Number(item.id)),
      ) ?? null
    );
  }

  onPartSearchKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Enter') {
      return;
    }
    keyboard.preventDefault();
    this.addTypedPart();
  }

  isNewPart(index: number): boolean {
    const group = this.partsArray.at(index);
    if (!group) {
      return false;
    }
    return Boolean((group.getRawValue() as { isNew?: boolean }).isNew);
  }

  partNameAt(index: number): string {
    const group = this.partsArray.at(index);
    if (!group) {
      return 'Unknown material';
    }
    const value = group.getRawValue() as { materialId?: string; customName?: string };
    const customName = String(value.customName ?? '').trim();
    if (customName) {
      return customName;
    }
    return this.materialName(String(value.materialId ?? ''));
  }

  partBrandAt(index: number): string {
    const group = this.partsArray.at(index);
    if (!group) {
      return '';
    }
    return String((group.getRawValue() as { brandName?: string }).brandName ?? '').trim();
  }

  selectedPartNames(): Set<string> {
    return new Set(
      this.partsArray.controls
        .map((_, index) => this.partNameAt(index).trim().toLowerCase())
        .filter((name) => name && name !== 'unknown material'),
    );
  }

  private addPartRow(
    materialId = '',
    quantity = 1,
    unitPrice = 0,
    discountAmount = 0,
    customName = '',
    isNew = false,
    brandName = '',
  ): void {
    this.partsArray.push(
      this.formBuilder.nonNullable.group({
        materialId: [materialId],
        customName: [customName],
        brandName: [String(brandName ?? '').trim()],
        quantity: [quantity, [Validators.min(0)]],
        unitPrice: [unitPrice, [Validators.min(0)]],
        discountAmount: [discountAmount, [Validators.min(0)]],
        isNew: [isNew],
      }),
    );
    this.syncCostWithParts();
  }

  removePart(index: number): void {
    if (this.isDoneStatus()) {
      return;
    }
    this.partsArray.removeAt(index);
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
    const candidates = [item.sellPrice, item.unitPrice, item.orderCost];
    for (const value of candidates) {
      if (value != null && Number.isFinite(Number(value)) && Number(value) > 0) {
        return Number(value);
      }
    }
    return 0;
  }

  selectedMaterialIds(): Set<number> {
    return new Set(
      this.partsArray.controls
        .map((control) => Number((control.getRawValue() as { materialId: string }).materialId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }

  openPartLookup(): void {
    if (this.isDoneStatus()) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    this.openPartSearch.set(true);
    void this.searchMaterials(this.partQuery());
  }

  scheduleClosePartSearch(): void {
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
    }
    this.partSearchCloseTimer = setTimeout(() => {
      this.openPartSearch.set(false);
      this.partSearchCloseTimer = null;
    }, 150);
  }

  onPartQueryInput(value: string): void {
    if (this.isDoneStatus()) {
      return;
    }
    this.partQuery.set(value);
    this.openPartSearch.set(true);
    this.scheduleMaterialSearch(value);
  }

  private scheduleMaterialSearch(value: string): void {
    if (this.materialSearchTimer) {
      clearTimeout(this.materialSearchTimer);
    }
    this.materialSearchTimer = setTimeout(() => {
      void this.searchMaterials(value);
    }, 250);
  }

  private async searchMaterials(value: string): Promise<void> {
    this.partSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.listMaterials(1, 100, value.trim()));
      const results = response.data.map((item) => this.normalizeMaterial(item));
      this.upsertMaterials(results);
      this.materialSearchResults.set(results);
    } catch {
      // Keep existing local materials if search fails.
    } finally {
      this.partSearchLoading.set(false);
    }
  }

  onPartSuggestionPointerDown(event: Event, item: MaterialItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.addPartFromCatalog(item);
  }

  filteredMaterials(): MaterialItem[] {
    const query = this.partQuery().trim().toLowerCase();
    const selectedIds = this.selectedMaterialIds();
    const selectedNames = this.selectedPartNames();
    const source = this.materialSearchResults().length ? this.materialSearchResults() : this.materials();
    return source
      .filter((item) => {
        if (selectedIds.has(Number(item.id))) {
          return false;
        }
        if (selectedNames.has(item.materialName.toLowerCase())) {
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

  partDiscountAmount(index: number): number {
    return applyLineDiscount(this.partSubtotal(index), this.partDiscountInput(index)).discountAmount;
  }

  partDiscountInput(index: number): number {
    const group = this.partsArray.at(index);
    if (!group) {
      return 0;
    }
    return Number((group.getRawValue() as { discountAmount?: number | string }).discountAmount) || 0;
  }

  partNetAmount(index: number): number {
    return applyLineDiscount(this.partSubtotal(index), this.partDiscountInput(index)).net;
  }

  serviceAmount(index: number): number {
    const group = this.servicesArray.at(index);
    if (!group) {
      return 0;
    }
    return Number((group.getRawValue() as { labor: number | string }).labor) || 0;
  }

  serviceDiscountInput(index: number): number {
    const group = this.servicesArray.at(index);
    if (!group) {
      return 0;
    }
    return Number((group.getRawValue() as { discountAmount?: number | string }).discountAmount) || 0;
  }

  serviceNetAmount(index: number): number {
    return applyLineDiscount(this.serviceAmount(index), this.serviceDiscountInput(index)).net;
  }

  serviceDiscountAmount(index: number): number {
    return applyLineDiscount(this.serviceAmount(index), this.serviceDiscountInput(index))
      .discountAmount;
  }

  serviceNameAt(index: number): string {
    const group = this.servicesArray.at(index);
    if (!group) {
      return 'Service';
    }
    return String((group.getRawValue() as { name?: string }).name ?? '').trim() || 'Service';
  }

  totalLabor(): number {
    return this.serviceLaborGross();
  }

  serviceLaborGross(): number {
    return this.servicesArray.controls.reduce(
      (total, _, index) => total + this.serviceAmount(index),
      0,
    );
  }

  serviceLaborNet(): number {
    return this.servicesArray.controls.reduce(
      (total, _, index) => total + this.serviceNetAmount(index),
      0,
    );
  }

  serviceLaborDiscountAmount(): number {
    return this.servicesArray.controls.reduce(
      (total, _, index) => total + this.serviceDiscountAmount(index),
      0,
    );
  }

  partsSubtotal(): number {
    return this.partsArray.controls.reduce((total, _, index) => total + this.partSubtotal(index), 0);
  }

  partsNetSubtotal(): number {
    return this.partsArray.controls.reduce((total, _, index) => total + this.partNetAmount(index), 0);
  }

  totalDiscountAmount(): number {
    const inventoryDiscount = this.partsArray.controls.reduce(
      (total, _, index) => total + this.partDiscountAmount(index),
      0,
    );
    return inventoryDiscount + this.serviceLaborDiscountAmount();
  }

  totalLaborNet(): number {
    return this.serviceLaborNet();
  }

  totalCustomerPayment(): number {
    const customDiscount = Number(this.form.controls.customDiscount.value) || 0;
    return Math.max(0, this.partsNetSubtotal() + this.serviceLaborNet() - customDiscount);
  }

  customDiscountAmount(): number {
    return Number(this.form.controls.customDiscount.value) || 0;
  }

  downpaymentAmount(): number {
    return Math.max(0, Number(this.form.controls.downpayment.value) || 0);
  }

  balanceDueAmount(): number {
    return Math.max(0, this.totalCustomerPayment() - this.downpaymentAmount());
  }

  settlementChangeAmount(): number {
    return Math.max(0, this.settlementAmountReceived() - this.balanceDueAmount());
  }

  canConfirmSettlement(): boolean {
    return (
      this.settlementAmountReceived() + 0.005 >= this.balanceDueAmount() &&
      SETTLEMENT_PAYMENT_METHODS.includes(
        this.settlementPaymentMethod() as (typeof SETTLEMENT_PAYMENT_METHODS)[number],
      )
    );
  }

  onSettlementAmountInput(rawValue: string): void {
    const parsed = Number(rawValue);
    this.settlementAmountReceived.set(Number.isFinite(parsed) ? Math.max(0, parsed) : 0);
    this.settlementError.set('');
  }

  selectSettlementPaymentMethod(method: string): void {
    this.settlementPaymentMethod.set(method);
    this.settlementError.set('');
  }

  private resolveServiceLineAmount(part: {
    quantity?: number | null;
    unitPrice?: number | null;
    labor?: number | null;
  }): number {
    const labor = Number(part.labor) || 0;
    if (labor > 0) {
      return labor;
    }
    return (Number(part.quantity) || 1) * (Number(part.unitPrice) || 0);
  }

  private initialDiscountAmount(
    gross: number,
    storedAmount?: number | null,
    discountType?: string | null,
  ): number {
    const custom = Number(storedAmount) || 0;
    if (custom > 0) {
      return applyLineDiscount(gross, custom).discountAmount;
    }
    return applyPhSpecialDiscount(gross, normalizePhDiscountType(discountType)).discountAmount;
  }

  hasBilledLines(): boolean {
    const hasService = this.servicesArray.controls.some((control) =>
      Boolean(String((control.getRawValue() as { name?: string }).name ?? '').trim()),
    );
    const hasPart = this.partsArray.controls.some((control) => {
      const value = control.getRawValue() as { materialId?: string; customName?: string };
      return Boolean(value.materialId) || Boolean(String(value.customName ?? '').trim());
    });
    return hasService || hasPart;
  }

  syncCostWithParts(): void {
    this.form.controls.cost.setValue(Number(this.partsSubtotal().toFixed(2)), { emitEvent: false });
  }

  private buildPayload(
    statusOverride?: string,
  ): { payload: CreateInventoryServicePayload } | { error: string } {
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

    if (this.form.controls.customerEmail.invalid) {
      return { error: 'Please enter a valid customer email.' };
    }

    const rawParts = value.parts as Array<{
      materialId: string;
      customName?: string;
      brandName?: string;
      quantity: number | string;
      unitPrice: number | string;
      discountAmount?: number | string;
      isNew?: boolean;
    }>;
    const inventoryParts = rawParts
      .map((part) => {
        const materialId = Number(part.materialId);
        const hasCatalogId = Number.isFinite(materialId) && materialId > 0;
        const customName = String(part.customName ?? '').trim();
        const brandName = String(part.brandName ?? '').trim();
        return {
          materialId: hasCatalogId ? materialId : undefined,
          customItemName: customName || undefined,
          brandName: brandName || undefined,
          quantity: Number(part.quantity) || 0,
          unitPrice: Number(part.unitPrice) || 0,
          discountType: 'none' as const,
          discountAmount: Math.max(0, Number(part.discountAmount) || 0),
          createInventoryMaterial: Boolean(part.isNew) || (!hasCatalogId && Boolean(customName)),
        };
      })
      .filter(
        (part) =>
          part.quantity > 0 &&
          (Boolean(part.materialId) || Boolean(part.customItemName)),
      );

    const rawServices = value.services as Array<{
      serviceTypeId: string;
      name: string;
      labor: number | string;
      discountAmount?: number | string;
      isNew?: boolean;
    }>;
    const serviceParts = rawServices
      .map((service) => {
        const serviceTypeId = Number(service.serviceTypeId);
        const hasCatalogId = Number.isFinite(serviceTypeId) && serviceTypeId > 0;
        return {
          serviceTypeId: hasCatalogId ? serviceTypeId : undefined,
          customItemName: service.name.trim(),
          quantity: 1,
          unitPrice: 0,
          labor: Number(service.labor) || 0,
          discountType: 'none' as const,
          discountAmount: Math.max(0, Number(service.discountAmount) || 0),
          createCatalogService: Boolean(service.isNew) || !hasCatalogId,
        };
      })
      .filter((service) => service.customItemName);

    const status = statusOverride
      ? this.normalizeJobStatus(statusOverride)
      : this.isEditMode()
        ? this.normalizeJobStatus(this.loadedStatus())
        : 'Pending';
    const serviceTypeLabel = serviceParts.map((service) => service.customItemName).join(', ');

    return {
      payload: {
        customerName: value.customerName.trim(),
        customerEmail: value.customerEmail.trim() || undefined,
        customerContact: value.customerContact.trim() || undefined,
        customerAddress: value.customerAddress.trim() || undefined,
        deviceBrand: value.deviceBrand.trim() || undefined,
        deviceModel: value.deviceModel.trim() || undefined,
        deviceSerial: value.deviceSerial.trim() || undefined,
        serviceName: value.serviceName.trim(),
        personInChargeUserId:
          Number.isFinite(personInChargeUserId) && personInChargeUserId > 0
            ? personInChargeUserId
            : undefined,
        personInChargeSource:
          Number.isFinite(personInChargeUserId) && personInChargeUserId > 0
            ? personInChargeSource
            : undefined,
        type: serviceTypeLabel,
        parts: [...serviceParts, ...inventoryParts],
        cost: Number(value.cost) || 0,
        labor: 0,
        laborDiscountType: 'none',
        customDiscount: Number(value.customDiscount) || 0,
        downpayment: Math.max(0, Number(value.downpayment) || 0),
        paymentMethod: value.paymentMethod.trim() || undefined,
        status,
        startedAt: startedAt ? startedAt.toISOString() : undefined,
        endedAt: endedAt ? endedAt.toISOString() : undefined,
        notes: value.notes.trim() || undefined,
      },
    };
  }

  requestSubmit(): void {
    this.formError.set('');
    this.formSuccess.set('');

    const built = this.buildPayload();
    if ('error' in built) {
      this.formError.set(built.error);
      return;
    }

    this.pendingPaymentReview.set(true);
  }

  cancelPaymentReview(): void {
    if (this.saving()) {
      return;
    }
    this.pendingPaymentReview.set(false);
  }

  async confirmSubmit(): Promise<void> {
    await this.submit();
  }

  async submit(): Promise<void> {
    this.formError.set('');
    this.formSuccess.set('');

    const built = this.buildPayload();
    if ('error' in built) {
      this.formError.set(built.error);
      return;
    }

    this.saving.set(true);
    const wasCreate = !this.isEditMode();

    try {
      const response = await firstValueFrom(
        wasCreate
          ? this.adminApi.createInventoryService(built.payload)
          : this.adminApi.updateInventoryService(this.serviceId()!, built.payload),
      );

      let saved = response.data;
      if (wasCreate && this.pendingLaptopFile()) {
        try {
          const uploaded = await firstValueFrom(
            this.adminApi.uploadInventoryServiceImage(saved.id, this.pendingLaptopFile()!),
          );
          this.revokePendingLaptopPreview();
          saved = uploaded.data;
        } catch {
          this.applySavedService(saved);
          this.pendingPaymentReview.set(false);
          await this.router.navigate(['/admin/job-order', saved.id, 'edit'], { replaceUrl: true });
          this.formError.set(
            'Job order created, but the laptop photo could not be uploaded. You can add it from this form.',
          );
          return;
        }
      }

      this.applySavedService(saved);
      this.pendingPaymentReview.set(false);

      if (wasCreate) {
        await this.router.navigate(['/admin/job-order', saved.id], { replaceUrl: true });
      }

      this.formSuccess.set(wasCreate ? 'Job order created.' : 'Job order updated.');
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : (msg || 'Unknown error');
      this.formError.set(`Unable to ${this.isEditMode() ? 'update' : 'create'} service: ${detail}`);
    } finally {
      this.saving.set(false);
    }
  }

  private applySavedService(item: InventoryServiceItem): void {
    this.serviceId.set(item.id);
    this.referenceNo.set(item.referenceNo ?? null);
    this.persistedImageUrl = item.imageUrl ?? null;
    this.imageUrl.set(item.imageUrl ?? null);
    const normalizedStatus = this.normalizeJobStatus(item.status);
    this.loadedStatus.set(normalizedStatus);
    this.selectedStatus.set(normalizedStatus);
    this.form.controls.status.setValue(normalizedStatus, { emitEvent: false });
    this.form.patchValue({
      deviceBrand: item.deviceBrand ?? '',
      deviceModel: item.deviceModel ?? '',
      deviceSerial: item.deviceSerial ?? '',
      downpayment: item.downpayment ?? 0,
      paymentMethod: item.paymentMethod ?? '',
    });
    this.syncSavedCatalogServices(item);
    this.syncSavedInventoryParts(item);
  }

  private syncSavedCatalogServices(item: InventoryServiceItem): void {
    const byName = new Map(
      (item.parts ?? [])
        .filter((part) => Number(part.serviceTypeId) > 0 && part.customItemName?.trim())
        .map((part) => [part.customItemName!.trim().toLowerCase(), part]),
    );

    this.servicesArray.controls.forEach((control) => {
      const value = control.getRawValue() as { name: string; serviceTypeId: string };
      const match = byName.get(value.name.trim().toLowerCase());
      if (!match?.serviceTypeId) {
        return;
      }

      control.patchValue({
        serviceTypeId: String(match.serviceTypeId),
        isNew: false,
      });

      if (!this.serviceTypes().some((type) => Number(type.id) === Number(match.serviceTypeId))) {
        this.serviceTypes.update((list) => [
          ...list,
          {
            id: Number(match.serviceTypeId),
            name: match.customItemName || value.name,
            description: null,
            laborPrice: Number(match.unitPrice) || Number(match.labor) || 0,
            usageCount: 0,
            totalLaborCollected: 0,
            isActive: true,
            updatedAt: null,
          },
        ]);
      }
    });
  }

  private syncSavedInventoryParts(item: InventoryServiceItem): void {
    const byName = new Map(
      (item.parts ?? [])
        .filter((part) => Number(part.materialId) > 0)
        .map((part) => [
          (part.customItemName || part.materialName || '').trim().toLowerCase(),
          part,
        ]),
    );

    this.partsArray.controls.forEach((control) => {
      const value = control.getRawValue() as { customName?: string; materialId?: string; brandName?: string };
      if (Number(value.materialId) > 0) {
        return;
      }
      const match = byName.get(String(value.customName ?? '').trim().toLowerCase());
      if (!match?.materialId) {
        return;
      }

      control.patchValue({
        materialId: String(match.materialId),
        isNew: false,
        brandName: String(value.brandName ?? match.brandName ?? '').trim(),
      });

      this.upsertMaterials([
        {
          id: Number(match.materialId),
          materialName: match.materialName || value.customName || 'Part',
          materialCode: match.materialCode ?? null,
          brandName: String(value.brandName ?? match.brandName ?? '').trim() || null,
          productTypeName: 'Non-Inventory',
          unit: 'PCS',
          unitPrice: Number(match.unitPrice) || 0,
          orderCost: 0,
          sellPrice: Number(match.unitPrice) || 0,
          onHandStock: 0,
          reorderLevel: 0,
        },
      ]);
    });
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

  async onLaptopImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
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

    const id = this.serviceId();
    this.formError.set('');

    if (!id) {
      this.setPendingLaptopFile(file);
      return;
    }

    this.laptopImageUploading.set(true);

    try {
      const response = await firstValueFrom(this.adminApi.uploadInventoryServiceImage(id, file));
      this.revokePendingLaptopPreview();
      this.persistedImageUrl = response.data.imageUrl ?? null;
      this.imageUrl.set(response.data.imageUrl ?? null);
      this.laptopImageFailed.set(false);
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      this.formError.set(`Unable to upload laptop photo: ${detail}`);
    } finally {
      this.laptopImageUploading.set(false);
    }
  }

  private setPendingLaptopFile(file: File): void {
    this.revokePendingLaptopPreview();
    this.pendingLaptopFile.set(file);
    const objectUrl = URL.createObjectURL(file);
    this.pendingLaptopObjectUrl = objectUrl;
    this.laptopImageFailed.set(false);
    this.pendingLaptopPreview.set(objectUrl);
  }

  private revokePendingLaptopPreview(): void {
    if (this.pendingLaptopObjectUrl) {
      URL.revokeObjectURL(this.pendingLaptopObjectUrl);
      this.pendingLaptopObjectUrl = null;
    }
    this.pendingLaptopFile.set(null);
    this.pendingLaptopPreview.set(null);
  }

  onLaptopImageError(): void {
    this.laptopImageFailed.set(true);
  }

  openReceipt(): void {
    const id = this.serviceId();
    if (!id || this.normalizeJobStatus(this.selectedStatus()) === 'Cancelled') {
      return;
    }
    void this.router.navigate(['/admin/job-order', id, 'receipt']);
  }

  reprintReceipt(): void {
    const id = this.serviceId();
    if (!id || this.normalizeJobStatus(this.selectedStatus()) === 'Cancelled') {
      return;
    }
    void this.router.navigate(['/admin/job-order', id, 'receipt'], {
      queryParams: { reprint: '1', print: '1' },
    });
  }

  requestMarkAsDone(): void {
    if (!this.isEditMode() || this.selectedStatus() === 'Done' || this.markingDone()) {
      return;
    }

    this.formError.set('');
    this.settlementError.set('');
    this.settlementAmountReceived.set(Number(this.balanceDueAmount().toFixed(2)));
    this.settlementPaymentMethod.set(this.form.controls.paymentMethod.value || '');
    this.pendingSettlement.set(true);
  }

  cancelSettlement(): void {
    if (this.markingDone()) {
      return;
    }
    this.pendingSettlement.set(false);
    this.settlementError.set('');
  }

  async confirmSettlement(): Promise<void> {
    if (!this.settlementPaymentMethod()) {
      this.settlementError.set('Please select a payment method.');
      return;
    }

    if (!this.canConfirmSettlement()) {
      this.settlementError.set('Amount received must cover the remaining balance.');
      return;
    }

    this.form.controls.paymentMethod.setValue(this.settlementPaymentMethod());
    await this.markAsDone();
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
      this.pendingSettlement.set(false);
      await this.router.navigate(['/admin/job-order', id, 'receipt'], {
        queryParams: { print: '1' },
      });
    } catch (err: unknown) {
      const httpErr = err as { error?: { message?: string | string[] } };
      const msg = httpErr?.error?.message;
      const detail = Array.isArray(msg) ? msg.join(', ') : msg || 'Unknown error';
      const message = `Unable to settle job: ${detail}`;
      this.settlementError.set(message);
      this.formError.set(message);
    } finally {
      this.markingDone.set(false);
    }
  }
}
