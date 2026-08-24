import { DatePipe, DecimalPipe, NgStyle, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminApiService,
  InventoryServiceItem,
  PrintingSettingsItem,
  PrintingTemplateItem,
} from '../../services/admin-api.service';
import { PrintLayoutElement, jobOrderSalesReceiptLayout, roundMm } from '../printing/printing.types';
import {
  A4_PRINT_HEIGHT_MM,
  A4_PRINT_WIDTH_MM,
  barcodeBarStyle,
  receiptPrintPageCss,
} from '../printing/printing-print-page.util';
import {
  DEFAULT_FOOTER_NOTE,
  DEFAULT_STORE_ADDRESS,
  DEFAULT_STORE_NAME,
  DEFAULT_THANKS_MESSAGE,
  DEFAULT_WARRANTY_POLICY,
} from '../printing/printing-receipt-content.defaults';
import {
  compactReceiptText,
  fitReceiptTemplate,
  receiptContentFieldKeyFor,
} from '../printing/printing-receipt-content.util';
import {
  applyLineDiscount,
  applyPhSpecialDiscount,
  normalizePhDiscountType,
  PhDiscountType,
} from './ph-discount.util';

type ReceiptLine = {
  itemName: string;
  description: string;
  qty: number;
  unitPrice: number;
  discountType: PhDiscountType;
  extPrice: number;
  discountAmount: number;
  isCustomDiscount?: boolean;
};

const TEMPLATE_STORAGE_KEY = 'pcmazing.receipt.selectedTemplateId';
const BUILTIN_TEMPLATE_VALUE = 0;

