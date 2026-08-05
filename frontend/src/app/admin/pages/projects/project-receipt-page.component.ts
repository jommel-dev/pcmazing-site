import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApiService, ProjectReceiptData } from '../../services/admin-api.service';
import { formatDealAmount } from '../marketing/prospect-deal.util';

@Component({
  selector: 'app-project-receipt-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './project-receipt-page.component.html',
  styles: [
    `
      @media print {
        .no-print {
          display: none !important;
        }
        .print-sheet {
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body {
          background: white !important;
        }
      }
    `,
  ],
})
export class ProjectReceiptPageComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly receipt = signal<ProjectReceiptData | null>(null);
  readonly projectId = signal(0);

  readonly formatDealAmount = formatDealAmount;

  ngOnInit(): void {
    this.projectId.set(Number(this.route.snapshot.paramMap.get('id')) || 0);
    void this.load();
  }

  print(): void {
    window.print();
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
  }

  private async load(): Promise<void> {
    const projectId = Number(this.route.snapshot.paramMap.get('id'));
    const settlementId = Number(this.route.snapshot.paramMap.get('settlementId'));
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await firstValueFrom(
        this.adminApi.getProjectReceipt(projectId, settlementId),
      );
      this.receipt.set(response.data);
    } catch {
      this.error.set('Unable to load receipt.');
    } finally {
      this.loading.set(false);
    }
  }
}
