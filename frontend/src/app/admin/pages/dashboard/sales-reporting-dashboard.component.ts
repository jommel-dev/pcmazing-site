import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { DashboardChartComponent } from '../../components/dashboard-chart/dashboard-chart.component';
import { DashboardDetailsPanelComponent } from '../../components/dashboard-details-panel/dashboard-details-panel.component';
import { DashboardKpiCardComponent } from '../../components/dashboard-kpi-card/dashboard-kpi-card.component';
import { CompanyExpensesWidgetComponent } from '../../components/company-expenses-widget/company-expenses-widget.component';
import {
  DashboardDetailMetric,
  DashboardDetails,
  DashboardOverview,
  DashboardPeriod,
} from '../../data/dashboard.types';
import { AdminApiService } from '../../services/admin-api.service';

@Component({
  selector: 'app-sales-reporting-dashboard',
  imports: [
    DatePipe,
    FormsModule,
    DashboardKpiCardComponent,
    DashboardChartComponent,
    DashboardDetailsPanelComponent,
    CompanyExpensesWidgetComponent,
  ],
  templateUrl: './sales-reporting-dashboard.component.html',
})
export class SalesReportingDashboardComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);

  readonly loading = signal(true);
  readonly overview = signal<DashboardOverview | null>(null);
  readonly error = signal('');
  readonly selectedMetric = signal<DashboardDetailMetric | null>(null);
  readonly details = signal<DashboardDetails | null>(null);
  readonly detailsLoading = signal(false);
  readonly detailsError = signal('');

  readonly selectedPeriod = signal<DashboardPeriod>('daily');
  readonly customStartDate = signal('');
  readonly customEndDate = signal('');

  readonly periodOptions: Array<{ value: DashboardPeriod; label: string }> = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' },
  ];

  readonly salesKpis = computed(() => {
    const data = this.overview();
    if (!data) {
      return [];
    }

    const order = ['activeJobs', 'completedJobs', 'inquiries', 'net'];
    return order
      .map((key) => data.kpis.find((item) => item.key === key))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  });

  readonly financialKpis = computed(() => {
    const data = this.overview();
    if (!data) {
      return [];
    }

    const order = ['outstanding', 'discounts', 'refunds', 'operatingExpenses'];
    return order
      .map((key) => data.kpis.find((item) => item.key === key))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  });

  readonly salesActivityLabels = computed(
    () => this.overview()?.charts.salesActivity.map((point) => point.label) ?? [],
  );
  readonly salesActivityValues = computed(
    () => this.overview()?.charts.salesActivity.map((point) => point.value) ?? [],
  );
  readonly inquiriesTrendLabels = computed(
    () => this.overview()?.charts.inquiriesTrend.map((point) => point.label) ?? [],
  );
  readonly inquiriesTrendValues = computed(
    () => this.overview()?.charts.inquiriesTrend.map((point) => point.value) ?? [],
  );
  readonly jobStatusLabels = computed(
    () => this.overview()?.charts.jobStatus.map((item) => item.label) ?? [],
  );
  readonly jobStatusValues = computed(
    () => this.overview()?.charts.jobStatus.map((item) => item.value) ?? [],
  );
  readonly jobStatusColors = computed(
    () => this.overview()?.charts.jobStatus.map((item) => item.color) ?? [],
  );
  readonly financialSplitLabels = computed(() => ['Net Collected', 'Outstanding']);
  readonly financialSplitValues = computed(() => {
    const split = this.overview()?.charts.financialSplit;
    if (!split) {
      return [];
    }

    return [split.net, split.outstanding];
  });

  readonly hasFinancialSplit = computed(() =>
    this.financialSplitValues().some((value) => value > 0),
  );

  readonly expenseCategoryLabels = computed(
    () => this.overview()?.charts.expenseCategories?.map((item) => item.label) ?? [],
  );
  readonly expenseCategoryValues = computed(
    () => this.overview()?.charts.expenseCategories?.map((item) => item.value) ?? [],
  );
  readonly expenseCategoryColors = computed(
    () => this.overview()?.charts.expenseCategories?.map((item) => item.color) ?? [],
  );

  ngOnInit(): void {
    this.initializeCustomDates();
    void this.loadOverview();
  }

  selectPeriod(period: DashboardPeriod): void {
    this.selectedPeriod.set(period);
    if (period !== 'custom') {
      void this.loadOverview();
    }
  }

  applyCustomRange(): void {
    if (!this.customStartDate() || !this.customEndDate()) {
      this.error.set('Select both start and end dates for the custom range.');
      return;
    }

    void this.loadOverview();
  }

  openDetails(metric: string): void {
    const next = metric as DashboardDetailMetric;
    if (this.selectedMetric() === next) {
      this.closeDetails();
      return;
    }

    this.selectedMetric.set(next);
    void this.loadDetails(next);
  }

  closeDetails(): void {
    this.selectedMetric.set(null);
    this.details.set(null);
    this.detailsError.set('');
  }

  private async loadDetails(metric: DashboardDetailMetric): Promise<void> {
    this.detailsLoading.set(true);
    this.detailsError.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.getDashboardDetails({
          metric,
          period: this.selectedPeriod(),
          startDate: this.selectedPeriod() === 'custom' ? this.customStartDate() : undefined,
          endDate: this.selectedPeriod() === 'custom' ? this.customEndDate() : undefined,
        }),
      );
      this.details.set(response.data);
    } catch {
      this.details.set(null);
      this.detailsError.set('Unable to load card details.');
    } finally {
      this.detailsLoading.set(false);
    }
  }

  private initializeCustomDates(): void {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    this.customEndDate.set(this.toInputDate(today));
    this.customStartDate.set(this.toInputDate(weekAgo));
  }

  private toInputDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async loadOverview(): Promise<void> {
    this.loading.set(true);
    this.error.set('');

    try {
      const response = await firstValueFrom(
        this.adminApi.getDashboardOverview({
          period: this.selectedPeriod(),
          startDate: this.selectedPeriod() === 'custom' ? this.customStartDate() : undefined,
          endDate: this.selectedPeriod() === 'custom' ? this.customEndDate() : undefined,
        }),
      );

      this.overview.set(response.data);
      if (this.selectedMetric()) {
        void this.loadDetails(this.selectedMetric()!);
      }
    } catch {
      this.error.set('Unable to load sales reporting.');
    } finally {
      this.loading.set(false);
    }
  }
}
