import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  CreateQuotationPayload,
  JobOrderCustomerSuggestion,
  MaterialItem,
  PartsPriceHit,
  QuotationDetail,
} from '../../services/admin-api.service';
import {
  applyPhSpecialDiscount,
  normalizePhDiscountType,
  type PhDiscountType,
} from '../inventory/ph-discount.util';

const DISCOUNT_OPTIONS: Array<{ value: PhDiscountType; label: string }> = [
  { value: 'none', label: 'No discount' },
  { value: 'senior', label: 'Senior Citizen (20%)' },
  { value: 'pwd', label: 'PWD (20%)' },
];

type QuoteItemKind = 'material' | 'custom';

@Component({
  selector: 'app-quotation-create-page',
  imports: [ReactiveFormsModule, RouterLink, DecimalPipe],
  templateUrl: './quotation-create-page.component.html',
})
export class QuotationCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private materialSearchTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private partSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private customerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private customerSearchCloseTimer: ReturnType<typeof setTimeout> | null = null;

  readonly discountOptions = DISCOUNT_OPTIONS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly formSuccess = signal('');
  readonly materials = signal<MaterialItem[]>([]);
  readonly partQueries = signal<string[]>([]);
  readonly materialSearchResults = signal<Record<number, MaterialItem[]>>({});
  readonly webSearchResults = signal<Record<number, PartsPriceHit[]>>({});
  readonly webSearchErrors = signal<Record<number, string[]>>({});
  readonly webSearchLoading = signal(false);
  readonly openPartSearchIndex = signal<number | null>(null);
  readonly partSearchLoading = signal(false);
  readonly quotationId = signal<number | null>(null);
  readonly quotation = signal<QuotationDetail | null>(null);
  readonly quoteNo = signal<string | null>(null);
  readonly customerQuery = signal('');
  readonly customerSearchResults = signal<JobOrderCustomerSuggestion[]>([]);
  readonly openCustomerSearch = signal(false);
  readonly customerSearchLoading = signal(false);
  readonly pendingStatus = signal<'draft' | 'finalized'>('draft');

  readonly isEditMode = computed(() => this.quotationId() !== null);

  readonly form = this.formBuilder.nonNullable.group({
    customerName: ['', [Validators.required, Validators.maxLength(180)]],
    customerPhone: ['', [Validators.maxLength(60)]],
    customerEmail: ['', [Validators.email, Validators.maxLength(180)]],
    customerAddress: ['', [Validators.maxLength(2000)]],
    remarks: ['', [Validators.maxLength(2000)]],
    customDiscount: [0, [Validators.min(0)]],
    quoteDate: [this.toLocalDateTimeInputValue(new Date())],
    validityDays: [7, [Validators.required, Validators.min(1), Validators.max(365)]],
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
      this.quotationId.set(id);

      const [materialsResponse, quoteResponse] = await Promise.all([
        firstValueFrom(this.adminApi.listMaterials(1, 100, '')),
        id ? firstValueFrom(this.adminApi.getQuotation(id, 'pcmazing')) : Promise.resolve(null),
      ]);

      this.materials.set(materialsResponse.data.map((item) => this.normalizeMaterial(item)));

      if (quoteResponse?.data) {
        this.populateFromQuote(quoteResponse.data);
      } else {
        this.addMaterialItem();
      }
    } catch {
      this.error.set('Unable to load quotation form.');
    } finally {
      this.loading.set(false);
    }
  }

  private populateFromQuote(quote: QuotationDetail): void {
    this.quotation.set(quote);
    this.quoteNo.set(quote.quoteNo);
    this.customerQuery.set(quote.customerName ?? '');
    this.form.patchValue({
      customerName: quote.customerName ?? '',
      customerPhone: quote.customerContactNumber ?? '',
      customerEmail: quote.customerEmail ?? '',
      customerAddress: quote.customerAddress ?? '',
      remarks: quote.remarks ?? '',
      customDiscount: quote.customDiscount ?? 0,
      quoteDate: quote.quoteDate ? this.toLocalDateTimeInputValue(new Date(quote.quoteDate)) : '',
      validityDays: quote.validityDays || 7,
    });
    this.itemsArray.clear();
    this.partQueries.set([]);
    for (const item of quote.items) {
      const isCustom = !item.materialId;
      this.itemsArray.push(
        this.formBuilder.nonNullable.group({
          itemKind: [isCustom ? 'custom' : 'material'],
          materialId: [item.materialId ? String(item.materialId) : ''],
          description: [item.description || ''],
          quantity: [item.quantity, [Validators.required, Validators.min(0.01)]],
          unitPrice: [item.unitPrice, [Validators.required, Validators.min(0)]],
          discountType: [normalizePhDiscountType(item.discountType)],
        }),
      );
      this.partQueries.update((queries) => [...queries, item.materialName || item.description || '']);
    }
  }

  addMaterialItem(): void {
    this.itemsArray.push(
      this.formBuilder.nonNullable.group({
        itemKind: ['material' as QuoteItemKind],
        materialId: [''],
        description: [''],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        discountType: ['none' as PhDiscountType],
      }),
    );
    this.partQueries.update((queries) => [...queries, '']);
  }

  removeItem(index: number): void {
    this.itemsArray.removeAt(index);
    this.partQueries.update((queries) => queries.filter((_, itemIndex) => itemIndex !== index));
    this.materialSearchResults.update((current) => this.reindexRecord(current, index));
    this.webSearchResults.update((current) => this.reindexRecord(current, index));
    this.webSearchErrors.update((current) => this.reindexRecord(current, index));
  }

  partQuery(index: number): string {
    return this.partQueries()[index] ?? '';
  }

  openPartSearch(index: number): void {
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }
    this.openPartSearchIndex.set(index);
    void this.searchMaterialsForPart(index, this.partQuery(index));
    void this.searchWebPartsForPart(index, this.partQuery(index));
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

    const group = this.itemsArray.at(index);
    if (group) {
      const { materialId } = group.getRawValue() as { materialId: string };
      if (materialId) {
        const selectedName = this.materialName(materialId);
        if (value.trim() !== selectedName) {
          group.patchValue(
            {
              itemKind: 'custom' as QuoteItemKind,
              materialId: '',
              description: value.trim().slice(0, 500),
              unitPrice: 0,
            },
            { emitEvent: false },
          );
        }
      } else {
        group.patchValue(
          {
            itemKind: 'custom' as QuoteItemKind,
            description: value.trim().slice(0, 500),
          },
          { emitEvent: false },
        );
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
      void this.searchWebPartsForPart(index, value);
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

  private async searchWebPartsForPart(index: number, value: string): Promise<void> {
    const query = value.trim();
    if (query.length < 3) {
      this.webSearchResults.update((current) => ({ ...current, [index]: [] }));
      this.webSearchErrors.update((current) => ({ ...current, [index]: [] }));
      return;
    }

    this.webSearchLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.adminApi.searchPartsPrices(query, { limit: 8 }),
      );
      this.webSearchResults.update((current) => ({
        ...current,
        [index]: response.data.items ?? [],
      }));
      this.webSearchErrors.update((current) => ({
        ...current,
        [index]: (response.data.sourceErrors ?? []).map(
          (error) => `${error.sourceLabel}: ${error.message}`,
        ),
      }));
    } catch {
      this.webSearchResults.update((current) => ({ ...current, [index]: [] }));
      this.webSearchErrors.update((current) => ({
        ...current,
        [index]: ['Unable to search web stores right now.'],
      }));
    } finally {
      this.webSearchLoading.set(false);
    }
  }

  selectPartMaterial(index: number, item: MaterialItem): void {
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
        itemKind: 'material' as QuoteItemKind,
        materialId: String(item.id),
        unitPrice: this.resolveMaterialUnitPrice(item),
        description: item.materialName,
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

  selectWebPart(index: number, hit: PartsPriceHit): void {
    const group = this.itemsArray.at(index);
    if (!group) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }

    const description = hit.title.trim().slice(0, 500);
    group.patchValue(
      {
        itemKind: 'custom' as QuoteItemKind,
        materialId: '',
        description,
        unitPrice: Number(hit.pricePhp) || 0,
      },
      { emitEvent: false },
    );

    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = description;
      return next;
    });
    this.openPartSearchIndex.set(null);
  }

  selectCustomDescription(index: number): void {
    const group = this.itemsArray.at(index);
    if (!group) {
      return;
    }
    if (this.partSearchCloseTimer) {
      clearTimeout(this.partSearchCloseTimer);
      this.partSearchCloseTimer = null;
    }

    const description = this.partQuery(index).trim().slice(0, 500);
    if (!description) {
      return;
    }

    group.patchValue(
      {
        itemKind: 'custom' as QuoteItemKind,
        materialId: '',
        description,
      },
      { emitEvent: false },
    );
    this.partQueries.update((items) => {
      const next = [...items];
      next[index] = description;
      return next;
    });
    this.openPartSearchIndex.set(null);
  }

  onPartSuggestionPointerDown(event: Event, index: number, item: MaterialItem): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectPartMaterial(index, item);
  }

  onWebPartSuggestionPointerDown(event: Event, index: number, hit: PartsPriceHit): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectWebPart(index, hit);
  }

  onCustomDescriptionPointerDown(event: Event, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCustomDescription(index);
  }

  webPartsFor(index: number): PartsPriceHit[] {
    return this.webSearchResults()[index] ?? [];
  }

  webErrorsFor(index: number): string[] {
    return this.webSearchErrors()[index] ?? [];
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
        .map((control, controlIndex) => {
          if (controlIndex === exceptIndex) {
            return null;
          }
          const value = control.getRawValue() as { itemKind?: QuoteItemKind; materialId: string };
          if (value.itemKind === 'custom') {
            return null;
          }
          return Number(value.materialId);
        })
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0),
    );
  }

  openCustomerLookup(): void {
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
      customerPhone: customer.contact ?? '',
      customerAddress: customer.address ?? '',
    });
    this.openCustomerSearch.set(false);
  }

  onCustomerSuggestionPointerDown(event: Event, customer: JobOrderCustomerSuggestion): void {
    event.preventDefault();
    event.stopPropagation();
    this.selectCustomer(customer);
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

  itemsNetSubtotal(): number {
    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemNetAmount(index), 0);
  }

  lineDiscountTotal(): number {
    return this.itemsArray.controls.reduce((total, _, index) => total + this.itemDiscountAmount(index), 0);
  }

  customDiscountAmount(): number {
    return Math.max(0, Number(this.form.controls.customDiscount.value) || 0);
  }

  grandTotal(): number {
    return Math.max(0, this.itemsNetSubtotal() - this.customDiscountAmount());
  }

  validUntilLabel(): string {
    const quoteDate = this.form.controls.quoteDate.value
      ? new Date(this.form.controls.quoteDate.value)
      : new Date();
    if (Number.isNaN(quoteDate.getTime())) {
      return '—';
    }
    const days = Math.max(1, Number(this.form.controls.validityDays.value) || 7);
    const expires = new Date(quoteDate.getTime() + days * 24 * 60 * 60 * 1000);
    return expires.toLocaleDateString();
  }

  materialStockLabel(materialId: string): string {
    const item = this.materials().find((entry) => String(entry.id) === String(materialId));
    if (!item) {
      return '';
    }
    return `Stock: ${Number(item.onHandStock ?? 0)}`;
  }

  async saveDraft(): Promise<void> {
    await this.submit('draft');
  }

  async saveAndFinalize(): Promise<void> {
    await this.submit('finalized');
  }

  private async submit(status: 'draft' | 'finalized'): Promise<void> {
    this.pendingStatus.set(status);
    this.formError.set('');
    this.formSuccess.set('');
    this.form.controls.customerName.setValue(this.customerQuery().trim() || this.form.controls.customerName.value);

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
        itemKind?: QuoteItemKind;
        materialId: string;
        description: string;
      };
      const materialId = Number(item.materialId);
      const hasMaterial = Number.isFinite(materialId) && materialId > 0;
      const description = (item.description || this.partQuery(index) || '').trim();
      return !hasMaterial && !description;
    });
    if (invalidItemIndex >= 0) {
      this.formError.set(
        `Select an inventory/web item or enter a custom description for row ${invalidItemIndex + 1}.`,
      );
      return;
    }

    const value = this.form.getRawValue();
    const payload: CreateQuotationPayload = {
      customerName: value.customerName.trim(),
      customerPhone: value.customerPhone.trim() || undefined,
      customerEmail: value.customerEmail.trim() || undefined,
      customerAddress: value.customerAddress.trim() || undefined,
      remarks: value.remarks.trim() || undefined,
      customDiscount: Number(value.customDiscount) || 0,
      quoteDate: value.quoteDate ? new Date(value.quoteDate).toISOString() : undefined,
      validityDays: Number(value.validityDays) || 7,
      status,
      items: this.itemsArray.controls.map((control, index) => {
        const item = control.getRawValue() as {
          itemKind?: QuoteItemKind;
          materialId: string;
          description: string;
          quantity: number | string;
          unitPrice: number | string;
          discountType?: PhDiscountType;
        };
        const materialId = Number(item.materialId);
        const hasMaterial = Number.isFinite(materialId) && materialId > 0;
        const description = (item.description || this.partQuery(index) || '').trim();
        return {
          ...(hasMaterial ? { materialId } : {}),
          description: description || undefined,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountType: normalizePhDiscountType(item.discountType),
        };
      }),
    };

    this.saving.set(true);
    try {
      const id = this.quotationId();
      const response = id
        ? await firstValueFrom(this.adminApi.updateQuotation(id, payload))
        : await firstValueFrom(this.adminApi.createQuotation(payload));
      await this.router.navigate(['/admin/quotations', response.data.id], {
        queryParams: { source: 'pcmazing' },
      });
    } catch (err: unknown) {
      this.formError.set(this.readError(err, 'Unable to save quotation.'));
    } finally {
      this.saving.set(false);
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

  private reindexRecord<T>(current: Record<number, T>, removedIndex: number): Record<number, T> {
    const next: Record<number, T> = {};
    for (const [key, value] of Object.entries(current)) {
      const itemIndex = Number(key);
      if (itemIndex < removedIndex) {
        next[itemIndex] = value;
      } else if (itemIndex > removedIndex) {
        next[itemIndex - 1] = value;
      }
    }
    return next;
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
