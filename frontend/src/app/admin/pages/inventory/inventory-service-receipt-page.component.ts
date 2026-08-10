import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminAuthService } from '../../services/admin-auth.service';
import { AdminApiService, InventoryServiceItem } from '../../services/admin-api.service';
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
};

@Component({
  selector: 'app-inventory-service-receipt-page',
  imports: [RouterLink, DatePipe, DecimalPipe],
  templateUrl: './inventory-service-receipt-page.component.html',
  styleUrl: './inventory-service-receipt-page.component.css',
})
export class InventoryServiceReceiptPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly item = signal<InventoryServiceItem | null>(null);
  readonly printedAt = signal(new Date());
  readonly autoPrint = signal(false);

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
    for (const part of current.parts ?? []) {
      const qty = Number(part.quantity) || 0;
      const unitPrice = Number(part.unitPrice) || 0;
      const discountType = normalizePhDiscountType(part.discountType);
      const isCustom = !part.materialId && !!part.customItemName?.trim();
      const itemName = (
        part.materialName ||
        part.customItemName ||
        part.materialCode ||
        'Item'
      ).trim();
      const description = isCustom
        ? ''
        : String(part.description ?? '').trim();

      const amountGross = qty * unitPrice;
      const amountDiscount = applyPhSpecialDiscount(amountGross, discountType);
      rows.push({
        itemName,
        description,
        qty,
        unitPrice,
        discountType,
        extPrice: amountGross,
        discountAmount: amountDiscount.discountAmount,
      });

      const labor = Number(part.labor) || 0;
      if (labor > 0) {
        const laborDiscount = applyPhSpecialDiscount(labor, discountType);
        rows.push({
          itemName: `${itemName} Labor`,
          description: isCustom ? 'Custom item labor' : description,
          qty: 1,
          unitPrice: labor,
          discountType,
          extPrice: labor,
          discountAmount: laborDiscount.discountAmount,
        });
      }
    }

    const serviceLabor = Number(current.labor) || 0;
    if (serviceLabor > 0) {
      const laborDiscount = applyPhSpecialDiscount(
        serviceLabor,
        normalizePhDiscountType(current.laborDiscountType),
      );
      rows.push({
        itemName: current.type || 'Service Labor',
        description: String(current.notes ?? '').trim(),
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
        description: String(current.notes ?? '').trim(),
        qty: 1,
        unitPrice: Number(current.totalSales) || 0,
        discountType: 'none',
        extPrice: Number(current.totalSales) || 0,
        discountAmount: 0,
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

  readonly barcodeBars = computed(() => this.buildBarcodeBars(this.receiptNo()));

  ngOnInit(): void {
    this.autoPrint.set(this.route.snapshot.queryParamMap.get('print') === '1');
    void this.loadReceipt();
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
      const response = await firstValueFrom(this.adminApi.getInventoryService(id));
      this.item.set(response.data);
      this.printedAt.set(new Date());

      if (this.autoPrint()) {
        queueMicrotask(() => {
          setTimeout(() => this.printReceipt(), 350);
        });
      }
    } catch {
      this.error.set('Unable to load job order receipt.');
    } finally {
      this.loading.set(false);
    }
  }

  printReceipt(): void {
    this.printedAt.set(new Date());
    window.print();
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

    const label =
      line.discountType === 'senior' ? 'SC' : line.discountType === 'pwd' ? 'PWD' : '';
    const amount = this.formatMoney(line.discountAmount);
    return label ? `${label} ${amount}` : amount;
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
