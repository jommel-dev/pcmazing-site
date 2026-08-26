export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export type DashboardTrend = 'up' | 'down' | 'flat';

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  changeLabel: string;
  trend: DashboardTrend;
  format: 'integer' | 'currency';
}

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export type DashboardDetailMetric =
  | 'activeJobs'
  | 'completedJobs'
  | 'inquiries'
  | 'projects'
  | 'net'
  | 'outstanding'
  | 'discounts'
  | 'operatingExpenses';

export interface DashboardDetailRow {
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
  amount: number | null;
  date: string | null;
  href: string;
}

export interface DashboardDetails {
  metric: DashboardDetailMetric;
  title: string;
  description: string;
  viewAllHref: string;
  rows: DashboardDetailRow[];
}

export interface DashboardOverview {
  generatedAt: string;
  period: {
    type: DashboardPeriod;
    start: string;
    end: string;
    previousStart: string;
    previousEnd: string;
    label: string;
  };
  kpis: DashboardKpi[];
  charts: {
    salesActivity: DashboardChartPoint[];
    jobStatus: Array<{ label: string; value: number; color: string }>;
    inquiriesTrend: DashboardChartPoint[];
    financialSplit: { net: number; outstanding: number; gross: number };
    expenseCategories?: Array<{ label: string; value: number; color: string }>;
  };
}
