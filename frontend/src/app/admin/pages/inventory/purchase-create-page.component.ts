import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  MaterialItem,
  PurchaseVendorOption,
} from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Terms', 'Cheque', 'Credit Card'];
const REMARKS_MAX = 1000;

interface PurchaseLineItemFormValue {
  materialId: number;
  materialName: string;
  materialCode: string;
  brandName: string;
  quantity: number;
  unitPrice: number;
}

interface PurchasePaymentFormValue {
  method: string;
  amount: number;
  paymentDate: string;
  status: string;
}

interface PurchaseFormValue {
  vendorId: string;
  vendorName: string;
  remarks: string;
  items: PurchaseLineItemFormValue[];
  payments: PurchasePaymentFormValue[];
}

@Component({
  selector: 'app-purchase-create-page',
  imports: [ReactiveFormsModule, RouterLink, InventorySubnavComponent, DecimalPipe],
  templateUrl: './purchase-create-page.component.html',
})
export class PurchaseCreatePageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly paymentMethods = PAYMENT_METHODS;
  readonly remarksMax = REMARKS_MAX;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly vendors = signal<PurchaseVendorOption[]>([]);
  readonly materialResults = signal<MaterialItem[]>([]);
  readonly materialSearchLoading = signal(false);

  readonly vendorQuery = signal('');
  readonly vendorDropdownOpen = signal(false);
  readonly materialQuery = signal('');
  readonly materialDropdownOpen = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    vendorId: [''],
    vendorName: ['', [Validators.required, Validators.maxLength(200)]],
    remarks: ['', [Validators.maxLength(REMARKS_MAX)]],
    items: this.formBuilder.nonNullable.array<FormGroup>([]),
    payments: this.formBuilder.nonNullable.array([this.createPaymentGroup()]),
  });

  ngOnInit(): void {
    void this.initialize();
  }

  get items(): FormArray<FormGroup> {
    return this.form.controls.items;
  }

  get payments(): FormArray<FormGroup> {
    return this.form.controls.payments;
  }

  filteredVendors(): PurchaseVendorOption[] {
    const query = this.vendorQuery().trim().toLowerCase();
    const list = this.vendors();
    if (!query) {
      return list.slice(0, 8);
    }
    return list.filter((vendor) => vendor.name.toLowerCase().includes(query)).slice(0, 8);
  }

  remarksCount(): number {
    return this.form.controls.remarks.value.length;
  }

  private createLineItemGroup(material: MaterialItem): FormGroup {
    return this.formBuilder.nonNullable.group({
      materialId: [material.id, [Validators.required, Validators.min(1)]],
      materialName: [material.materialName],
      materialCode: [material.materialCode ?? ''],
      brandName: [material.brandName ?? ''],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(999999)]],
      unitPrice: [
        material.unitPrice && material.unitPrice > 0 ? material.unitPrice : 0,
        [Validators.required, Validators.min(0.01), Validators.max(999999.99)],
      ],
    });
  }

  private createPaymentGroup(): FormGroup {
    return this.formBuilder.nonNullable.group({
      method: ['Cash', [Validators.required]],
      amount: [0, [Validators.min(0), Validators.max(999999999.99)]],
      paymentDate: [''],
      status: ['unpaid'],
    });
  }

  private lineItemGroup(index: number): FormGroup {
    return this.items.at(index) as FormGroup;
  }

  private paymentGroup(index: number): FormGroup {
    return this.payments.at(index) as FormGroup;
  }

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const vendorsResponse = await firstValueFrom(this.adminApi.listPurchaseVendors());
      this.vendors.set(vendorsResponse.data);
    } catch {
      this.error.set('Unable to load purchase form data.');
    } finally {
      this.loading.set(false);
    }
  }

  onVendorInput(value: string): void {
    this.vendorQuery.set(value);
    this.form.controls.vendorName.setValue(value);
    this.form.controls.vendorId.setValue('');
    this.vendorDropdownOpen.set(true);
  }

  selectVendor(vendor: PurchaseVendorOption): void {
    this.form.controls.vendorId.setValue(vendor.id);
    this.form.controls.vendorName.setValue(vendor.name);
    this.vendorQuery.set(vendor.name);
    this.vendorDropdownOpen.set(false);
  }

  closeVendorDropdown(): void {
    setTimeout(() => this.vendorDropdownOpen.set(false), 150);
  }

  async onMaterialInput(value: string): Promise<void> {
    this.materialQuery.set(value);
    this.materialDropdownOpen.set(Boolean(value.trim()));

    if (!value.trim()) {
      this.materialResults.set([]);
      return;
    }

    this.materialSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.listMaterials(1, 20, value.trim()));
      this.materialResults.set(response.data);
    } catch {
      this.materialResults.set([]);
    } finally {
      this.materialSearchLoading.set(false);
    }
  }

  addMaterial(material: MaterialItem): void {
    const existingIndex = this.items.controls.findIndex(
      (control) => Number(control.get('materialId')?.value) === material.id,
    );

    if (existingIndex >= 0) {
      const group = this.lineItemGroup(existingIndex);
      const currentQty = Number(group.controls['quantity'].value) || 0;
      group.controls['quantity'].setValue(currentQty + 1);
    } else {
      this.items.push(this.createLineItemGroup(material));
    }

    this.materialQuery.set('');
    this.materialResults.set([]);
    this.materialDropdownOpen.set(false);
  }

  removeLineItem(index: number): void {
    this.items.removeAt(index);
  }

  addPayment(): void {
    this.payments.push(this.createPaymentGroup());
  }

  removePayment(index: number): void {
    if (this.payments.length <= 1) {
      return;
    }
    this.payments.removeAt(index);
  }

  paymentStatusLabel(index: number): string {
    const group = this.paymentGroup(index);
    const amount = Number(group.controls['amount'].value) || 0;
    const paymentDate = String(group.controls['paymentDate'].value ?? '').trim();
    const status = String(group.controls['status'].value ?? '').trim().toLowerCase();

    if (status === 'paid' || (amount > 0 && paymentDate)) {
      return 'Paid';
    }
    if (amount > 0) {
      return 'Partial';
    }
    return 'Unpaid';
  }

  paymentStatusClass(index: number): string {
    const label = this.paymentStatusLabel(index);
    if (label === 'Paid') {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (label === 'Partial') {
      return 'bg-amber-50 text-amber-700';
    }
    return 'bg-slate-100 text-slate-600';
  }

  lineTotal(index: number): number {
    const group = this.lineItemGroup(index);
    const quantity = Number(group.controls['quantity'].value) || 0;
    const unitPrice = Number(group.controls['unitPrice'].value) || 0;
    return quantity * unitPrice;
  }

  grandTotal(): number {
    return this.items.controls.reduce((sum, _, index) => sum + this.lineTotal(index), 0);
  }

  async submit(): Promise<void> {
    this.formError.set('');

    if (!this.form.controls.vendorName.value.trim()) {
      this.formError.set('Vendor is required.');
      return;
    }

    if (this.items.length === 0) {
      this.formError.set('Add at least one product item.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please complete all required fields.');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue() as PurchaseFormValue;
      const payload: Parameters<AdminApiService['createPurchaseOrder']>[0] = {
        poType: 'ACM',
        status: 'for_approval',
        remarks: value.remarks.trim() || undefined,
        items: value.items.map((item) => ({
          materialId: Number(item.materialId),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
        payments: value.payments.map((payment, index) => ({
          method: payment.method,
          amount: Number(payment.amount) || 0,
          paymentDate: payment.paymentDate || undefined,
          status: this.paymentStatusLabel(index).toLowerCase(),
        })),
      };

      if (value.vendorId) {
        payload.vendorId = value.vendorId;
      } else {
        payload.vendorName = value.vendorName.trim();
      }

      const response = await firstValueFrom(this.adminApi.createPurchaseOrder(payload));
      await this.router.navigate(['/admin/inventory/purchase', response.data.id]);
    } catch {
      this.formError.set('Unable to submit purchase order. Check your entries and try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
