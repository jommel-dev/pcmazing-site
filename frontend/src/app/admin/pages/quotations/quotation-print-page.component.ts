import { DatePipe, DecimalPipe, NgStyle } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminApiService,
  PrintingSettingsItem,
  PrintingTemplateItem,
  QuotationDetail,
  QuotationSource,
} from '../../services/admin-api.service';
import { PrintLayoutElement } from '../printing/printing.types';
import {
  A4_PRINT_HEIGHT_MM,
  A4_PRINT_WIDTH_MM,
  receiptPrintPageCss,
} from '../printing/printing-print-page.util';
import { applyPhSpecialDiscount, normalizePhDiscountType, PhDiscountType } from '../inventory/ph-discount.util';

type QuoteLine = {
  itemName: string;
  description: string;
  qty: number;
  unitPrice: number;
  discountType: PhDiscountType;
  extPrice: number;
  discountAmount: number;
  isCustomDiscount?: boolean;
};

const TEMPLATE_STORAGE_KEY = 'pcmazing.quotation.selectedTemplateId';
const BUILTIN_TEMPLATE_VALUE = 0;

@Component({
  selector: 'app-quotation-print-page',
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule, NgStyle],
  templateUrl: './quotation-print-page.component.html',
  styleUrl: './quotation-print-page.component.css',
})
export class QuotationPrintPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private printStyleEl: HTMLStyleElement | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly quotation = signal<QuotationDetail | null>(null);
  readonly printedAt = signal(new Date());
  readonly autoPrint = signal(false);
  readonly templates = signal<PrintingTemplateItem[]>([]);
  readonly printingSettings = signal<PrintingSettingsItem | null>(null);
  readonly selectedTemplateId = signal<number>(BUILTIN_TEMPLATE_VALUE);
  readonly source = signal<QuotationSource | undefined>(undefined);

  readonly preparedBy = computed(
    () => this.adminAuth.getStoredUser()?.fullName || this.adminAuth.getStoredUser()?.username || '',
  );

  readonly quotationNo = computed(() => {
    const current = this.quotation();
    if (!current) {
      return '';
    }
    return current.quoteNo?.trim() || `QT-${String(current.id).padStart(6, '0')}`;
  });

  readonly lines = computed<QuoteLine[]>(() => {
    const current = this.quotation();
    if (!current) {
      return [];
    }

    const rows: QuoteLine[] = [];
    for (const item of current.items ?? []) {
      const qty = Number(item.quantity || item.totalSetQty) || 0;
      const unitPrice = Number(item.unitPrice || item.sellPrice) || 0;
      const discountType = normalizePhDiscountType(item.discountType);
      const amountGross = qty * unitPrice;
      const amountDiscount = applyPhSpecialDiscount(amountGross, discountType);
      rows.push({
        itemName: item.materialName || item.description || 'Item',
        description: item.materialName && item.description !== item.materialName ? item.description : '',
        qty,
        unitPrice,
        discountType,
        extPrice: amountGross,
        discountAmount: amountDiscount.discountAmount,
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

  readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + line.extPrice, 0));
  readonly discountTotal = computed(() => this.lines().reduce((sum, line) => sum + line.discountAmount, 0));
  readonly quoteTotal = computed(() => this.subtotal() - this.discountTotal());

  readonly selectedTemplate = computed(() => {
    const id = this.selectedTemplateId();
    if (!id) {
      return null;
    }
    return this.templates().find((template) => template.id === id) ?? null;
  });

  readonly useCustomTemplate = computed(() => !!this.selectedTemplate());
  readonly templateElements = computed(() => this.selectedTemplate()?.layout?.elements ?? []);
  readonly activeTemplates = computed(() => this.templates().filter((template) => template.isActive !== false));

  readonly fieldValues = computed<Record<string, string>>(() => {
    const current = this.quotation();
    const settings = this.printingSettings();
    const printed = this.printedAt();
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
    const validUntil = current?.expiresAt ? new Date(current.expiresAt).toLocaleDateString('en-US') : '';
    const contact = current?.customerContactPerson || current?.customerContactNumber || '';

    return {
      printedAt: `Printed: ${printedAtLabel}`,
      printedDate: `Date: ${printedDateLabel}`,
      pageNumber: settings?.showPageNumbers === false ? '' : 'Page 1',
      storeLogo: '/images/logopcm.png',
      storeName: settings?.storeName || 'PCmazing',
      storeAddress: settings?.storeAddress || 'Mabini Extension, Cabanatuan City, 3100',
      customerName: current?.customerName || '',
      customerEmail: current?.customerEmail || '',
      customerAddress: current?.customerAddress || '',
      customerPhone: current?.customerContactNumber || '',
      billToLine: current?.customerName
        ? `Bill To: ${current.customerName}${contact ? `         Contact: ${contact}` : ''}`
        : '',
      quotationNo: this.quotationNo(),
      validUntil: validUntil ? `Valid until: ${validUntil}` : '',
      discountTotal: `Total Discounts: ${this.formatMoney(this.discountTotal())}`,
      subtotal: `Subtotal  ${this.formatMoney(this.subtotal())}`,
      signatureLine: '',
      lineItems: 'Line items',
    };
  });

  ngOnInit(): void {
    this.autoPrint.set(this.route.snapshot.queryParamMap.get('print') === '1');
    const source = this.route.snapshot.queryParamMap.get('source');
    this.source.set(source === 'legacy' || source === 'pcmazing' ? source : undefined);
    void this.loadQuote();
  }

  ngOnDestroy(): void {
    this.printStyleEl?.remove();
    this.printStyleEl = null;
  }

  async loadQuote(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid quotation.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const [quoteResponse, templatesResult, settingsResult] = await Promise.all([
        firstValueFrom(this.adminApi.getQuotation(id, this.source())),
        firstValueFrom(this.adminApi.listPrintingTemplates('quotation')).catch(() => null),
        firstValueFrom(this.adminApi.getPrintingSettings()).catch(() => null),
      ]);

      this.quotation.set(quoteResponse.data);
      this.source.set(quoteResponse.data.source);
      this.printedAt.set(new Date());

      const templates = (templatesResult?.data ?? []).filter(
        (template) => template.documentType === 'quotation' || !template.documentType,
      );
      this.templates.set(templates);
      this.printingSettings.set(settingsResult?.data ?? null);
      this.selectedTemplateId.set(this.resolveInitialTemplateId(templates, settingsResult?.data));
      this.applyPrintPageStyle();

      if (this.autoPrint()) {
        queueMicrotask(() => {
          setTimeout(() => this.printQuote(), 350);
        });
      }
    } catch {
      this.error.set('Unable to load quotation for printing.');
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

  printQuote(): void {
    this.printedAt.set(new Date());
    this.applyPrintPageStyle();
    this.changeDetector.detectChanges();
    setTimeout(() => window.print(), 0);
  }

  backToQuote(): void {
    const current = this.quotation();
    if (current) {
      void this.router.navigate(['/admin/quotations', current.id], {
        queryParams: current.source ? { source: current.source } : {},
      });
      return;
    }
    void this.router.navigate(['/admin/quotations']);
  }

  formatMoney(value: number): string {
    return `P${value.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  formatDiscount(line: QuoteLine): string {
    if (line.discountAmount <= 0) {
      return '—';
    }
    if (line.isCustomDiscount) {
      return this.formatMoney(line.discountAmount);
    }
    const label = line.discountType === 'senior' ? 'SC' : line.discountType === 'pwd' ? 'PWD' : '';
    const amount = this.formatMoney(line.discountAmount);
    return label ? `${label} ${amount}` : amount;
  }

  templateSheetStyle(): Record<string, string> {
    const template = this.selectedTemplate();
    const settings = this.printingSettings();
    return {
      width: `${template?.paperWidthMm || 210}mm`,
      minHeight: `${template?.paperHeightMm || 297}mm`,
      fontFamily: settings?.fontFamily || `'Times New Roman', Times, serif`,
    };
  }

  private applyPrintPageStyle(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (!this.printStyleEl) {
      this.printStyleEl = document.createElement('style');
      this.printStyleEl.setAttribute('data-pcmazing-quotation-print', 'true');
      document.head.appendChild(this.printStyleEl);
    }
    this.printStyleEl.textContent = receiptPrintPageCss({
      widthMm: A4_PRINT_WIDTH_MM,
      heightMm: A4_PRINT_HEIGHT_MM,
    });
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

  fieldValue(element: PrintLayoutElement): string {
    if (element.type === 'text') {
      return element.content || element.label || '';
    }
    return this.fieldValues()[element.fieldKey || ''] ?? element.content ?? element.label ?? '';
  }

  isHiddenElement(element: PrintLayoutElement): boolean {
    if (element.fieldKey === 'pageNumber' && this.printingSettings()?.showPageNumbers === false) {
      return true;
    }
    if (element.fieldKey === 'customerEmail' && !this.fieldValues()['customerEmail']) {
      return true;
    }
    if (element.fieldKey === 'customerAddress' && !this.fieldValues()['customerAddress']) {
      return true;
    }
    if (element.fieldKey === 'validUntil' && !this.fieldValues()['validUntil']) {
      return true;
    }
    return false;
  }

  usesPreWrapField(element: PrintLayoutElement): boolean {
    return element.fieldKey === 'customerAddress' || element.fieldKey === 'storeAddress';
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
    return BUILTIN_TEMPLATE_VALUE;
  }
}
