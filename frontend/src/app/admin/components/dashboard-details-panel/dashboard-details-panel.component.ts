import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardDetails } from '../../data/dashboard.types';

@Component({
  selector: 'app-dashboard-details-panel',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center"
      (click)="closed.emit()"
    >
      <section
        class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        (click)="$event.stopPropagation()"
      >
        <div class="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">{{ details()?.title || 'Details' }}</h3>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ details()?.description || '' }}</p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if (details()?.viewAllHref) {
              <a
                [routerLink]="details()!.viewAllHref"
                class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Open full list
              </a>
            }
            <button
              type="button"
              class="inline-flex size-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              (click)="closed.emit()"
              aria-label="Close details"
            >
              <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        @if (loading()) {
          <div class="px-5 py-16 text-center text-sm text-slate-500">Loading details...</div>
        } @else if (error()) {
          <div class="px-5 py-16 text-center text-sm text-red-600">{{ error() }}</div>
        } @else if (!(details()?.rows?.length)) {
          <div class="px-5 py-16 text-center text-sm text-slate-500">No records found for this card.</div>
        } @else {
          <div class="overflow-auto">
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase dark:bg-slate-950">
                <tr>
                  <th class="px-5 py-3">Record</th>
                  <th class="px-5 py-3">Status</th>
                  <th class="px-5 py-3">Amount</th>
                  <th class="px-5 py-3">Date</th>
                  <th class="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                @for (row of details()!.rows; track row.href + '-' + row.id) {
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <td class="px-5 py-3">
                      <div class="font-semibold text-slate-900 dark:text-white">{{ row.title }}</div>
                      <div class="text-xs text-slate-500">{{ row.subtitle }}</div>
                    </td>
                    <td class="px-5 py-3">
                      @if (row.status) {
                        <span [class]="statusPillClass(row.status)">
                          {{ row.status }}
                        </span>
                      } @else {
                        <span class="text-slate-500">—</span>
                      }
                    </td>
                    <td class="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                      @if (row.amount === null) { — } @else { {{ row.amount | currency: 'PHP':'symbol-narrow':'1.0-0' }} }
                    </td>
                    <td class="px-5 py-3 text-slate-600 dark:text-slate-300">
                      @if (row.date) {
                        {{ row.date | date: 'mediumDate' }}
                      } @else {
                        —
                      }
                    </td>
                    <td class="px-5 py-3 text-right">
                      <a [routerLink]="row.href" class="font-semibold text-pcmazing-600 hover:text-pcmazing-700">
                        Open
                      </a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
})
export class DashboardDetailsPanelComponent {
  readonly details = input<DashboardDetails | null>(null);
  readonly loading = input(false);
  readonly error = input('');
  readonly closed = output<void>();

  statusPillClass(status: string | null | undefined): string {
    const base = 'inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase';
    switch (String(status ?? '').trim().toLowerCase()) {
      case 'done':
        return `${base} bg-blue-50 text-blue-700 ring-1 ring-blue-200`;
      case 'completed':
      case 'active':
        return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`;
      case 'paid':
        return `${base} bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`;
      case 'planned':
        return `${base} bg-amber-50 text-amber-700 ring-1 ring-amber-200`;
      case 'pending':
      case 'on_hold':
      case 'on hold':
        return `${base} bg-amber-50 text-amber-700 ring-1 ring-amber-200`;
      case 'cancelled':
      case 'canceled':
      case 'void':
        return `${base} bg-red-50 text-red-700 ring-1 ring-red-200`;
      default:
        return `${base} bg-slate-100 text-slate-700 ring-1 ring-slate-200`;
    }
  }
}
