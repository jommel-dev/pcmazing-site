import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  CreateSalesOrderPayload,
  MaterialItem,
  SalesOrderDetail,
} from '../../services/admin-api.service';
import {
  applyPhSpecialDiscount,
  normalizePhDiscountType,
  type PhDiscountType,
} from './ph-discount.util';
import {
  WARRANTY_PRESETS,
  formatWarrantyLabel,
  normalizeWarrantyInput,
  type WarrantyUnit,
} from './item-warranty.util';
import { normalizeSalesOrderDetail } from './sales-order.util';
import { isMaterialInStock, stockQty } from './inventory-stock.util';

const DISCOUNT_OPTIONS: Array<{ value: PhDiscountType; label: string }> = [
  { value: 'none', label: 'No discount' },
  { value: 'senior', label: 'Senior Citizen (20%)' },
  { value: 'pwd', label: 'PWD (20%)' },
];

@Component({
  selector: 'app-sales-order-create-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './sales-order-create-page.component.html',
})
export class SalesOrderCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private materialSearchTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private partSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly discountOptions = DISCOUNT_OPTIONS;
  readonly warrantyPresets = WARRANTY_PRESETS;
  readonly warrantyUnits: Array<{ value: WarrantyUnit; label: string }> = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
  ];
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly voiding = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly formSuccess = signal('');
  readonly materials = signal<MaterialItem[]>([]);
  readonly partQueries = signal<string[]>([]);
  readonly materialSearchResults = signal<Record<number, MaterialItem[]>>({});
  readonly openPartSearchIndex = signal<number | null>(null);
  readonly partSearchLoading = signal(false);
  readonly orderId = signal<number | null>(null);
  readonly order = signal<SalesOrderDetail | null>(null);
  readonly pendingVoid = signal(false);
  readonly referenceNo = signal<string | null>(null);
  readonly warrantyPopupIndex = signal<number | null>(null);
  readonly warrantyDraftValue = signal(1);
  readonly warrantyDraftUnit = signal<WarrantyUnit>('year');
  readonly warrantyPopupHadPrior = signal(false);

  readonly isViewMode = computed(() => this.orderId() !== null);
  readonly isVoided = computed(() => !!this.order()?.isVoid);
  readonly hasRefund = computed(() => (this.order()?.refundAmount ?? 0) > 0);
  readonly netTotalAmount = computed(() => {
    const order = this.order();
    if (!order) {
      return 0;
    }
    return Math.max(0, (order.netTotalAmount ?? order.totalAmount) - 0);
  });

  readonly form = this.formBuilder.nonNullable.group({
    customerName: ['', [Validators.required, Validators.maxLength(180)]],
    customerPhone: ['', [Validators.maxLength(60)]],
    notes: ['', [Validators.maxLength(2000)]],
    promotion: ['', [Validators.maxLength(180)]],
    customDiscount: [0, [Validators.min(0)]],
    saleDate: [this.toLocalDateTimeInputValue(new Date())],
    items: this.formBuilder.array([]),
  });

  ngOnInit(): void {
    void this.initialize();
  }

  get itemsArray(): FormArray {
    return this.form.controls.items;
  }

  async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const routeId = Number(this.route.snapshot.paramMap.get('id'));
      const id = Number.isFinite(routeId) && routeId > 0 ? routeId : null;
      this.orderId.set(id);

      const [materialsResponse, orderResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listMaterials(1, 100, '')),
        id ? firstValueFrom(this.adminApi.getSalesOrder(id)) : Promise.resolve(null),
      ]);

      this.materials.set(materialsResponse.data.map((item) => this.normalizeMaterial(item)));

      if (orderResponse?.data) {
        this.populateFromOrder(normalizeSalesOrderDetail(orderResponse.data));
      } else {
        this.addItem();
      }
    } catch {
      this.error.set('Unable to load sales order form.');
    } finally {
      this.loading.set(false);
    }
  }

  private populateFromOrder(order: SalesOrderDetail): void {
    this.order.set(order);
    this.referenceNo.set(order.referenceNo);
    this.form.patchValue({
      customerName: order.customerName,
      customerPhone: order.customerPhone ?? '',
      notes: order.notes ?? '',
      promotion: order.promotion ?? '',
      customDiscount: order.customDiscount ?? 0,
      saleDate: order.saleDate ? this.toLocalDateTimeInputValue(new Date(order.saleDate)) : '',
    });
    this.itemsArray.clear();
    this.partQueries.set([]);
    for (const item of order.items) {
      const isCustom = item.materialId == null || Number(item.materialId) <= 0;
      this.itemsArray.push(
        this.formBuilder.nonNullable.group({
          materialId: [isCustom ? '' : String(item.materialId)],
          customItemName: [item.customItemName || (isCustom ? item.materialName || '' : '')],
          quantity: [item.quantity, [Validators.required, Validators.min(0.01)]],
          unitPrice: [item.unitPrice, [Validators.required, Validators.min(0)]],
          discountType: [normalizePhDiscountType(item.discountType)],
          warrantyValue: [item.warrantyValue ?? null],
          warrantyUnit: [item.warrantyUnit ?? ''],
        }),
      );
      this.partQueries.update((queries) => [
        ...queries,
        item.customItemName || item.materialName || '',
      ]);
    }
    this.form.disable();
  }

  addItem(): void {
    if (this.isViewMode()) {
      return;
    }
    this.itemsArray.push(
      this.formBuilder.nonNullable.group({
        materialId: [''],
        customItemName: [''],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        discountType: ['none' as PhDiscountType],
        warrantyValue: [null as number | null],
        warrantyUnit: ['' as WarrantyUnit | ''],
      }),
    );
    this.partQueries.update((queries) => [...queries, '']);
  }

  itemWarrantyLabel(index: number): string {
    const raw = this.itemsArray.at(index)?.getRawValue() as {
      warrantyValue?: number | null;
      warrantyUnit?: string | null;
    } | undefined;
    return formatWarrantyLabel(raw?.warrantyValue, raw?.warrantyUnit);
  }

  itemHasWarranty(index: number): boolean {
    return !!this.itemWarrantyLabel(index);
  }

  onWarrantyCheckboxChange(index: number, checked: boolean): void {
    if (this.isViewMode()) {
      return;
    }
    if (!checked) {
      this.clearItemWarranty(index);
      if (this.warrantyPopupIndex() === index) {
        this.warrantyPopupIndex.set(null);
      }
      return;
    }
    this.openWarrantyPopup(index);
  }

  openWarrantyPopup(index: number): void {
    if (this.isViewMode()) {
      return;
    }
    const raw = this.itemsArray.at(index)?.getRawValue() as {
      warrantyValue?: number | null;
      warrantyUnit?: string | null;
    };
    const existing = normalizeWarrantyInput(raw?.warrantyValue, raw?.warrantyUnit);
    this.warrantyPopupHadPrior.set(!!existing);
    this.warrantyDraftValue.set(existing?.warrantyValue ?? 1);
    this.warrantyDraftUnit.set(existing?.warrantyUnit ?? 'year');
    this.warrantyPopupIndex.set(index);
  }

  applyWarrantyPreset(value: number, unit: WarrantyUnit): void {
    this.warrantyDraftValue.set(value);
    this.warrantyDraftUnit.set(unit);
  }

  saveWarrantyPopup(): void {
    const index = this.warrantyPopupIndex();
    if (index == null) {
      return;
    }
    const normalized = normalizeWarrantyInput(this.warrantyDraftValue(), this.warrantyDraftUnit());
    if (!normalized) {
      this.formError.set('Enter a warranty of at least 1 day, week, month, or year.');
      return;
    }
    const group = this.itemsArray.at(index);
    group?.patchValue({
      warrantyValue: normalized.warrantyValue,
      warrantyUnit: normalized.warrantyUnit,
    });
    this.warrantyPopupIndex.set(null);
    this.formError.set('');
  }

  cancelWarrantyPopup(): void {
    const index = this.warrantyPopupIndex();
    if (index == null) {
      return;
    }
    if (!this.warrantyPopupHadPrior()) {
      this.clearItemWarranty(index);
    }
    this.warrantyPopupIndex.set(null);
  }

  private clearItemWarranty(index: number): void {
    this.itemsArray.at(index)?.patchValue({
      warrantyValue: null,
      warrantyUnit: '',
    });
  }

  removeItem(index: number): void {
    if (this.isViewMode()) {
      return;
    }
    this.itemsArray.removeAt(index);
    this.partQueries.update((queries) => queries.filter((_, itemIndex) => itemIndex !== index));
    this.materialSearchResults.update((current) => {
      const next: Record<number, MaterialItem[]> = {};
      for (const [key, value] of Object.entries(current)) {
        const itemIndex = Number(key);
        if (itemIndex < index) {
          next[itemIndex] = value;
        } else if (itemIndex > index) {
          next[itemIndex - 1] = value;
        }
      }
      return next;
    });
  }

  partQuery(index: number): string {
    return this.partQueries()[index] ?? '';
  }

  openPartSearch(index: number): void {
    if (this.isViewMode()) {
      return;
    }
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
    if (this.isViewMode()) {
      return;
    }
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = value;
      return next;
    });

    const group = this.itemsArray.at(index);
    if (group) {
      const { materialId, customItemName } = group.getRawValue() as {
        materialId: string;
        customItemName?: string;
      };
      if (materialId) {
        const selectedName = this.materialName(materialId);
        if (value.trim() !== selectedName) {
          group.patchValue(
            { materialId: '', customItemName: '', unitPrice: 0 },
            { emitEvent: false },
          );
        }
      } else if (customItemName && value.trim() !== String(customItemName).trim()) {
        group.patchValue({ customItemName: '' }, { emitEvent: false });
      }
    }

    this.openPartSearchIndex.set(index);
    this.scheduleMaterialSearch(index, value);
  }

  onPartSearchKeydown(event: Event, index: number): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Enter') {
      return;
    }
    keyboard.preventDefault();
    this.useCustomItem(index);
  }

  canUseCustomItem(index: number): boolean {
    const name = this.partQuery(index).trim();
    if (!name) {
      return false;
    }
    const group = this.itemsArray.at(index);
    if (!group) {
      return false;
    }
    const { materialId, customItemName } = group.getRawValue() as {
      materialId: string;
      customItemName?: string;
    };
    if (materialId && this.materialName(materialId) === name) {
      return false;
    }
    if (customItemName && String(customItemName).trim() === name) {
      return false;
    }
    return true;
  }

  useCustomItem(index: number): void {
    if (this.isViewMode() || !this.canUseCustomItem(index)) {
      return;
    }
    const name = this.partQuery(index).trim();
    const group = this.itemsArray.at(index);
    if (!group || !name) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    group.patchValue(
      {
        materialId: '',
        customItemName: name,
      },
      { emitEvent: false },
    );
    this.openPartSearchIndex.set(null);
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
    this.partSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.listMaterials(1, 100, value.trim()));
      const results = response.data.map((item) => this.normalizeMaterial(item));
      this.upsertMaterials(results);
      this.materialSearchResults.update((current) => ({ ...current, [index]: results }));
    } finally {
      this.partSearchLoading.set(false);
    }
  }

  selectPartMaterial(index: number, item: MaterialItem): void {
    if (this.isViewMode()) {
      return;
    }
    if (!this.isMaterialSelectable(item)) {
      return;
    }
    const group = this.itemsArray.at(index);
    if (!group) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    group.patchValue(
      {
        materialId: String(item.id),
        customItemName: '',
        unitPrice: this.resolveMaterialUnitPrice(item),
      },
      { emitEvent: false },
    );
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = item.materialName;
      return next;
    });
    this.openPartSearchIndex.set(null);
  }

  onPartSuggestionPointerDown(event: Event, index: number, item: MaterialItem): void {
    if (!this.isMaterialSelectable(item)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.selectPartMaterial(index, item);
  }

  isMaterialSelectable(item: MaterialItem): boolean {
    return isMaterialInStock(item);
  }

  filteredMaterials(index: number): MaterialItem[] {
    const query = this.partQuery(index).trim().toLowerCase();
    const currentId = Number((this.itemsArray.at(index)?.getRawValue() as { materialId: string })?.materialId);
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

  private selectedMaterialIds(exceptIndex: number): Set<number> {
    return new Set(
      this.itemsArray.controls
        .map((control, controlIndex) =>
          controlIndex === exceptIndex
            ? null
            : Number((control.getRawValue() as { materialId: string }).materialId),
        )
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    );
  }

  itemSubtotal(index: number): number {
    const group = this.itemsArray.at(index);
    if (!group) {
      return 0;
    }
    const { quantity, unitPrice } = group.getRawValue() as {
      quantity: number | string;
      unitPrice: number | string;
    };
    return (Number(quantity) || 0) * (Number(unitPrice) || 0);
  }

  itemDiscountType(index: number): PhDiscountType {
    const group = this.itemsArray.at(index);
    if (!group) {
      return 'none';
    }
    return normalizePhDiscountType((group.getRawValue() as { discountType?: string }).discountType);
  }

  itemNetAmount(index: number): number {
    return applyPhSpecialDiscount(this.itemSubtotal(index), this.itemDiscountType(index)).net;
  }

  itemDiscountAmount(index: number): number {
    return applyPhSpecialDiscount(this.itemSubtotal(index), this.itemDiscountType(index)).discountAmount;
  }

  itemsSubtotal(): number {
    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemSubtotal(index), 0);
  }

  itemsNetSubtotal(): number {
    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemNetAmount(index), 0);
  }

  lineDiscountTotal(): number {
    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemDiscountAmount(index), 0);
  }

  customDiscountAmount(): number {
    if (this.isViewMode()) {
      return this.order()?.customDiscount ?? 0;
    }
    return Math.max(0, Number(this.form.controls.customDiscount.value) || 0);
  }

  totalCustomerPayment(): number {
    if (this.isViewMode()) {
      return this.order()?.totalAmount ?? 0;
    }
    return Math.max(0, this.itemsNetSubtotal() - this.customDiscountAmount());
  }

  discountLabel(value: string | null | undefined): string {
    return DISCOUNT_OPTIONS.find((option) => option.value === normalizePhDiscountType(value))?.label ?? 'No discount';
  }

  itemRefundedQuantity(index: number): number {
    const items = this.order()?.items ?? [];
    return Math.max(0, Number(items[index]?.refundedQuantity) || 0);
  }

  materialStockLabel(materialId: string): string {
    const item = this.materials().find((entry) => String(entry.id) === String(materialId));
    if (!item) {
      return '';
    }
    const stock = stockQty(item);
    if (stock <= 0) {
      return 'Out of stock';
    }
    return `Stock: ${stock}`;
  }

  itemRowHint(index: number): string {
    const group = this.itemsArray.at(index);
    if (!group) {
      return '';
    }
    const { materialId, customItemName } = group.getRawValue() as {
      materialId: string;
      customItemName?: string;
    };
    if (materialId) {
      return this.materialStockLabel(materialId);
    }
    if (customItemName?.trim()) {
      return 'Custom item (not deducted from inventory)';
    }
    return '';
  }

  async submit(): Promise<void> {
    if (this.isViewMode()) {
      return;
    }

    this.formError.set('');
    this.formSuccess.set('');

    // Commit any typed custom names that were not explicitly selected.
    this.itemsArray.controls.forEach((_, index) => {
      if (this.canUseCustomItem(index)) {
        this.useCustomItem(index);
      }
    });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please complete the required fields.');
      return;
    }

    if (this.itemsArray.length === 0) {
      this.formError.set('Add at least one item.');
      return;
    }

    const invalidItemIndex = this.itemsArray.controls.findIndex((control, index) => {
      const item = control.getRawValue() as {
        materialId: string;
        customItemName?: string;
      };
      const materialId = Number(item.materialId);
      const hasMaterial = Number.isFinite(materialId) && materialId > 0;
      const customName =
        String(item.customItemName ?? '').trim() || this.partQuery(index).trim();
      return !hasMaterial && !customName;
    });
    if (invalidItemIndex >= 0) {
      this.formError.set(
        `Select an inventory item or enter a custom item name for row ${invalidItemIndex + 1}.`,
      );
      return;
    }

    const value = this.form.getRawValue();
    const payload: CreateSalesOrderPayload = {
      customerName: value.customerName.trim(),
      customerPhone: value.customerPhone.trim() || undefined,
      notes: value.notes.trim() || undefined,
      promotion: value.promotion.trim() || undefined,
      customDiscount: Number(value.customDiscount) || 0,
      saleDate: value.saleDate ? new Date(value.saleDate).toISOString() : undefined,
      items: this.itemsArray.controls.map((control, index) => {
        const item = control.getRawValue() as {
          materialId: string;
          customItemName?: string;
          quantity: number | string;
          unitPrice: number | string;
          discountType?: PhDiscountType;
          warrantyValue?: number | null;
          warrantyUnit?: string | null;
        };
        const materialId = Number(item.materialId);
        const hasMaterial = Number.isFinite(materialId) && materialId > 0;
        const customItemName =
          String(item.customItemName ?? '').trim() || this.partQuery(index).trim();
        const warranty = normalizeWarrantyInput(item.warrantyValue, item.warrantyUnit);
        return {
          materialId: hasMaterial ? materialId : null,
          customItemName: hasMaterial ? undefined : customItemName,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountType: normalizePhDiscountType(item.discountType),
          warrantyValue: warranty?.warrantyValue ?? null,
          warrantyUnit: warranty?.warrantyUnit ?? null,
        };
      }),
    };

    this.saving.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.createSalesOrder(payload));
      this.formSuccess.set('Sales order saved.');
      await this.router.navigate(['/admin/sales-order', response.data.id]);
    } catch (err: unknown) {
      this.formError.set(this.readError(err, 'Unable to save sales order.'));
    } finally {
      this.saving.set(false);
    }
  }

  printReceipt(): void {
    const id = this.orderId();
    if (!id) {
      return;
    }
    void this.router.navigate(['/admin/sales-order', id, 'receipt'], {
      queryParams: { print: '1' },
    });
  }

  reprintReceipt(): void {
    const id = this.orderId();
    if (!id) {
      return;
    }
    void this.router.navigate(['/admin/sales-order', id, 'receipt'], {
      queryParams: { print: '1', reprint: '1' },
    });
  }

  requestVoid(): void {
    this.pendingVoid.set(true);
  }

  cancelVoid(): void {
    this.pendingVoid.set(false);
  }

  async confirmVoid(): Promise<void> {
    const id = this.orderId();
    if (!id) {
      return;
    }

    this.voiding.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.voidSalesOrder(id));
      this.order.set(response.data);
      this.pendingVoid.set(false);
      this.formSuccess.set('Sales order voided and inventory restored.');
    } catch (err: unknown) {
      this.formError.set(this.readError(err, 'Unable to void sales order.'));
    } finally {
      this.voiding.set(false);
    }
  }

  private materialName(materialId: string): string {
    return this.materials().find((item) => String(item.id) === String(materialId))?.materialName ?? '';
  }

  private resolveMaterialUnitPrice(item?: MaterialItem | null): number {
    if (!item) {
      return 0;
    }
    return Number(item.sellPrice ?? item.unitPrice ?? 0);
  }

  private normalizeMaterial(item: MaterialItem): MaterialItem {
    return {
      ...item,
      sellPrice: item.sellPrice ?? item.unitPrice ?? 0,
      onHandStock: item.onHandStock ?? 0,
    };
  }

  private upsertMaterials(items: MaterialItem[]): void {
    this.materials.update((current) => {
      const map = new Map(current.map((item) => [item.id, item]));
      for (const item of items) {
        map.set(item.id, this.normalizeMaterial(item));
      }
      return Array.from(map.values());
    });
  }

  private toLocalDateTimeInputValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private readError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const payload = (err as { error?: { message?: string | string[] } }).error;
      if (Array.isArray(payload?.message)) {
        return payload.message.join(' ');
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
    }
    return fallback;
  }
}
