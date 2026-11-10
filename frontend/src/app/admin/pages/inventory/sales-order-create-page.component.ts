import { DecimalPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAlertService } from '../../services/admin-alert.service';
import {
  AdminApiService,
  CreateSalesOrderPayload,
  MaterialItem,
  PartsPriceHit,
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
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './sales-order-create-page.component.html',
})
export class SalesOrderCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAlert = inject(AdminAlertService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private materialSearchTimer: ReturnType<typeof setTimeout> | null = null;
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
  readonly materials = signal<MaterialItem[]>([]);
  readonly partQuery = signal('');
  readonly materialSearchResults = signal<MaterialItem[]>([]);
  readonly openPartSearch = signal(false);
  readonly partSearchLoading = signal(false);
  readonly webSearchResults = signal<PartsPriceHit[]>([]);
  readonly webSearchErrors = signal<string[]>([]);
  readonly webSearchLoading = signal(false);
  readonly orderId = signal<number | null>(null);
  readonly order = signal<SalesOrderDetail | null>(null);
  readonly pendingVoid = signal(false);
  readonly referenceNo = signal<string | null>(null);
  readonly warrantyPopupIndex = signal<number | null>(null);
  readonly warrantyPopupMode = signal<'single' | 'bulk'>('single');
  readonly warrantyDraftValue = signal(1);
  readonly warrantyDraftUnit = signal<WarrantyUnit>('day');
  readonly warrantyPopupHadPrior = signal(false);
  readonly warrantySelectedIndices = signal<Set<number>>(new Set());

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
    useManualTotal: [false],
    manualTotalAmount: [0 as number, [Validators.min(0)]],
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
    this.warrantySelectedIndices.set(new Set());
    for (const item of order.items) {
      const isCustom = item.materialId == null || Number(item.materialId) <= 0;
      this.pushItemRow({
        materialId: isCustom ? '' : String(item.materialId),
        customItemName: item.customItemName || (isCustom ? item.materialName || '' : ''),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: normalizePhDiscountType(item.discountType),
        warrantyValue: item.warrantyValue ?? null,
        warrantyUnit: (item.warrantyUnit as WarrantyUnit | '') ?? '',
      });
    }
    this.form.disable();
  }

  private pushItemRow(options: {
    materialId?: string;
    customItemName?: string;
    quantity?: number;
    unitPrice?: number;
    discountType?: PhDiscountType;
    warrantyValue?: number | null;
    warrantyUnit?: WarrantyUnit | '';
  }): void {
    this.itemsArray.push(
      this.formBuilder.nonNullable.group({
        materialId: [options.materialId ?? ''],
        customItemName: [options.customItemName ?? ''],
        quantity: [options.quantity ?? 1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [options.unitPrice ?? 0, [Validators.required, Validators.min(0)]],
        discountType: [(options.discountType ?? 'none') as PhDiscountType],
        warrantyValue: [options.warrantyValue ?? null],
        warrantyUnit: [(options.warrantyUnit ?? '') as WarrantyUnit | ''],
      }),
    );
  }

  itemDisplayName(index: number): string {
    const group = this.itemsArray.at(index);
    if (!group) {
      return '';
    }
    const { materialId, customItemName } = group.getRawValue() as {
      materialId: string;
      customItemName?: string;
    };
    if (customItemName?.trim()) {
      return customItemName.trim();
    }
    if (materialId) {
      const fromOrder = this.order()?.items?.[index]?.materialName;
      return fromOrder || this.materialName(materialId) || 'Unknown item';
    }
    return '';
  }

  isCustomItem(index: number): boolean {
    const group = this.itemsArray.at(index);
    if (!group) {
      return false;
    }
    const { materialId, customItemName } = group.getRawValue() as {
      materialId: string;
      customItemName?: string;
    };
    return !materialId && !!customItemName?.trim();
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

  isItemWarrantySelected(index: number): boolean {
    return this.warrantySelectedIndices().has(index);
  }

  toggleItemWarrantySelect(index: number): void {
    if (this.isViewMode()) {
      return;
    }
    const next = new Set(this.warrantySelectedIndices());
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.warrantySelectedIndices.set(next);
  }

  toggleSelectAllItemWarranties(): void {
    if (this.isViewMode()) {
      return;
    }
    if (this.allItemWarrantiesSelected()) {
      this.warrantySelectedIndices.set(new Set());
      return;
    }
    this.warrantySelectedIndices.set(new Set(this.itemsArray.controls.map((_, i) => i)));
  }

  allItemWarrantiesSelected(): boolean {
    const n = this.itemsArray.length;
    return n > 0 && this.warrantySelectedIndices().size === n;
  }

  itemWarrantySelectedCount(): number {
    return this.warrantySelectedIndices().size;
  }

  private remapWarrantySelectionAfterRemove(removedIndex: number): void {
    const next = new Set<number>();
    for (const index of this.warrantySelectedIndices()) {
      if (index === removedIndex) {
        continue;
      }
      next.add(index > removedIndex ? index - 1 : index);
    }
    this.warrantySelectedIndices.set(next);
  }

  openBulkWarrantyPopup(): void {
    if (this.isViewMode() || this.itemWarrantySelectedCount() < 1) {
      return;
    }
    this.warrantyPopupMode.set('bulk');
    this.warrantyPopupHadPrior.set(true);
    this.warrantyDraftValue.set(1);
    this.warrantyDraftUnit.set('day');
    this.warrantyPopupIndex.set(-1);
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
    this.warrantyPopupMode.set('single');
    this.warrantyPopupHadPrior.set(!!existing);
    this.warrantyDraftValue.set(existing?.warrantyValue ?? 1);
    this.warrantyDraftUnit.set(existing?.warrantyUnit ?? 'day');
    this.warrantyPopupIndex.set(index);
  }

  applyWarrantyPreset(value: number, unit: WarrantyUnit): void {
    this.warrantyDraftValue.set(value);
    this.warrantyDraftUnit.set(unit);
  }

  onWarrantyDraftValueInput(event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    this.warrantyDraftValue.set(Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1);
  }

  onWarrantyDraftUnitChange(event: Event): void {
    const value = String((event.target as HTMLSelectElement).value) as WarrantyUnit;
    this.warrantyDraftUnit.set(value);
  }

  saveWarrantyPopup(): void {
    if (this.warrantyPopupIndex() == null) {
      return;
    }
    const normalized = normalizeWarrantyInput(this.warrantyDraftValue(), this.warrantyDraftUnit());
    if (!normalized) {
      this.adminAlert.error('Enter a warranty of at least 1 day, week, month, or year.');
      return;
    }
    if (this.warrantyPopupMode() === 'bulk') {
      for (const index of this.warrantySelectedIndices()) {
        this.itemsArray.at(index)?.patchValue({
          warrantyValue: normalized.warrantyValue,
          warrantyUnit: normalized.warrantyUnit,
        });
      }
      this.warrantySelectedIndices.set(new Set());
    } else {
      const index = this.warrantyPopupIndex();
      if (index == null || index < 0) {
        return;
      }
      this.itemsArray.at(index)?.patchValue({
        warrantyValue: normalized.warrantyValue,
        warrantyUnit: normalized.warrantyUnit,
      });
    }
    this.warrantyPopupIndex.set(null);
    this.adminAlert.close();
  }

  cancelWarrantyPopup(): void {
    const index = this.warrantyPopupIndex();
    if (index == null) {
      return;
    }
    if (this.warrantyPopupMode() === 'bulk') {
      this.warrantyPopupIndex.set(null);
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
    this.remapWarrantySelectionAfterRemove(index);
    if (this.warrantyPopupIndex() === index) {
      this.warrantyPopupIndex.set(null);
    } else if (this.warrantyPopupIndex() != null && (this.warrantyPopupIndex() as number) > index) {
      this.warrantyPopupIndex.set((this.warrantyPopupIndex() as number) - 1);
    }
  }

  openPartLookup(): void {
    if (this.isViewMode()) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    this.openPartSearch.set(true);
    void this.searchMaterials(this.partQuery());
    void this.searchWebParts(this.partQuery());
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
    if (this.isViewMode()) {
      return;
    }
    this.partQuery.set(value);
    this.openPartSearch.set(true);
    this.scheduleMaterialSearch(value);
  }

  onPartSearchKeydown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Enter') {
      return;
    }
    keyboard.preventDefault();
    this.addTypedCustomItem();
  }

  private scheduleMaterialSearch(value: string): void {
    if (this.materialSearchTimer) {
      clearTimeout(this.materialSearchTimer);
    }
    this.materialSearchTimer = setTimeout(() => {
      void this.searchMaterials(value);
      void this.searchWebParts(value);
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
      // Keep existing materials if search fails.
    } finally {
      this.partSearchLoading.set(false);
    }
  }

  private async searchWebParts(value: string): Promise<void> {
    const query = value.trim();
    if (query.length < 3) {
      this.webSearchResults.set([]);
      this.webSearchErrors.set([]);
      return;
    }
    this.webSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.searchPartsPrices(query, { limit: 8 }));
      this.webSearchResults.set(response.data.items ?? []);
      this.webSearchErrors.set(
        (response.data.sourceErrors ?? []).map((error) => `${error.sourceLabel}: ${error.message}`),
      );
    } catch {
      this.webSearchResults.set([]);
      this.webSearchErrors.set(['Unable to search connected stores right now.']);
    } finally {
      this.webSearchLoading.set(false);
    }
  }

  addItemFromCatalog(item: MaterialItem): void {
    if (this.isViewMode() || !this.isMaterialSelectable(item)) {
      return;
    }
    if (this.selectedMaterialIds().has(Number(item.id))) {
      this.clearPartSearch();
      return;
    }
    this.pushItemRow({
      materialId: String(item.id),
      customItemName: '',
      quantity: 1,
      unitPrice: this.resolveMaterialUnitPrice(item),
    });
    this.clearPartSearch();
  }

  addTypedCustomItem(): void {
    if (this.isViewMode()) {
      return;
    }
    const name = this.partQuery().trim();
    if (!name) {
      return;
    }
    if (this.canCreateNewItem()) {
      this.pushItemRow({
        materialId: '',
        customItemName: name,
        quantity: 1,
        unitPrice: 0,
      });
      this.clearPartSearch();
      return;
    }
    const exact = this.exactMaterialMatch();
    if (exact) {
      this.addItemFromCatalog(exact);
    }
  }

  selectWebPart(hit: PartsPriceHit): void {
    if (this.isViewMode()) {
      return;
    }
    const name = hit.title.trim().slice(0, 180);
    if (!name) {
      return;
    }
    this.pushItemRow({
      materialId: '',
      customItemName: name,
      quantity: 1,
      unitPrice: Number(hit.pricePhp) || 0,
    });
    this.clearPartSearch();
  }

  onWebPartSuggestionPointerDown(event: Event, hit: PartsPriceHit): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectWebPart(hit);
  }

  onPartSuggestionPointerDown(event: Event, item: MaterialItem): void {
    if (!this.isMaterialSelectable(item)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.addItemFromCatalog(item);
  }

  private clearPartSearch(): void {
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    this.partQuery.set('');
    this.openPartSearch.set(false);
    this.webSearchResults.set([]);
    this.webSearchErrors.set([]);
  }

  canCreateNewItem(): boolean {
    const name = this.partQuery().trim();
    if (!name) {
      return false;
    }
    if (this.selectedItemNames().has(name.toLowerCase())) {
      return false;
    }
    const exact = this.materials().find(
      (item) => item.materialName.toLowerCase() === name.toLowerCase(),
    );
    if (!exact) {
      return true;
    }
    if (this.selectedMaterialIds().has(Number(exact.id))) {
      return false;
    }
    return !this.isMaterialSelectable(exact);
  }

  exactMaterialMatch(): MaterialItem | null {
    const name = this.partQuery().trim().toLowerCase();
    if (!name) {
      return null;
    }
    const selectedIds = this.selectedMaterialIds();
    return (
      this.materials().find(
        (item) =>
          item.materialName.toLowerCase() === name &&
          !selectedIds.has(Number(item.id)) &&
          this.isMaterialSelectable(item),
      ) ?? null
    );
  }

  isNonInventoryMaterial(item: MaterialItem): boolean {
    const type = String(item.productTypeName ?? '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ');
    return type === 'non inventory' || type === 'noninventory';
  }

  isMaterialSelectable(item: MaterialItem): boolean {
    if (this.isNonInventoryMaterial(item)) {
      return true;
    }
    return isMaterialInStock(item);
  }

  materialStockQty(item: MaterialItem): number {
    return stockQty(item);
  }

  filteredMaterials(): MaterialItem[] {
    const query = this.partQuery().trim().toLowerCase();
    const selectedIds = this.selectedMaterialIds();
    const selectedNames = this.selectedItemNames();
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

  selectedMaterialIds(): Set<number> {
    return new Set(
      this.itemsArray.controls
        .map((control) => Number((control.getRawValue() as { materialId: string }).materialId))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }

  selectedItemNames(): Set<string> {
    return new Set(
      this.itemsArray.controls
        .map((_, index) => this.itemDisplayName(index).trim().toLowerCase())
        .filter((name) => !!name),
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

  calculatedCustomerPayment(): number {
    return Math.max(0, this.itemsNetSubtotal() - this.customDiscountAmount());
  }

  onUseManualTotalModelChange(checked: boolean): void {
    this.form.controls.useManualTotal.setValue(Boolean(checked), { emitEvent: false });
    if (checked && !Number(this.form.controls.manualTotalAmount.value)) {
      this.form.controls.manualTotalAmount.setValue(this.calculatedCustomerPayment(), {
        emitEvent: false,
      });
    }
  }

  totalCustomerPayment(): number {
    if (this.isViewMode()) {
      return this.order()?.totalAmount ?? 0;
    }
    if (this.form.controls.useManualTotal.value) {
      return Math.max(0, Number(this.form.getRawValue().manualTotalAmount) || 0);
    }
    return this.calculatedCustomerPayment();
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

    this.adminAlert.close();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.adminAlert.error('Please complete the required fields.');
      return;
    }

    if (this.itemsArray.length === 0) {
      this.adminAlert.error('Add at least one item.');
      return;
    }

    if (this.form.controls.useManualTotal.value) {
      const manual = Number(this.form.getRawValue().manualTotalAmount);
      if (!Number.isFinite(manual) || manual < 0) {
        this.adminAlert.error('Manual total amount is required and must be zero or greater.');
        return;
      }
    }

    const invalidItemIndex = this.itemsArray.controls.findIndex((control) => {
      const item = control.getRawValue() as {
        materialId: string;
        customItemName?: string;
      };
      const materialId = Number(item.materialId);
      const hasMaterial = Number.isFinite(materialId) && materialId > 0;
      const customName = String(item.customItemName ?? '').trim();
      return !hasMaterial && !customName;
    });
    if (invalidItemIndex >= 0) {
      this.adminAlert.error(
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
      useManualTotal: Boolean(value.useManualTotal),
      manualTotalAmount: value.useManualTotal
        ? Math.max(0, Number(value.manualTotalAmount) || 0)
        : null,
      saleDate: value.saleDate ? new Date(value.saleDate).toISOString() : undefined,
      items: this.itemsArray.controls.map((control) => {
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
        const customItemName = String(item.customItemName ?? '').trim();
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
      this.adminAlert.success('Sales order saved.');
      await this.router.navigate(['/admin/sales-order', response.data.id]);
    } catch (err: unknown) {
      this.adminAlert.error(this.readError(err, 'Unable to save sales order.'));
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
      this.adminAlert.success('Sales order voided and inventory restored.');
    } catch (err: unknown) {
      this.adminAlert.error(this.readError(err, 'Unable to void sales order.'));
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
