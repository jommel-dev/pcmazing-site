import { DatePipe, DecimalPipe, NgStyle } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import {
  AdminApiService,
  PrintingSettingsItem,
  PrintingTemplateItem,
  SalesOrderDetail,
} from '../../services/admin-api.service';
import { PrintLayoutElement } from '../printing/printing.types';
import {
  DEFAULT_FOOTER_NOTE,
  DEFAULT_THANKS_MESSAGE,
  DEFAULT_WARRANTY_POLICY,
} from '../printing/printing-receipt-content.defaults';
import {
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

const TEMPLATE_STORAGE_KEY = 'pcmazing.salesReceipt.selectedTemplateId';
const BUILTIN_TEMPLATE_VALUE = 0;

@Component({
  selector: 'app-sales-order-receipt-page',
  imports: [RouterLink, DatePipe, DecimalPipe, FormsModule, NgStyle],
  templateUrl: './sales-order-receipt-page.component.html',
  styleUrl: './sales-order-receipt-page.component.css',
})
export class SalesOrderReceiptPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<SalesOrderDetail | null>(null);
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
    const current = this.order();
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
    const current = this.order();
    if (!current) {
      return [];
    }

    const rows: ReceiptLine[] = [];
    for (const item of current.items ?? []) {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountType = normalizePhDiscountType(item.discountType);
      const amountGross = qty * unitPrice;
      const amountDiscount = applyPhSpecialDiscount(amountGross, discountType);
      rows.push({
        itemName: item.materialName || item.materialCode || 'Item',
        description: String(item.description ?? '').trim(),
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
  readonly receiptTotal = computed(() => this.subtotal() - this.discountTotal());
  readonly barcodeBars = computed(() => this.buildBarcodeBars(this.receiptNo()));

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
    const current = this.order();
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
    const voidLabel = current?.isVoid ? 'VOID' : '';

    return {
      reprintedLabel: this.showReprinted() ? 'REPRINTED' : voidLabel,
      printedAt: `Printed: ${printedAtLabel}`,
      printedDate: `Date: ${printedDateLabel}`,
      storeCode: `Store: ${settings?.storeCode || '1'}`,
      workstationNo: `Workstation: ${settings?.workstationNo || '1'}`,
      pageNumber: settings?.showPageNumbers === false ? '' : 'Page 1',
      storeLogo: '/images/logopcm.png',
      storeName: settings?.storeName || 'PCmazing',
      storeAddress: settings?.storeAddress || 'Mabini Extension, Cabanatuan City, 3100',
      receiptNo: `Sales Receipt #${receiptNo}`,
      cashierName: `Cashier: ${cashier}`,
      customerName: current?.customerName || '',
      customerPhone: current?.customerPhone || '',
      jobNotes: String(current?.notes ?? '').trim(),
      discountTotal: `Total Sales Discounts: ${this.formatMoney(this.discountTotal())}`,
      subtotal: `Subtotal  ${this.formatMoney(this.subtotal())}`,
      receiptTotal: `RECEIPT TOTAL  ${this.formatMoney(this.receiptTotal())}`,
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

  async loadReceipt(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid sales order.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');

    try {
      const [orderResponse, templatesResult, settingsResult] = await Promise.all([
        firstValueFrom(this.adminApi.getSalesOrder(id)),
        firstValueFrom(this.adminApi.listPrintingTemplates('sales_receipt')).catch(() => null),
        firstValueFrom(this.adminApi.getPrintingSettings()).catch(() => null),
      ]);

      this.order.set(orderResponse.data);
      this.printedAt.set(new Date());

      const templates = (templatesResult?.data ?? []).filter(
        (template) => template.documentType === 'sales_receipt' || !template.documentType,
      );
      this.templates.set(templates);
      this.printingSettings.set(settingsResult?.data ?? null);
      this.selectedTemplateId.set(this.resolveInitialTemplateId(templates, settingsResult?.data));

      if (this.autoPrint()) {
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
      this.error.set('Unable to load sales order receipt.');
    } finally {
      this.loading.set(false);
    }
  }

  onTemplateChange(rawValue: string | number): void {
    const nextId = Number(rawValue);
    this.selectedTemplateId.set(Number.isFinite(nextId) ? nextId : BUILTIN_TEMPLATE_VALUE);
    try {
      sessionStorage.setItem(TEMPLATE_STORAGE_KEY, String(this.selectedTemplateId()));
    } catch {
      // ignore storage errors
    }
  }

  printReceipt(): void {
    this.openPrintDialog(false);
  }

  reprintReceipt(): void {
    this.openPrintDialog(true);
  }

  private openPrintDialog(reprinted: boolean): void {
    this.showReprinted.set(reprinted);
    this.printedAt.set(new Date());
    this.changeDetector.detectChanges();
    setTimeout(() => window.print(), 0);
  }

  backToOrder(): void {
    const id = this.order()?.id;
    if (id) {
      void this.router.navigate(['/admin/sales-order', id]);
      return;
    }
    void this.router.navigate(['/admin/sales-order']);
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

  barcodeWrapStyle(element: PrintLayoutElement): Record<string, string> {
    const align = element.textAlign || 'center';
    const alignItems = align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start';
    return { display: 'flex', flexDirection: 'column', alignItems, width: '100%', height: '100%' };
  }

  fieldValue(element: PrintLayoutElement): string {
    if (element.type === 'text') {
      return element.content || element.label || '';
    }
    if (element.fieldKey === 'reprintedLabel' && !this.showReprinted() && !this.order()?.isVoid) {
      return '';
    }
    return this.fieldValues()[element.fieldKey || ''] ?? element.content ?? element.label ?? '';
  }

  isHiddenElement(element: PrintLayoutElement): boolean {
    if (element.fieldKey === 'reprintedLabel' && !this.showReprinted() && !this.order()?.isVoid) {
      return true;
    }
    if (element.fieldKey === 'pageNumber' && this.printingSettings()?.showPageNumbers === false) {
      return true;
    }
    if (element.fieldKey === 'jobNotes' && !this.fieldValues()['jobNotes']) {
      return true;
    }
    if (element.fieldKey === 'customerPhone' && !this.fieldValues()['customerPhone']) {
      return true;
    }
    return false;
  }

  usesPreWrapField(fieldKey?: string): boolean {
    return fieldKey === 'warrantyPolicy' || fieldKey === 'jobNotes';
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

  warrantyPolicyText(): string {
    return this.printingSettings()?.warrantyPolicy?.trim() || DEFAULT_WARRANTY_POLICY;
  }

  footerNoteText(): string {
    return this.printingSettings()?.footerNote?.trim() || DEFAULT_FOOTER_NOTE;
  }

  thanksMessageText(): string {
    return this.printingSettings()?.thanksMessage?.trim() || DEFAULT_THANKS_MESSAGE;
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
