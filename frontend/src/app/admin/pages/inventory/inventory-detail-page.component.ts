import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, MaterialItem } from '../../services/admin-api.service';

@Component({
  selector: 'app-inventory-detail-page',
  imports: [RouterLink],
  templateUrl: './inventory-detail-page.component.html',
})
export class InventoryDetailPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly material = signal<MaterialItem | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(this.adminApi.getMaterial(id));
      this.material.set(response.data);
    } catch {
      this.error.set('Unable to load material details.');
    } finally {
      this.loading.set(false);
    }
  }
}
