import { Component, HostListener, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryStockSummary,
  InventoryTreeNode,
  MaterialImportPreview,
  MaterialItem,
  PaginationMeta,
} from '../../services/admin-api.service';
import { AdminAuthService } from '../../services/admin-auth.service';
import { canSeeInventoryCosts } from '../../rbac/admin-roles';
import { InventorySubnavComponent } from './inventory-subnav.component';
import {
  extendedMargin,
  formatInventoryMoney,
  stockQty,
  stockStatusClass,
  stockStatusLabel,
  unitCost,
  unitMargin,
  unitPrice,
} from './inventory-stock.util';

@Component({
  selector: 'app-inventory-page',
  imports: [FormsModule, RouterLink, InventorySubnavComponent],
  templateUrl: './inventory-page.component.html',
})
export class InventoryPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly adminAuth = inject(AdminAuthService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = 50;
  readonly items = signal<MaterialItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly summary = signal<InventoryStockSummary | null>(null);
  readonly tree = signal<InventoryTreeNode[]>([]);
  readonly selectedBrandId = signal<number | null>(null);
  readonly selectedProductTypeId = signal<number | null>(null);
  readonly selectedCategoryLabel = signal('All Products');
  readonly openActionMenuId = signal<number | null>(null);
  readonly actionMenuPosition = signal<{ top: number; left: number } | null>(null);
  readonly importLoading = signal(false);
  readonly exportLoading = signal(false);
  readonly importOpen = signal(false);
  readonly importPreview = signal<MaterialImportPreview | null>(null);
  readonly importFile = signal<File | null>(null);
  readonly importMessage = signal('');

  readonly showCosts = computed(() =>
    canSeeInventoryCosts(this.adminAuth.getStoredUser()?.role),
  );

  readonly formatMoney = formatInventoryMoney;
  readonly unitCost = unitCost;
  readonly unitPrice = unitPrice;
  readonly unitMargin = unitMargin;
  readonly stockQty = stockQty;
  readonly extendedMargin = extendedMargin;
  readonly stockStatusLabel = stockStatusLabel;
  readonly stockStatusClass = stockStatusClass;

  ngOnInit(): void {
    void this.loadAll();
  }

  async loadAll(): Promise<void> {
    await Promise.all([this.loadTree(), this.loadMaterials()]);
  }

  async loadTree(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getInventoryTree());
      this.tree.set(response.data);
    } catch {
      this.tree.set([]);
    }
  }

  async loadMaterials(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.listMaterials(
          this.page(),
          this.pageSize,
          this.search(),
          this.selectedBrandId() ?? undefined,
          this.selectedProductTypeId() ?? undefined,
        ),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
      this.summary.set(response.summary);
    } catch {
      this.error.set('Unable to load inventory products.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchMaterials(): Promise<void> {
    this.page.set(1);
    await this.loadMaterials();
  }

  async filterByCategory(
    brandId: number | null,
    productTypeId: number | null = null,
    label = 'All Products',
  ): Promise<void> {
    this.selectedBrandId.set(brandId);
    this.selectedProductTypeId.set(productTypeId);
    this.selectedCategoryLabel.set(label);
    this.page.set(1);
    await this.loadMaterials();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.loadMaterials();
  }

  sectionTitle(): string {
    const count = this.summary()?.itemCount ?? this.meta()?.total ?? 0;
    return `Products for ${this.selectedCategoryLabel()} (${count} items)`;
  }

  materialImageUrl(item: MaterialItem): string | null {
    return this.adminApi.resolveMaterialImageUrl(item.imageUrl);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async downloadImportTemplate(): Promise<void> {
    this.error.set('');
    try {
      const blob = await firstValueFrom(this.adminApi.downloadMaterialsImportTemplate());
      this.downloadBlob(blob, 'inventory-stock-import-template.csv');
    } catch {
      this.error.set('Unable to download the import template.');
    }
  }

  async exportCsv(): Promise<void> {
    if (this.exportLoading()) {
      return;
    }

    this.exportLoading.set(true);
    this.error.set('');
    try {
      const blob = await firstValueFrom(
        this.adminApi.exportMaterialsCsv(
          this.search(),
          this.selectedBrandId() ?? undefined,
          this.selectedProductTypeId() ?? undefined,
        ),
      );
      this.downloadBlob(blob, 'inventory-stock-export.csv');
    } catch {
      this.error.set('Unable to export inventory stock.');
    } finally {
      this.exportLoading.set(false);
    }
  }

  async onImportSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    this.importLoading.set(true);
    this.error.set('');
    this.importMessage.set('');
    try {
      const response = await firstValueFrom(this.adminApi.previewImportMaterials(file));
      this.importFile.set(file);
      this.importPreview.set(response.data);
      this.importOpen.set(true);
    } catch {
      this.error.set('Unable to read the import file. Download the template and check your columns.');
    } finally {
      this.importLoading.set(false);
    }
  }

  closeImport(): void {
    this.importOpen.set(false);
    this.importPreview.set(null);
    this.importFile.set(null);
  }

  async confirmImport(): Promise<void> {
    const file = this.importFile();
    if (!file || this.importLoading()) {
      return;
    }

    this.importLoading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(this.adminApi.importMaterials(file));
      this.closeImport();
      this.importMessage.set(
        `${response.data.imported} product(s) imported (${response.data.created} created, ${response.data.updated} updated).`,
      );
      this.page.set(1);
      await this.loadAll();
    } catch {
      this.error.set('Import failed. Fix the file and try again.');
    } finally {
      this.importLoading.set(false);
    }
  }

  toggleActionMenu(id: number, event: Event): void {
    event.stopPropagation();

    if (this.openActionMenuId() === id) {
      this.closeActionMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 144;

    this.actionMenuPosition.set({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
    this.openActionMenuId.set(id);
  }

  closeActionMenu(): void {
    this.openActionMenuId.set(null);
    this.actionMenuPosition.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeActionMenu();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeActionMenu();
  }
}
