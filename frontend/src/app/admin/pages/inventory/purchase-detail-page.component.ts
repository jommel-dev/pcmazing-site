import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, PurchaseDetail } from '../../services/admin-api.service';
import { InventorySubnavComponent } from './inventory-subnav.component';

@Component({
  selector: 'app-purchase-detail-page',
  imports: [RouterLink, InventorySubnavComponent],
  templateUrl: './purchase-detail-page.component.html',
})
export class PurchaseDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly purchase = signal<PurchaseDetail | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.getPurchaseOrder(id));
      this.purchase.set(response.data);
    } catch {
      this.error.set('Unable to load purchase order details.');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleDateString() : '—';
  }
}
