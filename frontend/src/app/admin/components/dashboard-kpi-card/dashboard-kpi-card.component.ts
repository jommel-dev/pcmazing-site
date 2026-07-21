import { Component, input } from '@angular/core';
import { DashboardKpi } from '../../data/dashboard.types';

@Component({
  selector: 'app-dashboard-kpi-card',
  template: `
    <article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p class="text-sm font-medium text-slate-500 dark:text-slate-400">{{ kpi().label }}</p>
      <p class="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{{ displayValue() }}</p>
      <span
        class="mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
        [class.bg-emerald-50]="kpi().trend !== 'down'"
        [class.text-emerald-700]="kpi().trend !== 'down'"
        [class.dark:bg-emerald-950]="kpi().trend !== 'down'"
        [class.dark:text-emerald-300]="kpi().trend !== 'down'"
        [class.bg-red-50]="kpi().trend === 'down'"
        [class.text-red-700]="kpi().trend === 'down'"
        [class.dark:bg-red-950]="kpi().trend === 'down'"
        [class.dark:text-red-300]="kpi().trend === 'down'"
      >
        {{ kpi().changeLabel }}
      </span>
    </article>
  `,
})
export class DashboardKpiCardComponent {
  readonly kpi = input.required<DashboardKpi>();

  displayValue(): string {
    const item = this.kpi();
    if (item.format === 'currency') {
      return `₱${item.value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
    }

    return item.value.toLocaleString('en-PH');
  }
}
