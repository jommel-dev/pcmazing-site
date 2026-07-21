import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  InventoryTreeNode,
  MaterialItem,
  PaginationMeta,
} from '../../services/admin-api.service';

@Component({
  selector: 'app-inventory-page',
  imports: [FormsModule, RouterLink],
  templateUrl: './inventory-page.component.html',
})
export class InventoryPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly items = signal<MaterialItem[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly tree = signal<InventoryTreeNode[]>([]);
  readonly selectedBrandId = signal<number | null>(null);
  readonly selectedProductTypeId = signal<number | null>(null);

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
          20,
          this.search(),
          this.selectedBrandId() ?? undefined,
          this.selectedProductTypeId() ?? undefined,
        ),
      );
      this.items.set(response.data);
      this.meta.set(response.meta);
    } catch {
      this.error.set('Unable to load inventory materials. Make sure tblmaterials exists in your database.');
    } finally {
      this.loading.set(false);
    }
  }

  async searchMaterials(): Promise<void> {
    this.page.set(1);
    await this.loadMaterials();
  }

  async filterByBrand(brandId: number | null, productTypeId: number | null = null): Promise<void> {
    this.selectedBrandId.set(brandId);
    this.selectedProductTypeId.set(productTypeId);
    this.page.set(1);
    await this.loadMaterials();
  }

  async goToPage(nextPage: number): Promise<void> {
    this.page.set(nextPage);
    await this.loadMaterials();
  }

  stockStatus(item: MaterialItem): string {
    const stock = item.onHandStock ?? 0;
    const reorder = item.reorderLevel ?? 0;
    if (stock <= 0) return 'Out';
    if (stock <= reorder) return 'Low';
    return 'OK';
  }
}