@Component({
  selector: 'app-inventory-service-receipt-page',
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule, NgStyle, NgTemplateOutlet],
  templateUrl: './inventory-service-receipt-page.component.html',
  styleUrl: './inventory-service-receipt-page.component.css',
})
export class InventoryServiceReceiptPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private printStyleEl: HTMLStyleElement | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly item = signal<InventoryServiceItem | null>(null);
  readonly printedAt = signal(new Date());
  readonly autoPrint = signal(false);
  readonly autoReprint = signal(false);
  readonly showReprinted = signal(false);
  readonly templates = signal<PrintingTemplateItem[]>([]);
  readonly printingSettings = signal<PrintingSettingsItem | null>(null);
  readonly selectedTemplateId = signal<number>(BUILTIN_TEMPLATE_VALUE);

  readonly cashierName = computed(
    () => this.adminAuth.getStoredUser()?.fullName || this.adminAuth.getStoredUser()?.username || 'Cashier',
  );

  readonly receiptNo = computed(() => {
    const current = this.item();
    if (!current) {
      return '';
    }
    const ref = current.referenceNo?.trim();
    if (ref) {
      const digits = ref.replace(/\D+/g, '');
      return digits || String(current.id);
    }
    return String(current.id);
  });

  readonly lines = computed<ReceiptLine[]>(() => {
    const current = this.item();
    if (!current) {
      return [];
    }

    const rows: ReceiptLine[] = [];
    const hasCatalogServices = (current.parts ?? []).some((part) => Number(part.serviceTypeId) > 0);

    for (const part of current.parts ?? []) {
      const qty = Number(part.quantity) || 0;
      const unitPrice = Number(part.unitPrice) || 0;
      const discountType = normalizePhDiscountType(part.discountType);
      const storedDiscount = Number(part.discountAmount) || 0;
      const isCatalogService = Number(part.serviceTypeId) > 0;
      const isCustom = !part.materialId && !!part.customItemName?.trim();
      const itemName = (
        part.materialName ||
        part.customItemName ||
        part.materialCode ||
        'Item'
      ).trim();
      const description = isCustom || isCatalogService ? '' : String(part.description ?? '').trim();
      const labor = Number(part.labor) || 0;

      const resolveDiscount = (gross: number, allowLegacyLabor = false): number => {
        if (storedDiscount > 0 && !allowLegacyLabor) {
          return applyLineDiscount(gross, storedDiscount).discountAmount;
        }
        if (storedDiscount > 0 && allowLegacyLabor) {
          return 0;
        }
        return applyPhSpecialDiscount(gross, discountType).discountAmount;
      };

      if (isCatalogService) {
        const amountGross = labor > 0 ? labor : qty * unitPrice;
        rows.push({
          itemName,
          description: 'Service',
          qty: qty || 1,
          unitPrice: amountGross,
          discountType: storedDiscount > 0 ? 'none' : discountType,
          extPrice: amountGross,
          discountAmount: resolveDiscount(amountGross),
        });
        continue;
      }

      const amountGross = qty * unitPrice;
      rows.push({
        itemName,
        description,
        qty,
        unitPrice,
        discountType: storedDiscount > 0 ? 'none' : discountType,
        extPrice: amountGross,
        discountAmount: resolveDiscount(amountGross),
      });

      if (labor > 0) {
        rows.push({
          itemName: `${itemName} Labor`,
          description: isCustom ? 'Custom item labor' : description,
          qty: 1,
          unitPrice: labor,
          discountType: storedDiscount > 0 ? 'none' : discountType,
          extPrice: labor,
          discountAmount: resolveDiscount(labor, storedDiscount > 0),
        });
      }
    }

    const serviceLabor = Number(current.labor) || 0;
    if (serviceLabor > 0 && !hasCatalogServices) {
      const laborDiscount = applyPhSpecialDiscount(
        serviceLabor,
        normalizePhDiscountType(current.laborDiscountType),
      );
      rows.push({
        itemName: current.type || 'Service Labor',
        description: '',
        qty: 1,
        unitPrice: serviceLabor,
        discountType: normalizePhDiscountType(current.laborDiscountType),
        extPrice: serviceLabor,
        discountAmount: laborDiscount.discountAmount,
      });
    }

    if (rows.length === 0) {
      rows.push({
        itemName: current.type || 'Service',
        description: '',
        qty: 1,
        unitPrice: Number(current.totalSales) || 0,
        discountType: 'none',
        extPrice: Number(current.totalSales) || 0,
        discountAmount: 0,
      });
    }

    const customDiscount = Number(current.customDiscount) || 0;
    if (customDiscount > 0) {
      rows.push({
        itemName: 'Discount',
        description: '',
        qty: 1,
        unitPrice: 0,
        discountType: 'none',
        extPrice: 0,
        discountAmount: customDiscount,
        isCustomDiscount: true,
      });
    }

    return rows;
  });

  readonly subtotal = computed(() =>
    this.lines().reduce((sum, line) => sum + line.extPrice, 0),
  );

  readonly discountTotal = computed(() =>
    this.lines().reduce((sum, line) => sum + line.discountAmount, 0),
  );

  readonly receiptTotal = computed(() => this.subtotal() - this.discountTotal());

  readonly downpaymentAmount = computed(() => Math.max(0, Number(this.item()?.downpayment) || 0));

  readonly amountPaidNow = computed(() => {
    const remaining = Math.max(0, this.receiptTotal() - this.downpaymentAmount());
    return this.isSettledJob() ? remaining : 0;
  });

  readonly balanceDueAmount = computed(() => {
    const remaining = Math.max(0, this.receiptTotal() - this.downpaymentAmount());
    return this.isSettledJob() ? 0 : remaining;
  });

  readonly paymentMethodLabel = computed(() => String(this.item()?.paymentMethod ?? '').trim());

  private isSettledJob(): boolean {
    return String(this.item()?.status ?? '').trim().toLowerCase() === 'done';
  }

  readonly barcodeBars = computed(() => this.buildBarcodeBars(this.receiptNo()));
  readonly barcodeBarStyle = barcodeBarStyle;

  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) {
      return null;
    }
    return this.templates().find((template) => template.id === id) ?? null;
  });

  readonly useCustomTemplate = computed(() => !!this.selectedTemplate());

  readonly rawTemplateElements = computed(
    () => this.selectedTemplate()?.layout?.elements ?? [],
  );

  readonly templateTableElement = computed(
    () =>
      this.rawTemplateElements().find(
        (element) => element.type === 'table' || element.fieldKey === 'lineItems',
      ) ?? null,
  );

  readonly templateHeaderElements = computed(() => {
    const table = this.templateTableElement();
    const elements = this.rawTemplateElements();
    if (!table) {
      return elements;
    }
    return elements.filter((element) => element.id !== table.id && element.y <= table.y + 0.5);
  });

  readonly templateFooterElements = computed(() => {
    const table = this.templateTableElement();
    const elements = this.rawTemplateElements();
    if (!table) {
      return [];
    }
    return elements.filter((element) => element.id !== table.id && element.y > table.y + 0.5);
  });

  readonly templateFooterOriginY = computed(() => {
    const ys = this.templateFooterElements()
      .filter((element) => !this.isHiddenElement(element))
      .map((element) => element.y);
    return ys.length ? Math.min(...ys) : 0;
  });

