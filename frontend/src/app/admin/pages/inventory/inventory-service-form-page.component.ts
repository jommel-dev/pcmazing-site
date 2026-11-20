import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, InventoryServiceItem } from '../../services/admin-api.service';
import {
  JO_ACCESSORY_OPTIONS,
  JO_CONSENT_BACKUP_LABEL,
  JO_CONSENT_SOFTWARE_LABEL,
  JO_DEVICE_TYPE_OPTIONS,
  JO_FORM_AGREEMENT_TERMS,
  JO_FORM_LETTERHEAD_FALLBACK,
  JO_SERVICE_ARRANGEMENT_OPTIONS,
  JO_UNIT_CONDITION_OPTIONS,
  mapJobStatusToFormChecks,
} from './job-order-intake.util';

@Component({
  selector: 'app-inventory-service-form-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './inventory-service-form-page.component.html',
  styleUrl: './inventory-service-form-page.component.css',
})
export class InventoryServiceFormPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly adminApi = inject(AdminApiService);
  private printStyleEl: HTMLStyleElement | null = null;

  readonly loading = signal(true);
  readonly error = signal('');
  readonly item = signal<InventoryServiceItem | null>(null);
  readonly autoPrint = signal(false);

  readonly arrangementOptions = JO_SERVICE_ARRANGEMENT_OPTIONS;
  readonly deviceTypeOptions = JO_DEVICE_TYPE_OPTIONS;
  readonly accessoryOptions = JO_ACCESSORY_OPTIONS;
  readonly unitConditionPrintOptions = JO_UNIT_CONDITION_OPTIONS;
  readonly agreementTerms = JO_FORM_AGREEMENT_TERMS;
  readonly consentSoftwareLabel = JO_CONSENT_SOFTWARE_LABEL;
  readonly consentBackupLabel = JO_CONSENT_BACKUP_LABEL;
  readonly letterheadFallback = JO_FORM_LETTERHEAD_FALLBACK;

  readonly jobNo = computed(() => {
    const current = this.item();
    if (!current) {
      return '';
    }
    return current.referenceNo?.trim() || String(current.id);
  });

  readonly jobDate = computed(() => this.item()?.createdAt || this.item()?.startedAt || null);

  readonly estimatedCost = computed(() => {
    const current = this.item();
    if (!current) {
      return 0;
    }
    if (current.manualTotalAmount != null) {
      return Math.max(0, Number(current.manualTotalAmount) || 0);
    }
    return Math.max(0, Number(current.calculatedTotal ?? current.totalSales ?? 0) || 0);
  });

  readonly downpayment = computed(() => Math.max(0, Number(this.item()?.downpayment) || 0));

  readonly remainingBalance = computed(() =>
    Math.max(0, this.estimatedCost() - this.downpayment()),
  );

  readonly statusChecks = computed(() => mapJobStatusToFormChecks(this.item()?.status ?? ''));

  /** Letterhead matches the paper form reference (not Printing settings). */
  readonly storeAddress = computed(() => this.letterheadFallback.address);

  readonly storePhone = computed(() => this.letterheadFallback.phone);

  ngOnInit(): void {
    this.autoPrint.set(this.route.snapshot.queryParamMap.get('print') === '1');
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
      this.error.set('Invalid job order.');
      this.loading.set(false);
      return;
    }

    try {
      const serviceResult = await firstValueFrom(this.adminApi.getInventoryService(id));
      this.item.set(serviceResult.data);
      if (this.autoPrint()) {
        setTimeout(() => this.printForm(), 250);
      }
    } catch {
      this.error.set('Unable to load job order form.');
    } finally {
      this.loading.set(false);
    }
  }

  printForm(): void {
    this.injectPrintStyle();
    window.print();
  }

  isArrangement(value: string): boolean {
    return this.item()?.serviceArrangement === value;
  }

  isDeviceType(value: string): boolean {
    return this.item()?.deviceType === value;
  }

  isAccessory(value: string): boolean {
    return (this.item()?.includedAccessories ?? []).includes(value);
  }

  isUnitCondition(value: string): boolean {
    return this.item()?.unitCondition === value;
  }

  fill(value: string | null | undefined): string {
    return String(value ?? '').trim();
  }

  displayMoney(amount: number): string {
    if (!Number.isFinite(amount) || amount <= 0) {
      return '';
    }
    return amount.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private injectPrintStyle(): void {
    this.removePrintStyle();
    const style = document.createElement('style');
    style.setAttribute('data-jo-form-print', '1');
    style.textContent = `@page { size: A4 portrait; margin: 8mm; }`;
    document.head.appendChild(style);
    this.printStyleEl = style;
  }

  private removePrintStyle(): void {
    this.printStyleEl?.remove();
    this.printStyleEl = null;
  }
}
