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
  };
}
