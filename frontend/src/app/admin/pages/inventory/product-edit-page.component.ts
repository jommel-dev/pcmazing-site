import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, InventoryOption } from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';

const UNITS = ['PCS', 'SET', 'BOX', 'PACK', 'UNIT'];

@Component({
  selector: 'app-product-edit-page',
  imports: [ReactiveFormsModule, RouterLink, InventorySubnavComponent],
  templateUrl: './product-edit-page.component.html',
})
export class ProductEditPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly units = UNITS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly productId = signal<number | null>(null);
  readonly productTypes = signal<InventoryOption[]>([]);
  readonly brands = signal<InventoryOption[]>([]);
  readonly productTypeQuery = signal('');
  readonly brandQuery = signal('');
  readonly productTypeDropdownOpen = signal(false);
  readonly brandDropdownOpen = signal(false);
  readonly productTypeSearchLoading = signal(false);
  readonly brandSearchLoading = signal(false);
  readonly imagePreviewUrl = signal<string | null>(null);
  readonly pendingImageFile = signal<File | null>(null);
  readonly imageRemoved = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    materialName: ['', [Validators.required, Validators.maxLength(200)]],
    materialCode: ['', [Validators.maxLength(50)]],
    productTypeId: [''],
    productTypeName: ['', [Validators.maxLength(200)]],
    brandId: [''],
    brandName: ['', [Validators.maxLength(200)]],
    unit: ['PCS', [Validators.maxLength(20)]],
    unitPrice: [0, [Validators.min(0)]],
    orderCost: [0, [Validators.min(0)]],
    sellPrice: [0, [Validators.min(0)]],
    onHandStock: [0, [Validators.min(0)]],
    reorderLevel: [0, [Validators.min(0)]],
    description: ['', [Validators.maxLength(2000)]],
  });

  ngOnInit(): void {
    void this.initialize();
  }

  async initialize(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.error.set('Invalid product.');
      this.loading.set(false);
      return;
    }

    this.productId.set(id);
    this.loading.set(true);
    this.error.set('');

    try {
      const [materialResponse, productTypesResponse, brandsResponse] = await Promise.all([
        firstValueFrom(this.adminApi.getMaterial(id)),
        firstValueFrom(this.adminApi.listInventoryProductTypes()),
        firstValueFrom(this.adminApi.listInventoryBrands()),
      ]);

      const material = materialResponse.data;
      this.productTypes.set(productTypesResponse.data);
      this.brands.set(brandsResponse.data);

      this.form.patchValue({
        materialName: material.materialName,
        materialCode: material.materialCode ?? '',
        productTypeId: material.productTypeId ? String(material.productTypeId) : '',
        productTypeName: material.productTypeName ?? '',
        brandId: material.brandId ? String(material.brandId) : '',
        brandName: material.brandName ?? '',
        unit: material.unit ?? 'PCS',
        unitPrice: material.unitPrice ?? 0,
        orderCost: material.orderCost ?? 0,
        sellPrice: material.sellPrice ?? 0,
        onHandStock: material.onHandStock ?? 0,
        reorderLevel: material.reorderLevel ?? 0,
        description: material.description ?? '',
      });

      this.productTypeQuery.set(material.productTypeName ?? '');
      this.brandQuery.set(material.brandName ?? '');

      const imageUrl = this.adminApi.resolveMaterialImageUrl(material.imageUrl);
      if (imageUrl) {
        this.imagePreviewUrl.set(imageUrl);
      }

      if (material.productTypeId) {
        await this.loadBrandsForProductType(material.productTypeId);
      }
    } catch {
      this.error.set('Unable to load product.');
    } finally {
      this.loading.set(false);
    }
  }

  filteredProductTypes(): InventoryOption[] {
    const query = this.productTypeQuery().trim().toLowerCase();
    const list = this.productTypes();
    if (!query) {
      return list.slice(0, 8);
    }
    return list.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 8);
  }

  filteredBrands(): InventoryOption[] {
    const query = this.brandQuery().trim().toLowerCase();
    const selectedProductTypeId = Number(this.form.controls.productTypeId.value);
    const list = this.brands().filter((item) => {
      if (!Number.isFinite(selectedProductTypeId) || selectedProductTypeId <= 0) {
        return true;
      }
      return item.productTypeId === selectedProductTypeId || item.productTypeId == null;
    });

    if (!query) {
      return list.slice(0, 8);
    }
    return list.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 8);
  }

  productTypeWillCreate(): boolean {
    const query = this.productTypeQuery().trim();
    if (!query || this.form.controls.productTypeId.value) {
      return false;
    }
    return !this.productTypes().some((item) => item.name.toLowerCase() === query.toLowerCase());
  }

  brandWillCreate(): boolean {
    const query = this.brandQuery().trim();
    if (!query || this.form.controls.brandId.value) {
      return false;
    }
    return !this.brands().some((item) => item.name.toLowerCase() === query.toLowerCase());
  }

  onProductTypeInput(value: string): void {
    this.productTypeQuery.set(value);
    this.form.controls.productTypeName.setValue(value);
    this.form.controls.productTypeId.setValue('');
    this.productTypeDropdownOpen.set(true);
    void this.searchProductTypes(value);
  }

  onBrandInput(value: string): void {
    this.brandQuery.set(value);
    this.form.controls.brandName.setValue(value);
    this.form.controls.brandId.setValue('');
    this.brandDropdownOpen.set(true);
    void this.searchBrands(value);
  }

  selectProductType(option: InventoryOption): void {
    this.form.controls.productTypeId.setValue(String(option.id));
    this.form.controls.productTypeName.setValue(option.name);
    this.productTypeQuery.set(option.name);
    this.productTypeDropdownOpen.set(false);
    this.clearBrandSelection();
    void this.loadBrandsForProductType(option.id);
  }

  selectBrand(option: InventoryOption): void {
    this.form.controls.brandId.setValue(String(option.id));
    this.form.controls.brandName.setValue(option.name);
    this.brandQuery.set(option.name);
    this.brandDropdownOpen.set(false);
  }

  closeProductTypeDropdown(): void {
    setTimeout(() => this.productTypeDropdownOpen.set(false), 150);
  }

  closeBrandDropdown(): void {
    setTimeout(() => this.brandDropdownOpen.set(false), 150);
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const preview = this.imagePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }

    this.pendingImageFile.set(file);
    this.imageRemoved.set(false);
    this.imagePreviewUrl.set(URL.createObjectURL(file));
  }

  removeProductImage(): void {
    const preview = this.imagePreviewUrl();
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    this.pendingImageFile.set(null);
    this.imagePreviewUrl.set(null);
    this.imageRemoved.set(true);
  }

  async submit(): Promise<void> {
    const id = this.productId();
    if (!id) {
      return;
    }

    this.formError.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('Please fill in the required fields.');
      return;
    }

    this.saving.set(true);

    try {
      const value = this.form.getRawValue();
      const productTypeId = Number(value.productTypeId);
      const brandId = Number(value.brandId);
      const productTypeName = value.productTypeName.trim();
      const brandName = value.brandName.trim();

      await firstValueFrom(
        this.adminApi.updateMaterial(id, {
          materialName: value.materialName.trim(),
          materialCode: value.materialCode.trim() || undefined,
          description: value.description.trim() || undefined,
          productTypeId: Number.isFinite(productTypeId) && productTypeId > 0 ? productTypeId : undefined,
          productTypeName: productTypeName || undefined,
          brandId: Number.isFinite(brandId) && brandId > 0 ? brandId : undefined,
          brandName: brandName || undefined,
          unit: value.unit.trim() || 'PCS',
          unitPrice: Number(value.unitPrice) || 0,
          orderCost: Number(value.orderCost) || 0,
          sellPrice: Number(value.sellPrice) || 0,
          onHandStock: Number(value.onHandStock) || 0,
          reorderLevel: Number(value.reorderLevel) || 0,
        }),
      );

      const pendingImage = this.pendingImageFile();
      if (pendingImage) {
        await firstValueFrom(this.adminApi.uploadMaterialImage(id, pendingImage));
      } else if (this.imageRemoved()) {
        await firstValueFrom(this.adminApi.removeMaterialImage(id));
      }

      await this.router.navigate(['/admin/inventory/materials', id]);
    } catch {
      this.formError.set('Unable to update product. Check the form and try again.');
    } finally {
      this.saving.set(false);
    }
  }

  private clearBrandSelection(): void {
    this.form.controls.brandId.setValue('');
    this.form.controls.brandName.setValue('');
    this.brandQuery.set('');
  }

  private async searchProductTypes(value: string): Promise<void> {
    this.productTypeSearchLoading.set(true);
    try {
      const response = await firstValueFrom(this.adminApi.listInventoryProductTypes(value));
      this.productTypes.set(response.data);
    } catch {
      this.productTypes.set([]);
    } finally {
      this.productTypeSearchLoading.set(false);
    }
  }

  private async searchBrands(value: string): Promise<void> {
    this.brandSearchLoading.set(true);
    try {
      const productTypeId = Number(this.form.controls.productTypeId.value);
      const response = await firstValueFrom(
        this.adminApi.listInventoryBrands(
          Number.isFinite(productTypeId) && productTypeId > 0 ? productTypeId : undefined,
          value,
        ),
      );
      this.brands.set(response.data);
    } catch {
      this.brands.set([]);
    } finally {
      this.brandSearchLoading.set(false);
    }
  }

  private async loadBrandsForProductType(productTypeId: number): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.listInventoryBrands(productTypeId));
      this.brands.set(response.data);
    } catch {
      this.brands.set([]);
    }
  }
}
