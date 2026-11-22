import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminApiService, SalesOrderDetail } from '../../services/admin-api.service';
import {
  applyPhSpecialDiscount,
  normalizePhDiscountType,
} from './ph-discount.util';
import { normalizeSalesOrderDetail } from './sales-order.util';
import {
  SALES_INVOICE_LETTERHEAD,
  SALES_INVOICE_TERMS,
  SO_INVOICE_MAX_ITEMS,
  computeInvoicePaymentSummary,
  formatInvoiceMoney,
  padInvoiceRows,
} from './sales-invoice.util';

type InvoiceLine = {
  code: string;
  description: string;
  serialNo: string;
  qty: number | '';
  unit: string;
  unitPrice: number | '';
  amount: number | '';
};

@Component({
  selector: 'app-sales-order-receipt-page',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './sales-order-receipt-page.component.html',
  styleUrl: './sales-order-receipt-page.component.css',
})
export class SalesOrderReceiptPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);
  private printStyleEl: HTMLStyleElement | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<SalesOrderDetail | null>(null);
  readonly autoPrint = signal(false);
  readonly showReprinted = signal(false);
  readonly letterhead = SALES_INVOICE_LETTERHEAD;
  readonly terms = SALES_INVOICE_TERMS;

  readonly cashierName = computed(() => {
    const fromOrder = this.order()?.salesperson?.trim();
    if (fromOrder) {
      return fromOrder;
    }
    return (
      this.adminAuth.getStoredUser()?.fullName ||
      this.adminAuth.getStoredUser()?.username ||
      ''
    );
  });

  readonly invoiceNo = computed(() => {
    const current = this.order();
    if (!current) {
      return '';
    }
    return current.referenceNo?.trim() || String(current.id);
  });

  readonly totalSales = computed(() => {
    const current = this.order();
    if (!current) {
      return 0;
    }
    if (current.manualTotalAmount != null && Number.isFinite(Number(current.manualTotalAmount))) {
      return Math.max(0, Number(current.manualTotalAmount));
    }
    return Math.max(0, Number(current.totalAmount) || 0);
  });

  readonly paymentSummary = computed(() =>
    computeInvoicePaymentSummary({
      totalSales: this.totalSales(),
      withholdingTax: Number(this.order()?.withholdingTax) || 0,
      amountPaid: Number(this.order()?.amountPaid) || 0,
    }),
  );

  readonly invoiceRows = computed(() => {
    const current = this.order();
    const items = (current?.items ?? []).slice(0, SO_INVOICE_MAX_ITEMS);
    const mapped: InvoiceLine[] = items.map((item) => {
      const qty = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountType = normalizePhDiscountType(item.discountType);
      const amount = applyPhSpecialDiscount(qty * unitPrice, discountType).net;
      const description =
        String(item.description ?? '').trim() ||
        item.customItemName ||
        item.materialName ||
        '';
      return {
        code: item.materialCode?.trim() || '',
        description,
        serialNo: item.serialNo?.trim() || '',
        qty,
        unit: item.unit?.trim() || 'PCS',
        unitPrice,
        amount,
      };
    });
    return padInvoiceRows(mapped, SO_INVOICE_MAX_ITEMS);
  });

  readonly isCash = computed(() => (this.order()?.salesType ?? 'cash') !== 'charge');
  readonly isCharge = computed(() => (this.order()?.salesType ?? 'cash') === 'charge');

  ngOnInit(): void {
    this.autoPrint.set(this.route.snapshot.queryParamMap.get('print') === '1');
    this.showReprinted.set(this.route.snapshot.queryParamMap.get('reprint') === '1');
    void this.load();
  }

  ngOnDestroy(): void {
    this.removePrintStyle();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid sales order.');
      this.loading.set(false);
      return;
    }

    try {
      const response = await firstValueFrom(this.adminApi.getSalesOrder(id));
      this.order.set(normalizeSalesOrderDetail(response.data));
      if (this.autoPrint()) {
        setTimeout(() => this.printInvoice(), 250);
      }
    } catch {
      this.error.set('Unable to load sales invoice.');
    } finally {
      this.loading.set(false);
    }
  }

  printInvoice(): void {
    this.injectPrintStyle();
    window.print();
  }

  fill(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  money(value: number | '' | null | undefined): string {
    return formatInvoiceMoney(value);
  }

  /** Split ship-to text across the three handwriting lines on the form. */
  shipLine(value: string | null | undefined, index: number): string {
    const text = this.fill(value);
    if (!text) {
      return '';
    }
    const parts = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts[index] ?? '';
    }
    const chunk = Math.ceil(text.length / 3) || 1;
    return text.slice(index * chunk, (index + 1) * chunk).trim();
  }

  private injectPrintStyle(): void {
    this.removePrintStyle();
    const style = document.createElement('style');
    style.setAttribute('data-sales-invoice-print', '1');
    style.textContent = `@page { size: A4 portrait; margin: 8mm; }`;
    document.head.appendChild(style);
    this.printStyleEl = style;
  }

  private removePrintStyle(): void {
    this.printStyleEl?.remove();
    this.printStyleEl = null;
  }
}
