import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { DashboardDateRange, resolveDashboardDateRange } from './dashboard-date.util';

type Trend = 'up' | 'down' | 'flat';

export interface DashboardKpi {
  key: string;
  label: string;
  value: number;
  previousValue: number;
  changeLabel: string;
  trend: Trend;
  format: 'integer' | 'currency';
}

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export interface DashboardOverviewResponse {
  generatedAt: string;
  period: {
    type: string;
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

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOverview(query: DashboardOverviewQueryDto): Promise<DashboardOverviewResponse> {
    const range = resolveDashboardDateRange(query);

    const [
      activeJobs,
      previousActiveJobs,
      completedJobs,
      previousCompletedJobs,
      inquiries,
      previousInquiries,
      projects,
      previousProjects,
      financials,
      previousFinancials,
      salesActivity,
      jobStatus,
      inquiriesTrend,
    ] = await Promise.all([
      this.countSalesOrders(range, 'active'),
      this.countSalesOrders(range, 'active', true),
      this.countSalesOrders(range, 'completed'),
      this.countSalesOrders(range, 'completed', true),
      this.countInquiries(range),
      this.countInquiries(range, true),
      this.countProjects(range),
      this.countProjects(range, true),
      this.getFinancialSummary(range),
      this.getFinancialSummary(range, true),
      this.getSalesActivitySeries(range),
      this.getJobStatusBreakdown(range),
      this.getInquiriesTrendSeries(range),
    ]);

    const kpis: DashboardKpi[] = [
      this.buildKpi('activeJobs', 'Active Jobs', activeJobs, previousActiveJobs, 'integer', range),
      this.buildKpi('completedJobs', 'Completed Jobs', completedJobs, previousCompletedJobs, 'integer', range),
      this.buildKpi('inquiries', 'Inquiries', inquiries, previousInquiries, 'integer', range),
      this.buildKpi('projects', 'Projects', projects, previousProjects, 'integer', range),
      this.buildKpi('net', 'Net', financials.net, previousFinancials.net, 'currency', range),
      this.buildKpi(
        'outstanding',
        'Outstanding',
        financials.outstanding,
        previousFinancials.outstanding,
        'currency',
        range,
      ),
    ];

    return {
      generatedAt: new Date().toISOString(),
      period: {
        type: range.period,
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        previousStart: range.previousStart.toISOString(),
        previousEnd: range.previousEnd.toISOString(),
        label: range.label,
      },
      kpis,
      charts: {
        salesActivity,
        jobStatus,
        inquiriesTrend,
        financialSplit: financials,
      },
    };
  }

  private buildKpi(
    key: string,
    label: string,
    value: number,
    previousValue: number,
    format: 'integer' | 'currency',
    range: DashboardDateRange,
  ): DashboardKpi {
    const delta = value - previousValue;
    const trend: Trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    const comparisonLabel = this.comparisonLabel(range.period);
    const formattedDelta =
      format === 'currency'
        ? this.formatCurrency(Math.abs(delta))
        : this.formatInteger(Math.abs(delta));

    let changeLabel = `${this.formatDisplayValue(value, format)} in selected period`;
    if (delta === 0) {
      changeLabel = `No change ${comparisonLabel}`;
    } else if (delta > 0) {
      changeLabel = `+${formattedDelta} ${comparisonLabel}`;
    } else {
      changeLabel = `-${formattedDelta} ${comparisonLabel}`;
    }

    return { key, label, value, previousValue, changeLabel, trend, format };
  }

  private comparisonLabel(period: string): string {
    switch (period) {
      case 'daily':
        return 'vs yesterday';
      case 'monthly':
        return 'vs last month';
      case 'custom':
        return 'vs previous range';
      default:
        return 'vs last week';
    }
  }

  private formatDisplayValue(value: number, format: 'integer' | 'currency'): string {
    return format === 'currency' ? this.formatCurrency(value) : this.formatInteger(value);
  }

  private formatInteger(value: number): string {
    return Math.round(value).toLocaleString('en-PH');
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('en-PH', { maximumFractionDigits: 0 });
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async tableExists(tableName: string): Promise<boolean> {
    const result = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName],
    );

    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  private dateBounds(range: DashboardDateRange, previous = false): [Date, Date] {
    return previous ? [range.previousStart, range.previousEnd] : [range.start, range.end];
  }

  private async countSalesOrders(
    range: DashboardDateRange,
    mode: 'active' | 'completed',
    previous = false,
  ): Promise<number> {
    if (!(await this.tableExists('tblsales_order'))) {
      return 0;
    }

    const [start, end] = this.dateBounds(range, previous);
    const statusFilter =
      mode === 'active'
        ? `REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('pending', 'approved', 'released', 'partial', 'delivered', 'processing')`
        : `REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('complete', 'completed')`;

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM tblsales_order so
         WHERE ${statusFilter}
           AND COALESCE(so."salesType", 'sales') = 'sales'
           AND COALESCE(so.deleted_at, NULL) IS NULL
           AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') NOT IN ('voided', 'cancelled', 'void')
           AND so.created_at >= $1::timestamptz
           AND so.created_at <= $2::timestamptz`,
        [start.toISOString(), end.toISOString()],
      );

      return this.toNumber(result.rows[0]?.count);
    } catch {
      return 0;
    }
  }

  private async countInquiries(range: DashboardDateRange, previous = false): Promise<number> {
    if (!(await this.tableExists('contact_inquiries'))) {
      return 0;
    }

    const [start, end] = this.dateBounds(range, previous);

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM contact_inquiries
         WHERE created_at >= $1::timestamptz
           AND created_at <= $2::timestamptz`,
        [start.toISOString(), end.toISOString()],
      );

      return this.toNumber(result.rows[0]?.count);
    } catch {
      return 0;
    }
  }

  private async countProjects(range: DashboardDateRange, previous = false): Promise<number> {
    if (!(await this.tableExists('tblprojects'))) {
      return 0;
    }

    const [start, end] = this.dateBounds(range, previous);

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM tblprojects
         WHERE COALESCE(project_status, 'planning') IN ('planning', 'ongoing')
           AND created_at >= $1::timestamptz
           AND created_at <= $2::timestamptz`,
        [start.toISOString(), end.toISOString()],
      );

      return this.toNumber(result.rows[0]?.count);
    } catch {
      return 0;
    }
  }

  private async getFinancialSummary(
    range: DashboardDateRange,
    previous = false,
  ): Promise<{ gross: number; net: number; outstanding: number }> {
    if (!(await this.tableExists('tblsales_order'))) {
      return { gross: 0, net: 0, outstanding: 0 };
    }

    const [start, end] = this.dateBounds(range, previous);
    const hasPayments = await this.tableExists('tblsales_order_payments');

    try {
      if (hasPayments) {
        const result = await this.databaseService.query<{
          gross: string;
          net: string;
          outstanding: string;
        }>(
          `SELECT
             COALESCE(SUM(so.total_amount), 0)::text AS gross,
             COALESCE(SUM(
               CASE
                 WHEN COALESCE(so.total_amount, 0) <= 0 THEN 0
                 ELSE LEAST(COALESCE(payments.total_paid, 0), so.total_amount)
               END
             ), 0)::text AS net,
             COALESCE(SUM(
               CASE
                 WHEN COALESCE(so.total_amount, 0) <= 0 THEN 0
                 ELSE GREATEST(so.total_amount - COALESCE(payments.total_paid, 0), 0)
               END
             ), 0)::text AS outstanding
           FROM tblsales_order so
           LEFT JOIN LATERAL (
             SELECT COALESCE(SUM(sp.amount), 0) AS total_paid
             FROM tblsales_order_payments sp
             WHERE sp.sales_order_id = so.id
               AND LOWER(COALESCE(sp.status, '')) NOT IN ('unpaid', 'voided', 'cancelled', 'rejected')
           ) payments ON TRUE
           WHERE COALESCE(so."salesType", 'sales') = 'sales'
             AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('complete', 'completed')
             AND COALESCE(so.deleted_at, NULL) IS NULL
             AND so.created_at >= $1::timestamptz
             AND so.created_at <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );

        const row = result.rows[0];
        return {
          gross: this.toNumber(row?.gross),
          net: this.toNumber(row?.net),
          outstanding: this.toNumber(row?.outstanding),
        };
      }

      const result = await this.databaseService.query<{ gross: string; outstanding: string }>(
        `SELECT
           COALESCE(SUM(CASE
             WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('complete', 'completed')
               THEN COALESCE(so.total_amount, 0)
             ELSE 0
           END), 0)::text AS gross,
           COALESCE(SUM(CASE
             WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('pending', 'approved', 'released', 'partial', 'delivered', 'processing')
               THEN COALESCE(so.total_amount, 0)
             ELSE 0
           END), 0)::text AS outstanding
         FROM tblsales_order so
         WHERE COALESCE(so."salesType", 'sales') = 'sales'
           AND COALESCE(so.deleted_at, NULL) IS NULL
           AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') NOT IN ('voided', 'cancelled', 'void')
           AND so.created_at >= $1::timestamptz
           AND so.created_at <= $2::timestamptz`,
        [start.toISOString(), end.toISOString()],
      );

      const row = result.rows[0];
      const gross = this.toNumber(row?.gross);
      const outstanding = this.toNumber(row?.outstanding);

      return { gross, net: gross, outstanding };
    } catch {
      return { gross: 0, net: 0, outstanding: 0 };
    }
  }

  private async getSalesActivitySeries(range: DashboardDateRange): Promise<DashboardChartPoint[]> {
    if (!(await this.tableExists('tblsales_order'))) {
      return [];
    }

    const bucket = range.period === 'daily' ? 'hour' : range.period === 'monthly' ? 'week' : 'day';

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           TO_CHAR(date_trunc($3, so.created_at), 'Mon DD') AS label,
           COUNT(*)::text AS value
         FROM tblsales_order so
         WHERE COALESCE(so."salesType", 'sales') = 'sales'
           AND COALESCE(so.deleted_at, NULL) IS NULL
           AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') NOT IN ('voided', 'cancelled', 'void')
           AND so.created_at >= $1::timestamptz
           AND so.created_at <= $2::timestamptz
         GROUP BY date_trunc($3, so.created_at)
         ORDER BY date_trunc($3, so.created_at)`,
        [range.start.toISOString(), range.end.toISOString(), bucket],
      );

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
      }));
    } catch {
      return [];
    }
  }

  private async getJobStatusBreakdown(
    range: DashboardDateRange,
  ): Promise<Array<{ label: string; value: number; color: string }>> {
    if (!(await this.tableExists('tblsales_order'))) {
      return [];
    }

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           CASE
             WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('pending', 'approved', 'released', 'partial', 'delivered', 'processing') THEN 'Active'
             WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('complete', 'completed') THEN 'Completed'
             WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') IN ('draft') THEN 'Draft / Quotation'
             ELSE 'Other'
           END AS label,
           COUNT(*)::text AS value
         FROM tblsales_order so
         WHERE COALESCE(so."salesType", 'sales') = 'sales'
           AND COALESCE(so.deleted_at, NULL) IS NULL
           AND REPLACE(REPLACE(LOWER(TRIM(COALESCE(so.status, ''))), '_', '-'), ' ', '-') NOT IN ('voided', 'cancelled', 'void')
           AND so.created_at >= $1::timestamptz
           AND so.created_at <= $2::timestamptz
         GROUP BY 1
         ORDER BY COUNT(*) DESC`,
        [range.start.toISOString(), range.end.toISOString()],
      );

      const colors: Record<string, string> = {
        Active: '#2563eb',
        Completed: '#16a34a',
        'Draft / Quotation': '#f59e0b',
        Other: '#94a3b8',
      };

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
        color: colors[row.label] ?? '#64748b',
      }));
    } catch {
      return [];
    }
  }

  private async getInquiriesTrendSeries(range: DashboardDateRange): Promise<DashboardChartPoint[]> {
    if (!(await this.tableExists('contact_inquiries'))) {
      return [];
    }

    const bucket = range.period === 'daily' ? 'hour' : range.period === 'monthly' ? 'week' : 'day';

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           TO_CHAR(date_trunc($3, created_at), 'Mon DD') AS label,
           COUNT(*)::text AS value
         FROM contact_inquiries
         WHERE created_at >= $1::timestamptz
           AND created_at <= $2::timestamptz
         GROUP BY date_trunc($3, created_at)
         ORDER BY date_trunc($3, created_at)`,
        [range.start.toISOString(), range.end.toISOString(), bucket],
      );

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
      }));
    } catch {
      return [];
    }
  }
}
