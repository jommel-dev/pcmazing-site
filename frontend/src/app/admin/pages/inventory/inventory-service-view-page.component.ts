import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryServiceItem,
} from '../../services/admin-api.service';

type JobLine = NonNullable<InventoryServiceItem['parts']>[number];

@Component({
  selector: 'app-inventory-service-view-page',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  templateUrl: './inventory-service-view-page.component.html',
})
export class InventoryServiceViewPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly item = signal<InventoryServiceItem | null>(null);

  readonly serviceLines = computed(() =>
    (this.item()?.parts ?? []).filter(
      (part) => !!part.serviceTypeId || (!part.materialId && !!part.customItemName),
    ),
  );

  readonly partLines = computed(() =>
    (this.item()?.parts ?? []).filter((part) => !!part.materialId),
  );

  readonly laptopImageFailed = signal(false);
  readonly laptopImageSrc = computed(() => {
    if (this.laptopImageFailed()) {
      return null;
    }
    return this.adminApi.resolveServiceImageUrl(this.item()?.imageUrl);
  });

  readonly servicesTotal = computed(() =>
    this.serviceLines().reduce((sum, line) => sum + this.lineNet(line), 0),
  );

  readonly partsTotal = computed(() =>
    this.partLines().reduce((sum, line) => sum + this.lineNet(line), 0),
  );

  readonly lineDiscountTotal = computed(() =>
    (this.item()?.parts ?? []).reduce((sum, line) => sum + (Number(line.discountAmount) || 0), 0),
  );

  readonly customDiscount = computed(() => Number(this.item()?.customDiscount) || 0);
  readonly downpayment = computed(() => Number(this.item()?.downpayment) || 0);
  readonly totalToPay = computed(() =>
    Math.max(0, this.servicesTotal() + this.partsTotal() - this.customDiscount()),
  );
  readonly balanceDue = computed(() => Math.max(0, this.totalToPay() - this.downpayment()));

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid job order.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.laptopImageFailed.set(false);

    try {
      const response = await firstValueFrom(this.adminApi.getInventoryService(id));
      this.item.set(response.data);
    } catch {
      this.error.set('Unable to load this job order.');
    } finally {
      this.loading.set(false);
    }
  }

  editJob(): void {
    const id = this.item()?.id;
    if (id) {
      void this.router.navigate(['/admin/job-order', id, 'edit']);
    }
  }

  isCancelled(): boolean {
    return String(this.item()?.status ?? '').trim().toLowerCase() === 'cancelled';
  }

  printReceipt(): void {
    const id = this.item()?.id;
    if (!id || this.isCancelled()) {
      return;
    }
    void this.router.navigate(['/admin/job-order', id, 'receipt']);
  }

  onLaptopImageError(): void {
    this.laptopImageFailed.set(true);
  }

  displayValue(value: string | null | undefined): string {
    const text = String(value ?? '').trim();
    return text || '—';
  }

  lineLabel(line: JobLine): string {
    return line.customItemName || line.materialName || line.materialCode || 'Item';
  }

  lineGross(line: JobLine): number {
    if (line.serviceTypeId || (!line.materialId && line.customItemName)) {
      return Number(line.labor ?? line.unitPrice) || 0;
    }
    return (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  }

  lineNet(line: JobLine): number {
    return Math.max(0, this.lineGross(line) - (Number(line.discountAmount) || 0));
  }

  statusClass(status: string | null | undefined): string {
    switch (String(status ?? '').trim().toLowerCase()) {
      case 'done':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
      case 'active':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200';
      default:
        return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
    }
  }
}