readonly activeTemplates = computed(() =>
    this.templates().filter((template) => template.isActive !== false),
  );

  readonly fieldValues = computed<Record<string, string>>(() => {
    const job = this.item();
    const settings = this.printingSettings();
    const printed = this.printedAt();
    const receiptNo = this.receiptNo();
    const cashier = this.cashierName();

    const printedAtLabel = printed.toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const printedDateLabel = printed.toLocaleDateString('en-US');

    return {
      reprintedLabel: this.showReprinted() ? 'REPRINTED' : '',
      printedAt: `Printed: ${printedAtLabel}`,
      printedDate: `Date: ${printedDateLabel}`,
      storeCode: `Store: ${settings?.storeCode || '1'}`,
      workstationNo: `Workstation: ${settings?.workstationNo || '1'}`,
      pageNumber: settings?.showPageNumbers === false ? '' : 'Page 1',
      storeLogo: '/images/logopcm.png',
      storeName: this.storeDisplayName(),
      storeAddress: this.storeDisplayAddress(),
      receiptNo: `Sales Receipt #${receiptNo}`,
      cashierName: `Cashier: ${cashier}`,
      customerName: job?.customerName || '',
      customerPhone: job?.customerContact || '',
      customerEmail: job?.customerEmail || '',
      customerAddress: job?.customerAddress || '',
      billToLine: this.billToLine(job),
      addressLine: job?.customerAddress?.trim()
        ? `Address: ${job.customerAddress.trim()}`
        : '',
      jobNotes: String(job?.notes ?? '').trim(),
      discountTotal: `Total Sales Discounts: ${this.formatMoney(this.discountTotal())}`,
      subtotal: `Subtotal  ${this.formatMoney(this.subtotal())}`,
      receiptTotal: `RECEIPT TOTAL  ${this.formatMoney(this.receiptTotal())}`,
      downpaymentLine: `Downpayment  ${this.formatMoney(this.downpaymentAmount())}`,
      amountPaidLine: `Amount paid  ${this.formatMoney(this.amountPaidNow())}`,
      balanceDueLine: `Balance due  ${this.formatMoney(this.balanceDueAmount())}`,
      paymentMethodLine: this.paymentMethodLabel()
        ? `Payment method  ${this.paymentMethodLabel()}`
        : '',
      warrantyPolicy: this.warrantyPolicyText(),
      footerNote: this.footerNoteText(),
      thanksMessage: this.thanksMessageText(),
      barcode: receiptNo,
      signatureLine: '',
      lineItems: 'Line items',
    };
  });

  ngOnInit(): void {
    this.autoPrint.set(this.route.snapshot.queryParamMap.get('print') === '1');
    this.autoReprint.set(this.route.snapshot.queryParamMap.get('reprint') === '1');
    void this.loadReceipt();
  }

  ngOnDestroy(): void {
    this.printStyleEl?.remove();
    this.printStyleEl = null;
  }

  async loadReceipt(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid job order.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const [serviceResponse, templatesResult, settingsResult] = await Promise.all([
        firstValueFrom(this.adminApi.getInventoryService(id)),
        firstValueFrom(this.adminApi.listPrintingTemplates('sales_receipt')).catch(() => null),
        firstValueFrom(this.adminApi.getPrintingSettings()).catch(() => null),
      ]);

      this.item.set(serviceResponse.data);
      this.printedAt.set(new Date());

      const receiptContent = {
        warrantyPolicy: settingsResult?.data?.warrantyPolicy || DEFAULT_WARRANTY_POLICY,
        footerNote: settingsResult?.data?.footerNote || DEFAULT_FOOTER_NOTE,
        thanksMessage: settingsResult?.data?.thanksMessage || DEFAULT_THANKS_MESSAGE,
      };
      const templates = (templatesResult?.data ?? [])
        .filter((template) => template.documentType === 'sales_receipt' || !template.documentType)
        .map((template) => {
          const layout =
            template.name.trim().toLowerCase() === 'job order sales receipt'
              ? jobOrderSalesReceiptLayout()
              : template.layout;
          return fitReceiptTemplate({ ...template, layout }, receiptContent);
        });
      this.templates.set(templates);
      this.printingSettings.set(settingsResult?.data ?? null);
      this.selectedTemplateId.set(this.resolveInitialTemplateId(templates, settingsResult?.data));
      this.applyPrintPageStyle();

      if (this.autoPrint() && !this.isCancelled()) {
        queueMicrotask(() => {
          setTimeout(() => {
            if (this.autoReprint()) {
              this.reprintReceipt();
            } else {
              this.printReceipt();
            }
          }, 350);
        });
      }
    } catch {
      this.error.set('Unable to load job order receipt.');
    } finally {
      this.loading.set(false);
    }
  }

  onTemplateChange(rawValue: string | number): void {
    const nextId = Number(rawValue);
    this.selectedTemplateId.set(Number.isFinite(nextId) ? nextId : BUILTIN_TEMPLATE_VALUE);
    this.applyPrintPageStyle();
    try {
      sessionStorage.setItem(TEMPLATE_STORAGE_KEY, String(this.selectedTemplateId()));
    } catch {
      // ignore storage errors
    }
  }

  isCancelled(): boolean {
    return String(this.item()?.status ?? '').trim().toLowerCase() === 'cancelled';
  }

  printReceipt(): void {
    if (this.isCancelled()) {
      return;
    }
    this.openPrintDialog(false);
  }

  reprintReceipt(): void {
    if (this.isCancelled()) {
      return;
    }
    this.openPrintDialog(true);
  }

  private openPrintDialog(reprinted: boolean): void {
    this.showReprinted.set(reprinted);
    this.printedAt.set(new Date());
    this.applyPrintPageStyle();
    this.changeDetector.detectChanges();
    setTimeout(() => window.print(), 0);
  }

  backToJob(): void {
    const id = this.item()?.id;
    if (id) {
      void this.router.navigate(['/admin/job-order', id]);
      return;
    }
    void this.router.navigate(['/admin/job-order']);
  }

  formatMoney(value: number): string {
    return `P${value.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDiscount(line: ReceiptLine): string {
    if (line.discountAmount <= 0) {
      return '—';
    }

    if (line.isCustomDiscount) {
      return this.formatMoney(line.discountAmount);
    }

    const label =
      line.discountType === 'senior' ? 'SC' : line.discountType === 'pwd' ? 'PWD' : '';
    const amount = this.formatMoney(line.discountAmount);
    return label ? `${label} ${amount}` : amount;
  }

  templateSheetStyle(): Record<string, string> {
    const template = this.selectedTemplate();
    const settings = this.printingSettings();
    const widthMm = template?.paperWidthMm || 210;
    const heightMm = template?.paperHeightMm || 297;
    return {
      width: `${widthMm}mm`,
      minHeight: `${heightMm}mm`,
      fontFamily: settings?.fontFamily || `'Times New Roman', Times, serif`,
    };
  }

  printPageCss(): string {
    return receiptPrintPageCss({
      widthMm: A4_PRINT_WIDTH_MM,
      heightMm: A4_PRINT_HEIGHT_MM,
    });
  }

  private applyPrintPageStyle(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (!this.printStyleEl) {
      this.printStyleEl = document.createElement('style');
      this.printStyleEl.setAttribute('data-pcmazing-receipt-print', 'true');
      document.head.appendChild(this.printStyleEl);
    }
    this.printStyleEl.textContent = this.printPageCss();
  }

  elementStyle(element: PrintLayoutElement): Record<string, string> {
    const width = element.width ?? (element.type === 'line' ? 40 : 30);
    const height = element.height ?? (element.type === 'line' ? 2 : 8);
    return {
      left: `${element.x}mm`,
      top: `${element.y}mm`,
      width: `${width}mm`,
      height: `${height}mm`,
      fontSize: `${element.fontSize || 11}pt`,
      fontWeight: element.fontWeight || 'normal',
      textAlign: element.textAlign || 'left',
    };
  }

  flowBodyStyle(): Record<string, string> {
    const table = this.templateTableElement();
    const topMm = table && table.y != null ? table.y : 94;
    const template = this.selectedTemplate();
    return {
      top: `${topMm}mm`,
      left: '0',
      width: `${template?.paperWidthMm || 210}mm`,
    };
  }

  flowTableStyle(): Record<string, string> {
    const table = this.templateTableElement();
    return {
      marginLeft: `${table?.x ?? 10}mm`,
      width: `${table?.width ?? 190}mm`,
      fontSize: `${table?.fontSize || 10}pt`,
    };
  }

  flowFooterStyle(): Record<string, string> {
    const elements = this.templateFooterElements().filter((element) => !this.isHiddenElement(element));
    if (!elements.length) {
      return { minHeight: '0' };
    }
    const origin = this.templateFooterOriginY();
    const bottom = Math.max(...elements.map((element) => element.y + (element.height ?? 8) - origin));
    return {
      minHeight: `${Math.max(bottom, 8)}mm`,
    };
  }

  
flowFooterElementStyle(element: PrintLayoutElement): Record<string, string> {
    const origin = this.templateFooterOriginY();
    const width = element.width ?? (element.type === 'line' ? 40 : 30);
    const height = element.height ?? (element.type === 'line' ? 2 : 8);
    return {
      left: `${element.x}mm`,
      top: `${roundMm(element.y - origin)}mm`,
      width: `${width}mm`,
      height: `${height}mm`,
      fontSize: `${element.fontSize || 11}pt`,
      fontWeight: element.fontWeight || 'normal',
      textAlign: element.textAlign || 'left',
    };
  }

  barcodeWrapStyle(element: PrintLayoutElement): Record<string, string> {
    const align = element.textAlign || 'center';
    const alignItems =
      align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';

    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems,
      width: '100%',
      height: '100%',
    };
  }

  fieldValue(element: PrintLayoutElement): string {
    if (element.fieldKey === 'reprintedLabel' && !this.showReprinted()) {
      return '';
    }

    const contentKey = receiptContentFieldKeyFor(element);
    if (contentKey === 'warrantyPolicy') {
      return this.warrantyPolicyText();
    }
    if (contentKey === 'footerNote') {
      return this.footerNoteText();
    }
    if (contentKey === 'thanksMessage') {
      return this.thanksMessageText();
    }

    if (element.type === 'text') {
      return element.content || element.label || '';
    }
    return this.fieldValues()[element.fieldKey || ''] ?? element.content ?? element.label ?? '';
  }

  isHiddenElement(element: PrintLayoutElement): boolean {
    if (element.fieldKey === 'reprintedLabel' && !this.showReprinted()) {
      return true;
    }
    if (element.fieldKey === 'pageNumber' && this.printingSettings()?.showPageNumbers === false) {
      return true;
    }
    if (element.fieldKey === 'paymentMethodLine' && !this.fieldValues()['paymentMethodLine']) {
      return true;
    }
    if (element.fieldKey === 'billToLine' && !this.fieldValues()['billToLine']) {
      return true;
    }
    if (element.fieldKey === 'addressLine' && !this.fieldValues()['addressLine']) {
      return true;
    }
    if (element.fieldKey === 'customerPhone' && !this.fieldValues()['customerPhone']) {
      return true;
    }
    if (element.fieldKey === 'customerEmail' && !this.fieldValues()['customerEmail']) {
      return true;
    }
    if (element.fieldKey === 'customerAddress' && !this.fieldValues()['customerAddress']) {
      return true;
    }
    return false;
  }

  usesPreWrapField(elementOrKey?: PrintLayoutElement | string): boolean {
    const fieldKey =
      typeof elementOrKey === 'string' || elementOrKey == null
        ? elementOrKey
        : receiptContentFieldKeyFor(elementOrKey) || elementOrKey.fieldKey;
    return (
      fieldKey === 'warrantyPolicy' ||
      fieldKey === 'footerNote' ||
      fieldKey === 'thanksMessage' ||
      fieldKey === 'jobNotes' ||
      fieldKey === 'customerAddress' ||
      fieldKey === 'addressLine' ||
      fieldKey === 'billToLine'
    );
  }

  private resolveInitialTemplateId(
    templates: PrintingTemplateItem[],
    settings: PrintingSettingsItem | null | undefined,
  ): number {
    let stored: number | null = null;
    try {
      const raw = sessionStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (raw != null) {
        stored = Number(raw);
      }
    } catch {
      stored = null;
    }

    if (stored === BUILTIN_TEMPLATE_VALUE) {
      return BUILTIN_TEMPLATE_VALUE;
    }

    if (stored && templates.some((template) => template.id === stored && template.isActive !== false)) {
      return stored;
    }

    if (
      settings?.defaultTemplateId &&
      templates.some((template) => template.id === settings.defaultTemplateId && template.isActive !== false)
    ) {
      return settings.defaultTemplateId;
    }

    const defaultTemplate = templates.find((template) => template.isDefault && template.isActive !== false);
    if (defaultTemplate) {
      return defaultTemplate.id;
    }

    const firstActive = templates.find((template) => template.isActive !== false);
    return firstActive?.id ?? BUILTIN_TEMPLATE_VALUE;
  }

  storeDisplayName(): string {
    const value = this.printingSettings()?.storeName?.trim();
    if (!value || value === 'PCmazing') {
      return DEFAULT_STORE_NAME;
    }
    return value;
  }

  storeDisplayAddress(): string {
    const value = this.printingSettings()?.storeAddress?.trim();
    if (!value || value === 'Mabini Extension, Cabanatuan City, 3100') {
      return DEFAULT_STORE_ADDRESS;
    }
    return value;
  }

  billToLine(job?: InventoryServiceItem | null): string {
    const name = job?.customerName?.trim() || '';
    const contact = job?.customerContact?.trim() || '';
    if (!name && !contact) {
      return '';
    }
    if (contact) {
      return `Bill To: ${name || '—'}         Contact: ${contact}`;
    }
    return `Bill To: ${name}`;
  }

  warrantyPolicyText(): string {
    return compactReceiptText(this.printingSettings()?.warrantyPolicy || DEFAULT_WARRANTY_POLICY);
  }

  footerNoteText(): string {
    return compactReceiptText(this.printingSettings()?.footerNote || DEFAULT_FOOTER_NOTE);
  }

  thanksMessageText(): string {
    return compactReceiptText(this.printingSettings()?.thanksMessage || DEFAULT_THANKS_MESSAGE);
  }

  private buildBarcodeBars(value: string): Array<{ width: number; filled: boolean }> {
    const digits = value.replace(/\D+/g, '') || '0';
    const bars: Array<{ width: number; filled: boolean }> = [
      { width: 2, filled: true },
      { width: 1, filled: false },
      { width: 2, filled: true },
      { width: 1, filled: false },
    ];

    for (const char of digits) {
      const n = Number(char);
      bars.push(
        { width: 1 + (n % 3), filled: true },
        { width: 1 + ((n + 1) % 2), filled: false },
        { width: 1 + ((n + 2) % 3), filled: true },
        { width: 1, filled: false },
      );
    }

    bars.push({ width: 2, filled: true }, { width: 1, filled: false }, { width: 3, filled: true });
    return bars;
  }
}
