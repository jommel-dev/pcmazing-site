import { Component, HostListener, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryStockSummary,
  InventoryTreeNode,
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
