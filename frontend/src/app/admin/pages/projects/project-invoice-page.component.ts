import { CommonModule } from '@angular/common';

import { Component, computed, inject, OnInit, signal } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';

import { firstValueFrom } from 'rxjs';

import { AdminApiService, ProjectInvoiceData } from '../../services/admin-api.service';

import { formatDealAmount } from '../marketing/prospect-deal.util';



@Component({

  selector: 'app-project-invoice-page',

  imports: [CommonModule, RouterLink],

  templateUrl: './project-invoice-page.component.html',

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

export class ProjectInvoicePageComponent implements OnInit {

  private readonly adminApi = inject(AdminApiService);

  private readonly route = inject(ActivatedRoute);



  readonly loading = signal(true);

  readonly error = signal('');

  readonly invoice = signal<ProjectInvoiceData | null>(null);

  readonly projectId = signal(0);

  readonly milestoneIdFilter = signal<number | null>(null);



  readonly isPhaseInvoice = computed(() => Boolean(this.invoice()?.invoiceNumber));



  readonly invoiceHeading = computed(() => {

    const doc = this.invoice();

    if (!doc?.invoiceNumber) {
      return 'Project Billing Invoice';
    }

    return `Invoice #${doc.invoiceNumber}`;

  });



  readonly phaseLabel = computed(() => {

    const doc = this.invoice();

    if (!doc?.phaseNumber) {

      return null;

    }

    const title = doc.phaseTitle?.trim();

    return title ? `Phase ${doc.phaseNumber}: ${title}` : `Phase ${doc.phaseNumber}`;

  });



  readonly formatDealAmount = formatDealAmount;



  ngOnInit(): void {

    this.projectId.set(Number(this.route.snapshot.paramMap.get('id')) || 0);

    const milestoneRaw = this.route.snapshot.queryParamMap.get('milestoneId');

    const milestoneId = milestoneRaw != null ? Number(milestoneRaw) : NaN;

    this.milestoneIdFilter.set(Number.isInteger(milestoneId) && milestoneId > 0 ? milestoneId : null);

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

    const id = Number(this.route.snapshot.paramMap.get('id'));

    const milestoneId = this.milestoneIdFilter();

    this.loading.set(true);

    this.error.set('');

    try {

      const response = await firstValueFrom(

        this.adminApi.getProjectInvoice(id, milestoneId ?? undefined),

      );

      this.invoice.set(response.data);

    } catch {

      this.error.set('Unable to load invoice.');

    } finally {

      this.loading.set(false);

    }

  }

}


