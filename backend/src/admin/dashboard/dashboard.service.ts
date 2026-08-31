import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import {
  DashboardDetailMetric,
  DashboardDetailsQueryDto,
  DashboardOverviewQueryDto,
} from './dto/dashboard-overview-query.dto';
import { DashboardDateRange, resolveDashboardDateRange } from './dashboard-date.util';
import {
  COMPANY_EXPENSE_CATEGORY_COLORS,
  COMPANY_EXPENSE_CATEGORY_LABELS,
} from '../company-expenses/dto/company-expense.dto';
import { ensureJobOrderRefundColumns } from '../inventory/job-order-refund.schema';
import { ensureSalesOrderRefundColumns } from '../inventory/sales-order-refund.schema';

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
    expenseCategories: Array<{ label: string; value: number; color: string }>;
  };
}

export interface DashboardDetailRow {
  id: number;
  title: string;
  subtitle: string;
  status: string | null;
  amount: number | null;
  date: string | null;
  href: string;
}

export interface DashboardDetailsResponse {
  metric: DashboardDetailMetric;
  title: string;
  description: string;
  viewAllHref: string;
  rows: DashboardDetailRow[];
}

const JOB_LABOR_DISCOUNT_SQL = `
  CASE
    WHEN LOWER(TRIM(COALESCE(s.labor_discount_type, ''))) IN ('senior', 'pwd')
      THEN ROUND(COALESCE(s.labor, 0) * 0.20, 2)
    ELSE 0
  END
`;

const JOB_DISCOUNT_SQL = `
  (
    COALESCE(s.custom_discount, 0)
    + COALESCE(parts.parts_discount, 0)
    + ${JOB_LABOR_DISCOUNT_SQL}
  )
`;

const JOB_SALE_AMOUNT_SQL = `
  GREATEST(
    COALESCE(parts.parts_sales, 0)
      - COALESCE(parts.parts_discount, 0)
      + COALESCE(s.labor, 0)
      + COALESCE(parts.parts_labor, 0)
      - ${JOB_LABOR_DISCOUNT_SQL}
      - COALESCE(s.custom_discount, 0),
    0
  )
`;

const JOB_NET_SALE_AMOUNT_SQL = `
  CASE
    WHEN LOWER(TRIM(COALESCE(s.status, ''))) = 'refunded'
      THEN GREATEST(${JOB_SALE_AMOUNT_SQL} - COALESCE(s.refund_amount, 0), 0)
    ELSE ${JOB_SALE_AMOUNT_SQL}
  END
`;

const JOB_OUTSTANDING_SQL = `
  GREATEST(
    ${JOB_SALE_AMOUNT_SQL} - COALESCE(s.downpayment, 0),
    0
  )
`;

const JOB_PARTS_LATERAL_SQL = `
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(SUM(COALESCE(sp.labor, 0)), 0) AS parts_labor,
      COALESCE(SUM(
        sp.quantity * CASE
          WHEN sp.material_id IS NULL THEN COALESCE(sp.unit_price, 0)
          ELSE COALESCE(NULLIF(sp.unit_price, 0), NULLIF(m.sell_price, 0), NULLIF(m.unit_price, 0), 0)
        END
      ), 0) AS parts_sales,
      COALESCE(SUM(COALESCE(sp.discount_amount, 0)), 0) AS parts_discount
    FROM pcmazing_service_parts sp
    LEFT JOIN tblmaterials m ON m.id = sp.material_id
    WHERE sp.service_id = s.id AND sp.deleted_at IS NULL
  ) parts ON TRUE
`;

@Injectable()
export class DashboardService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getOverview(query: DashboardOverviewQueryDto): Promise<DashboardOverviewResponse> {
    const range = resolveDashboardDateRange(query);

    const [
      activeJobs,
      completedJobs,
      previousCompletedJobs,
      inquiries,
      previousInquiries,
      projects,
      financials,
      previousFinancials,
      discounts,
      previousDiscounts,
      refunds,
      previousRefunds,
      salesActivity,
      jobStatus,
      inquiriesTrend,
      operatingExpenses,
      previousOperatingExpenses,
      expenseCategories,
    ] = await Promise.all([
      this.countOpenJobOrders(),
      this.countCompletedJobOrders(range),
      this.countCompletedJobOrders(range, true),
      this.countInquiries(range),
      this.countInquiries(range, true),
      this.countOpenProjects(),
      this.getFinancialSummary(range),
      this.getFinancialSummary(range, true),
      this.getDiscountTotal(range),
      this.getDiscountTotal(range, true),
      this.getRefundTotal(range),
      this.getRefundTotal(range, true),
      this.getSalesActivitySeries(range),
      this.getJobStatusBreakdown(),
      this.getInquiriesTrendSeries(range),
      this.getOperatingExpenseTotal(range),
      this.getOperatingExpenseTotal(range, true),
      this.getExpenseCategoryBreakdown(range),
    ]);

    const kpis: DashboardKpi[] = [
      this.buildKpi('activeJobs', 'Active Jobs', activeJobs, activeJobs, 'integer', range, {
        snapshotLabel: 'Currently open job orders',
      }),
      this.buildKpi(
        'completedJobs',
        'Completed Jobs',
        completedJobs,
        previousCompletedJobs,
        'integer',
        range,
      ),
      this.buildKpi('inquiries', 'Inquiries', inquiries, previousInquiries, 'integer', range),
      this.buildKpi('projects', 'Projects', projects, projects, 'integer', range, {
        snapshotLabel: 'Currently active projects',
      }),
      this.buildKpi('net', 'Net', financials.net, previousFinancials.net, 'currency', range),
      this.buildKpi(
        'outstanding',
        'Outstanding',
        financials.outstanding,
        previousFinancials.outstanding,
        'currency',
        range,
      ),
      this.buildKpi(
        'discounts',
        'Total Discounts',
        discounts,
        previousDiscounts,
        'currency',
        range,
      ),
      this.buildKpi(
        'refunds',
        'Total Refunded',
        refunds,
        previousRefunds,
        'currency',
        range,
        { invertTrend: true },
      ),
      this.buildKpi(
        'operatingExpenses',
        'Operating Expenses',
        operatingExpenses,
        previousOperatingExpenses,
        'currency',
        range,
        { invertTrend: true },
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
        expenseCategories,
      },
    };
  }

  async getDetails(query: DashboardDetailsQueryDto): Promise<DashboardDetailsResponse> {
    const range = resolveDashboardDateRange(query);
    const metric = query.metric;

    switch (metric) {
      case 'activeJobs':
        return {
          metric,
          title: 'Active Jobs',
          description: 'Job orders that are currently Active or Pending.',
          viewAllHref: '/admin/job-order',
          rows: await this.listJobOrderRows('open'),
        };
      case 'completedJobs':
        return {
          metric,
          title: 'Completed Jobs',
          description: `Job orders marked Done during ${range.label}.`,
          viewAllHref: '/admin/job-order',
          rows: await this.listJobOrderRows('completed', range),
        };
      case 'inquiries':
        return {
          metric,
          title: 'Inquiries',
          description: `Website contact and demo requests from ${range.label}.`,
          viewAllHref: '/admin/contact-inquiries',
          rows: await this.listInquiryRows(range),
        };
      case 'projects':
        return {
          metric,
          title: 'Projects',
          description: 'Projects that are currently active or on hold.',
          viewAllHref: '/admin/projects',
          rows: await this.listProjectRows(),
        };
      case 'net':
        return {
          metric,
          title: 'Net collected',
          description: `Sales orders and completed job orders from ${range.label}.`,
          viewAllHref: '/admin/sales-order',
          rows: await this.listNetRows(range),
        };
      case 'discounts':
        return {
          metric,
          title: 'Total Discounts',
          description: `Discounts applied on sales orders and job orders during ${range.label}. These amounts are not included in Net collected.`,
          viewAllHref: '/admin/sales-order',
          rows: await this.listDiscountRows(range),
        };
      case 'refunds':
        return {
          metric,
          title: 'Total Refunded',
          description: `Refunds issued on job orders during ${range.label}. These amounts are deducted from Net collected and Total Sales.`,
          viewAllHref: '/admin/job-order',
          rows: await this.listRefundRows(range),
        };
      case 'outstanding':
        return {
          metric,
          title: 'Outstanding',
          description: `Unpaid balance on open job orders from ${range.label}. Downpayments are subtracted.`,
          viewAllHref: '/admin/job-order',
          rows: await this.listJobOrderRows('open', range),
        };
      case 'operatingExpenses':
        return {
          metric,
          title: 'Operating Expenses',
          description: `Company operational expenses recorded during ${range.label}.`,
          viewAllHref: '/admin/company-expenses',
          rows: await this.listOperatingExpenseRows(range),
        };
      default:
        return {
          metric,
          title: 'Details',
          description: 'No details are available for this card.',
          viewAllHref: '/admin/dashboard',
          rows: [],
        };
    }
  }

  private buildKpi(
    key: string,
    label: string,
    value: number,
    previousValue: number,
    format: 'integer' | 'currency',
    range: DashboardDateRange,
    options?: { snapshotLabel?: string; invertTrend?: boolean },
  ): DashboardKpi {
    if (options?.snapshotLabel) {
      return {
        key,
        label,
        value,
        previousValue,
        changeLabel: options.snapshotLabel,
        trend: value > 0 ? 'up' : 'flat',
        format,
      };
    }

    const delta = value - previousValue;
    let trend: Trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
    if (options?.invertTrend && trend !== 'flat') {
      trend = trend === 'up' ? 'down' : 'up';
    }
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

  private statusExpr(alias: string): string {
    return `LOWER(TRIM(COALESCE(${alias}.status, '')))`;
  }

  private async countOpenJobOrders(): Promise<number> {
    if (!(await this.tableExists('pcmazing_services'))) {
      return 0;
    }

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_services s
         WHERE s.deleted_at IS NULL
           AND ${this.statusExpr('s')} IN ('active', 'pending')`,
      );

      return this.toNumber(result.rows[0]?.count);
    } catch (error) {
      console.warn('Dashboard open job orders query failed:', error);
      return 0;
    }
  }

  private async countCompletedJobOrders(
    range: DashboardDateRange,
    previous = false,
  ): Promise<number> {
    if (!(await this.tableExists('pcmazing_services'))) {
      return 0;
    }

    const [start, end] = this.dateBounds(range, previous);

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_services s
         WHERE s.deleted_at IS NULL
           AND ${this.statusExpr('s')} = 'done'
           AND COALESCE(s.ended_at, s.updated_at, s.created_at) >= $1::timestamptz
           AND COALESCE(s.ended_at, s.updated_at, s.created_at) <= $2::timestamptz`,
        [start.toISOString(), end.toISOString()],
      );

      return this.toNumber(result.rows[0]?.count);
    } catch (error) {
      console.warn('Dashboard completed job orders query failed:', error);
      return 0;
    }
  }

  private async countInquiries(range: DashboardDateRange, previous = false): Promise<number> {
    const [start, end] = this.dateBounds(range, previous);
    const [hasContacts, hasDemos] = await Promise.all([
      this.tableExists('contact_inquiries'),
      this.tableExists('demo_requests'),
    ]);

    if (!hasContacts && !hasDemos) {
      return 0;
    }

    try {
      const unions: string[] = [];
      if (hasContacts) {
        unions.push(
          `SELECT created_at FROM contact_inquiries WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
        );
      }
      if (hasDemos) {
        unions.push(
          `SELECT created_at FROM demo_requests WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
        );
      }

      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM (
           ${unions.join('\n           UNION ALL\n           ')}
         ) inquiries`,
        [start.toISOString(), end.toISOString()],
      );

      return this.toNumber(result.rows[0]?.count);
    } catch (error) {
      console.warn('Dashboard inquiries query failed:', error);
      return 0;
    }
  }

  private async countOpenProjects(): Promise<number> {
    if (!(await this.tableExists('pcmazing_projects'))) {
      return 0;
    }

    try {
      const result = await this.databaseService.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM pcmazing_projects p
         WHERE ${this.statusExpr('p')} IN ('active', 'on_hold')`,
      );

      return this.toNumber(result.rows[0]?.count);
    } catch (error) {
      console.warn('Dashboard projects query failed:', error);
      return 0;
    }
  }

  private async getFinancialSummary(
    range: DashboardDateRange,
    previous = false,
  ): Promise<{ gross: number; net: number; outstanding: number }> {
    const [start, end] = this.dateBounds(range, previous);
    const [hasSalesOrders, hasJobOrders] = await Promise.all([
      this.tableExists('pcmazing_sales_orders'),
      this.tableExists('pcmazing_services'),
    ]);

    let salesTotal = 0;
    let jobCollected = 0;
    let outstanding = 0;

    try {
      if (hasJobOrders) {
        await ensureJobOrderRefundColumns(this.databaseService);
      }

      if (hasSalesOrders) {
        await ensureSalesOrderRefundColumns(this.databaseService);
        const salesResult = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(
             GREATEST(o.total_amount - COALESCE(o.refund_amount, 0), 0)
           ), 0)::text AS total
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.sale_date, o.created_at) >= $1::timestamptz
             AND COALESCE(o.sale_date, o.created_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        salesTotal = this.toNumber(salesResult.rows[0]?.total);
      }

      if (hasJobOrders) {
        const jobCollectedResult = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(${JOB_NET_SALE_AMOUNT_SQL}), 0)::text AS total
           FROM pcmazing_services s
           ${JOB_PARTS_LATERAL_SQL}
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} IN ('done', 'refunded')
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) >= $1::timestamptz
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        jobCollected = this.toNumber(jobCollectedResult.rows[0]?.total);

        const outstandingResult = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(${JOB_OUTSTANDING_SQL}), 0)::text AS total
           FROM pcmazing_services s
           ${JOB_PARTS_LATERAL_SQL}
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} IN ('active', 'pending')
             AND COALESCE(s.started_at, s.created_at) >= $1::timestamptz
             AND COALESCE(s.started_at, s.created_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        outstanding = this.toNumber(outstandingResult.rows[0]?.total);
      }
    } catch (error) {
      console.warn('Dashboard financial summary query failed:', error);
      return { gross: 0, net: 0, outstanding: 0 };
    }

    const net = salesTotal + jobCollected;
    return {
      gross: net + outstanding,
      net,
      outstanding,
    };
  }

  private async getDiscountTotal(range: DashboardDateRange, previous = false): Promise<number> {
    const [start, end] = this.dateBounds(range, previous);
    const [hasSalesOrders, hasJobOrders] = await Promise.all([
      this.tableExists('pcmazing_sales_orders'),
      this.tableExists('pcmazing_services'),
    ]);

    let total = 0;

    try {
      if (hasSalesOrders) {
        const salesResult = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(o.discount_total), 0)::text AS total
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.sale_date, o.created_at) >= $1::timestamptz
             AND COALESCE(o.sale_date, o.created_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        total += this.toNumber(salesResult.rows[0]?.total);
      }

      if (hasJobOrders) {
        const jobResult = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(${JOB_DISCOUNT_SQL}), 0)::text AS total
           FROM pcmazing_services s
           ${JOB_PARTS_LATERAL_SQL}
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} <> 'cancelled'
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) >= $1::timestamptz
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        total += this.toNumber(jobResult.rows[0]?.total);
      }
    } catch (error) {
      console.warn('Dashboard discount total query failed:', error);
      return 0;
    }

    return total;
  }

  private async getRefundTotal(range: DashboardDateRange, previous = false): Promise<number> {
    const [start, end] = this.dateBounds(range, previous);
    let total = 0;

    if (await this.tableExists('pcmazing_services')) {
      try {
        await ensureJobOrderRefundColumns(this.databaseService);
        const result = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(COALESCE(s.refund_amount, 0)), 0)::text AS total
           FROM pcmazing_services s
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} = 'refunded'
             AND s.updated_at >= $1::timestamptz
             AND s.updated_at <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        total += this.toNumber(result.rows[0]?.total);
      } catch (error) {
        console.warn('Dashboard job refund total query failed:', error);
      }
    }

    if (await this.tableExists('pcmazing_sales_orders')) {
      try {
        await ensureSalesOrderRefundColumns(this.databaseService);
        const result = await this.databaseService.query<{ total: string }>(
          `SELECT COALESCE(SUM(COALESCE(o.refund_amount, 0)), 0)::text AS total
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.refund_amount, 0) > 0
             AND COALESCE(o.refunded_at, o.updated_at) >= $1::timestamptz
             AND COALESCE(o.refunded_at, o.updated_at) <= $2::timestamptz`,
          [start.toISOString(), end.toISOString()],
        );
        total += this.toNumber(result.rows[0]?.total);
      } catch (error) {
        console.warn('Dashboard sales refund total query failed:', error);
      }
    }

    return total;
  }

  private async listRefundRows(range: DashboardDateRange): Promise<DashboardDetailRow[]> {
    const [start, end] = this.dateBounds(range);
    const rows: DashboardDetailRow[] = [];

    if (await this.tableExists('pcmazing_services')) {
      try {
        await ensureJobOrderRefundColumns(this.databaseService);
        const result = await this.databaseService.query<{
          id: number;
          title: string | null;
          subtitle: string | null;
          reason: string | null;
          amount: string | null;
          date: string | null;
        }>(
          `SELECT
             s.id,
             COALESCE(NULLIF(TRIM(s.customer_name), ''), s.service_name, s.reference_no, 'Job order') AS title,
             COALESCE(s.reference_no, 'Job order') AS subtitle,
             s.refund_reason AS reason,
             s.refund_amount::text AS amount,
             s.updated_at::text AS date
           FROM pcmazing_services s
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} = 'refunded'
             AND COALESCE(s.refund_amount, 0) > 0
             AND s.updated_at >= $1::timestamptz
             AND s.updated_at <= $2::timestamptz
           ORDER BY s.updated_at DESC
           LIMIT 50`,
          [start.toISOString(), end.toISOString()],
        );

        rows.push(
          ...result.rows.map((row) => ({
            id: row.id,
            title: row.title || `Job #${row.id}`,
            subtitle: row.reason?.trim() || row.subtitle || 'Job order refund',
            status: 'Refunded',
            amount: this.toNumber(row.amount),
            date: row.date,
            href: `/admin/job-order/${row.id}`,
          })),
        );
      } catch (error) {
        console.warn('Dashboard job refund details query failed:', error);
      }
    }

    if (await this.tableExists('pcmazing_sales_orders')) {
      try {
        await ensureSalesOrderRefundColumns(this.databaseService);
        const result = await this.databaseService.query<{
          id: number;
          title: string | null;
          subtitle: string | null;
          reason: string | null;
          amount: string | null;
          date: string | null;
        }>(
          `SELECT
             o.id,
             COALESCE(NULLIF(TRIM(o.customer_name), ''), o.reference_no, 'Sales order') AS title,
             COALESCE(o.reference_no, 'Sales order') AS subtitle,
             o.refund_reason AS reason,
             o.refund_amount::text AS amount,
             COALESCE(o.refunded_at, o.updated_at)::text AS date
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.refund_amount, 0) > 0
             AND COALESCE(o.refunded_at, o.updated_at) >= $1::timestamptz
             AND COALESCE(o.refunded_at, o.updated_at) <= $2::timestamptz
           ORDER BY COALESCE(o.refunded_at, o.updated_at) DESC
           LIMIT 50`,
          [start.toISOString(), end.toISOString()],
        );

        rows.push(
          ...result.rows.map((row) => ({
            id: row.id,
            title: row.title || `Sales #${row.id}`,
            subtitle: row.reason?.trim() || row.subtitle || 'Sales order refund',
            status: 'Refunded',
            amount: this.toNumber(row.amount),
            date: row.date,
            href: `/admin/sales-order/${row.id}`,
          })),
        );
      } catch (error) {
        console.warn('Dashboard sales refund details query failed:', error);
      }
    }

    return rows
      .sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')))
      .slice(0, 50);
  }

  private async listDiscountRows(range: DashboardDateRange): Promise<DashboardDetailRow[]> {
    const [start, end] = this.dateBounds(range);
    const [hasSalesOrders, hasJobOrders] = await Promise.all([
      this.tableExists('pcmazing_sales_orders'),
      this.tableExists('pcmazing_services'),
    ]);
    const rows: DashboardDetailRow[] = [];

    try {
      if (hasSalesOrders) {
        const salesResult = await this.databaseService.query<{
          id: number;
          title: string | null;
          subtitle: string | null;
          amount: string | null;
          date: string | null;
        }>(
          `SELECT
             o.id,
             COALESCE(NULLIF(TRIM(o.customer_name), ''), o.reference_no, 'Sales order') AS title,
             COALESCE(o.reference_no, 'Sales order') AS subtitle,
             o.discount_total::text AS amount,
             COALESCE(o.sale_date, o.created_at)::text AS date
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.discount_total, 0) > 0
             AND COALESCE(o.sale_date, o.created_at) >= $1::timestamptz
             AND COALESCE(o.sale_date, o.created_at) <= $2::timestamptz
           ORDER BY COALESCE(o.sale_date, o.created_at) DESC
           LIMIT 50`,
          [start.toISOString(), end.toISOString()],
        );

        rows.push(
          ...salesResult.rows.map((row) => ({
            id: row.id,
            title: row.title || `Sales #${row.id}`,
            subtitle: 'Sales order discount',
            status: 'Sales Order',
            amount: this.toNumber(row.amount),
            date: row.date,
            href: `/admin/sales-order/${row.id}`,
          })),
        );
      }

      if (hasJobOrders) {
        const jobResult = await this.databaseService.query<{
          id: number;
          title: string | null;
          subtitle: string | null;
          status: string | null;
          amount: string | null;
          date: string | null;
        }>(
          `SELECT
             s.id,
             COALESCE(NULLIF(TRIM(s.customer_name), ''), s.service_name, s.reference_no, 'Job order') AS title,
             COALESCE(NULLIF(TRIM(s.service_name), ''), s.reference_no, 'Job order') AS subtitle,
             s.status,
             ${JOB_DISCOUNT_SQL}::text AS amount,
             COALESCE(s.ended_at, s.updated_at, s.created_at)::text AS date
           FROM pcmazing_services s
           ${JOB_PARTS_LATERAL_SQL}
           WHERE s.deleted_at IS NULL
             AND ${this.statusExpr('s')} <> 'cancelled'
             AND ${JOB_DISCOUNT_SQL} > 0
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) >= $1::timestamptz
             AND COALESCE(s.ended_at, s.updated_at, s.created_at) <= $2::timestamptz
           ORDER BY COALESCE(s.ended_at, s.updated_at, s.created_at) DESC
           LIMIT 50`,
          [start.toISOString(), end.toISOString()],
        );

        rows.push(
          ...jobResult.rows.map((row) => ({
            id: row.id,
            title: row.title || `Job #${row.id}`,
            subtitle: row.subtitle || 'Job order discount',
            status: row.status ? `Job Order · ${row.status}` : 'Job Order',
            amount: this.toNumber(row.amount),
            date: row.date,
            href: `/admin/job-order/${row.id}`,
          })),
        );
      }
    } catch (error) {
      console.warn('Dashboard discount details query failed:', error);
      return [];
    }

    return rows
      .sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')))
      .slice(0, 50);
  }

  private async getSalesActivitySeries(range: DashboardDateRange): Promise<DashboardChartPoint[]> {
    if (!(await this.tableExists('pcmazing_sales_orders'))) {
      return [];
    }

    const bucket = range.period === 'daily' ? 'hour' : range.period === 'monthly' ? 'week' : 'day';

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           TO_CHAR(date_trunc('${bucket}', COALESCE(o.sale_date, o.created_at)), 'Mon DD') AS label,
           COUNT(*)::text AS value
         FROM pcmazing_sales_orders o
         WHERE o.deleted_at IS NULL
           AND o.is_void = FALSE
           AND COALESCE(o.sale_date, o.created_at) >= $1::timestamptz
           AND COALESCE(o.sale_date, o.created_at) <= $2::timestamptz
         GROUP BY date_trunc('${bucket}', COALESCE(o.sale_date, o.created_at))
         ORDER BY date_trunc('${bucket}', COALESCE(o.sale_date, o.created_at))`,
        [range.start.toISOString(), range.end.toISOString()],
      );

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
      }));
    } catch (error) {
      console.warn('Dashboard sales activity query failed:', error);
      return [];
    }
  }

  private async getJobStatusBreakdown(): Promise<
    Array<{ label: string; value: number; color: string }>
  > {
    if (!(await this.tableExists('pcmazing_services'))) {
      return [];
    }

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           CASE
             WHEN ${this.statusExpr('s')} IN ('active', 'pending') THEN 'Active'
             WHEN ${this.statusExpr('s')} = 'done' THEN 'Completed'
             WHEN ${this.statusExpr('s')} = 'cancelled' THEN 'Cancelled'
             WHEN ${this.statusExpr('s')} = 'refunded' THEN 'Refunded'
             ELSE 'Other'
           END AS label,
           COUNT(*)::text AS value
         FROM pcmazing_services s
         WHERE s.deleted_at IS NULL
         GROUP BY 1
         ORDER BY COUNT(*) DESC`,
      );

      const colors: Record<string, string> = {
        Active: '#2563eb',
        Completed: '#16a34a',
        Cancelled: '#ef4444',
        Refunded: '#9333ea',
        Other: '#94a3b8',
      };

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
        color: colors[row.label] ?? '#64748b',
      }));
    } catch (error) {
      console.warn('Dashboard job status query failed:', error);
      return [];
    }
  }

  private async getInquiriesTrendSeries(range: DashboardDateRange): Promise<DashboardChartPoint[]> {
    const [hasContacts, hasDemos] = await Promise.all([
      this.tableExists('contact_inquiries'),
      this.tableExists('demo_requests'),
    ]);

    if (!hasContacts && !hasDemos) {
      return [];
    }

    const bucket = range.period === 'daily' ? 'hour' : range.period === 'monthly' ? 'week' : 'day';
    const unions: string[] = [];
    if (hasContacts) {
      unions.push(
        `SELECT created_at FROM contact_inquiries WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      );
    }
    if (hasDemos) {
      unions.push(
        `SELECT created_at FROM demo_requests WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz`,
      );
    }

    try {
      const result = await this.databaseService.query<{ label: string; value: string }>(
        `SELECT
           TO_CHAR(date_trunc('${bucket}', created_at), 'Mon DD') AS label,
           COUNT(*)::text AS value
         FROM (
           ${unions.join('\n           UNION ALL\n           ')}
         ) inquiries
         GROUP BY date_trunc('${bucket}', created_at)
         ORDER BY date_trunc('${bucket}', created_at)`,
        [range.start.toISOString(), range.end.toISOString()],
      );

      return result.rows.map((row) => ({
        label: row.label,
        value: this.toNumber(row.value),
      }));
    } catch (error) {
      console.warn('Dashboard inquiries trend query failed:', error);
      return [];
    }
  }

  private async listJobOrderRows(
    mode: 'open' | 'completed',
    range?: DashboardDateRange,
  ): Promise<DashboardDetailRow[]> {
    if (!(await this.tableExists('pcmazing_services'))) {
      return [];
    }

    const params: string[] = [];
    const conditions = [`s.deleted_at IS NULL`];

    if (mode === 'open') {
      conditions.push(`${this.statusExpr('s')} IN ('active', 'pending')`);
      if (range) {
        params.push(range.start.toISOString(), range.end.toISOString());
        conditions.push(
          `COALESCE(s.started_at, s.created_at) >= $1::timestamptz
           AND COALESCE(s.started_at, s.created_at) <= $2::timestamptz`,
        );
      }
    } else {
      conditions.push(`${this.statusExpr('s')} IN ('done', 'refunded')`);
      if (range) {
        params.push(range.start.toISOString(), range.end.toISOString());
        conditions.push(
          `COALESCE(s.ended_at, s.updated_at, s.created_at) >= $1::timestamptz
           AND COALESCE(s.ended_at, s.updated_at, s.created_at) <= $2::timestamptz`,
        );
      }
    }

    try {
      const result = await this.databaseService.query<{
        id: number;
        title: string | null;
        subtitle: string | null;
        status: string | null;
        amount: string | null;
        date: string | null;
      }>(
        `SELECT
           s.id,
           COALESCE(NULLIF(TRIM(s.customer_name), ''), s.service_name, s.reference_no, 'Job order') AS title,
           COALESCE(NULLIF(TRIM(s.service_name), ''), s.reference_no, '') AS subtitle,
           s.status,
           ${mode === 'open' ? JOB_OUTSTANDING_SQL : JOB_NET_SALE_AMOUNT_SQL}::text AS amount,
           COALESCE(s.ended_at, s.updated_at, s.created_at)::text AS date
         FROM pcmazing_services s
         ${JOB_PARTS_LATERAL_SQL}
         WHERE ${conditions.join('\n           AND ')}
         ORDER BY COALESCE(s.ended_at, s.updated_at, s.created_at) DESC
         LIMIT 50`,
        params,
      );

      return result.rows.map((row) => ({
        id: row.id,
        title: row.title || `Job #${row.id}`,
        subtitle: row.subtitle || 'Job order',
        status: row.status,
        amount: this.toNumber(row.amount),
        date: row.date,
        href: `/admin/job-order/${row.id}`,
      }));
    } catch (error) {
      console.warn('Dashboard job order details query failed:', error);
      return [];
    }
  }

  private async listInquiryRows(range: DashboardDateRange): Promise<DashboardDetailRow[]> {
    const [start, end] = this.dateBounds(range);
    const [hasContacts, hasDemos] = await Promise.all([
      this.tableExists('contact_inquiries'),
      this.tableExists('demo_requests'),
    ]);

    if (!hasContacts && !hasDemos) {
      return [];
    }

    const unions: string[] = [];
    if (hasContacts) {
      unions.push(`
        SELECT
          id,
          full_name AS title,
          COALESCE(service_interest, email, 'Contact inquiry') AS subtitle,
          status,
          created_at,
          'contact' AS source
        FROM contact_inquiries
        WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
      `);
    }
    if (hasDemos) {
      unions.push(`
        SELECT
          id,
          full_name AS title,
          COALESCE(service_interest, company, email, 'Demo request') AS subtitle,
          status,
          created_at,
          'demo' AS source
        FROM demo_requests
        WHERE created_at >= $1::timestamptz AND created_at <= $2::timestamptz
      `);
    }

    try {
      const result = await this.databaseService.query<{
        id: number;
        title: string | null;
        subtitle: string | null;
        status: string | null;
        created_at: string | null;
        source: 'contact' | 'demo';
      }>(
        `SELECT id, title, subtitle, status, created_at::text, source
         FROM (
           ${unions.join('\n           UNION ALL\n           ')}
         ) inquiries
         ORDER BY created_at DESC
         LIMIT 50`,
        [start.toISOString(), end.toISOString()],
      );

      return result.rows.map((row) => ({
        id: row.id,
        title: row.title || 'Inquiry',
        subtitle: row.subtitle || (row.source === 'demo' ? 'Demo request' : 'Contact inquiry'),
        status: row.status,
        amount: null,
        date: row.created_at,
        href:
          row.source === 'demo'
            ? `/admin/demo-requests/${row.id}`
            : `/admin/contact-inquiries/${row.id}`,
      }));
    } catch (error) {
      console.warn('Dashboard inquiry details query failed:', error);
      return [];
    }
  }

  private async listProjectRows(): Promise<DashboardDetailRow[]> {
    if (!(await this.tableExists('pcmazing_projects'))) {
      return [];
    }

    const hasProspects = await this.tableExists('pcmazing_client_prospects');

    try {
      const result = await this.databaseService.query<{
        id: number;
        title: string | null;
        subtitle: string | null;
        status: string | null;
        date: string | null;
      }>(
        hasProspects
          ? `SELECT
               p.id,
               p.name AS title,
               COALESCE(c.client_name, c.company, p.project_type, '') AS subtitle,
               p.status,
               p.updated_at::text AS date
             FROM pcmazing_projects p
             LEFT JOIN pcmazing_client_prospects c ON c.id = p.prospect_id
             WHERE ${this.statusExpr('p')} IN ('active', 'on_hold')
             ORDER BY p.updated_at DESC
             LIMIT 50`
          : `SELECT
               p.id,
               p.name AS title,
               COALESCE(p.project_type, '') AS subtitle,
               p.status,
               p.updated_at::text AS date
             FROM pcmazing_projects p
             WHERE ${this.statusExpr('p')} IN ('active', 'on_hold')
             ORDER BY p.updated_at DESC
             LIMIT 50`,
      );

      return result.rows.map((row) => ({
        id: row.id,
        title: row.title || `Project #${row.id}`,
        subtitle: row.subtitle || 'Project',
        status: row.status,
        amount: null,
        date: row.date,
        href: `/admin/projects/${row.id}/edit`,
      }));
    } catch (error) {
      console.warn('Dashboard project details query failed:', error);
      return [];
    }
  }

  private async listNetRows(range: DashboardDateRange): Promise<DashboardDetailRow[]> {
    const [start, end] = this.dateBounds(range);
    const [hasSalesOrders, hasJobOrders] = await Promise.all([
      this.tableExists('pcmazing_sales_orders'),
      this.tableExists('pcmazing_services'),
    ]);

    const rows: DashboardDetailRow[] = [];

    try {
      if (hasSalesOrders) {
        await ensureSalesOrderRefundColumns(this.databaseService);
        const salesResult = await this.databaseService.query<{
          id: number;
          title: string | null;
          subtitle: string | null;
          amount: string | null;
          date: string | null;
        }>(
          `SELECT
             o.id,
             COALESCE(NULLIF(TRIM(o.customer_name), ''), o.reference_no, 'Sales order') AS title,
             COALESCE(o.reference_no, 'Sales order') AS subtitle,
             GREATEST(o.total_amount - COALESCE(o.refund_amount, 0), 0)::text AS amount,
             COALESCE(o.sale_date, o.created_at)::text AS date
           FROM pcmazing_sales_orders o
           WHERE o.deleted_at IS NULL
             AND o.is_void = FALSE
             AND COALESCE(o.sale_date, o.created_at) >= $1::timestamptz
             AND COALESCE(o.sale_date, o.created_at) <= $2::timestamptz
           ORDER BY COALESCE(o.sale_date, o.created_at) DESC
           LIMIT 50`,
          [start.toISOString(), end.toISOString()],
        );

        rows.push(
          ...salesResult.rows.map((row) => ({
            id: row.id,
            title: row.title || `Sales #${row.id}`,
            subtitle: row.subtitle || 'Sales order',
            status: 'Completed',
            amount: this.toNumber(row.amount),
            date: row.date,
            href: `/admin/sales-order/${row.id}`,
          })),
        );
      }

      if (hasJobOrders) {
        const jobRows = await this.listJobOrderRows('completed', range);
        rows.push(...jobRows);
      }
    } catch (error) {
      console.warn('Dashboard net details query failed:', error);
      return [];
    }

    return rows
      .sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')))
      .slice(0, 50);
  }

  private toDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private async getOperatingExpenseTotal(
    range: DashboardDateRange,
    previous = false,
  ): Promise<number> {
    try {
      if (!(await this.tableExists('pcmazing_company_expenses'))) {
        return 0;
      }

      const [start, end] = this.dateBounds(range, previous);
      const result = await this.databaseService.query<{ total: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total
         FROM pcmazing_company_expenses
         WHERE deleted_at IS NULL
           AND expense_date >= $1::date
           AND expense_date <= $2::date`,
        [this.toDateOnly(start), this.toDateOnly(end)],
      );
      return this.toNumber(result.rows[0]?.total);
    } catch (error) {
      console.warn('Dashboard operating expenses query failed:', error);
      return 0;
    }
  }

  private async getExpenseCategoryBreakdown(
    range: DashboardDateRange,
  ): Promise<Array<{ label: string; value: number; color: string }>> {
    try {
      if (!(await this.tableExists('pcmazing_company_expenses'))) {
        return [];
      }

      const result = await this.databaseService.query<{ category: string; total: string }>(
        `SELECT category, COALESCE(SUM(amount), 0)::text AS total
         FROM pcmazing_company_expenses
         WHERE deleted_at IS NULL
           AND expense_date >= $1::date
           AND expense_date <= $2::date
         GROUP BY category
         ORDER BY SUM(amount) DESC`,
        [this.toDateOnly(range.start), this.toDateOnly(range.end)],
      );

      return result.rows
        .map((row) => {
          const key = row.category as keyof typeof COMPANY_EXPENSE_CATEGORY_LABELS;
          return {
            label: COMPANY_EXPENSE_CATEGORY_LABELS[key] ?? row.category,
            value: this.toNumber(row.total),
            color: COMPANY_EXPENSE_CATEGORY_COLORS[key] ?? '#94a3b8',
          };
        })
        .filter((item) => item.value > 0);
    } catch (error) {
      console.warn('Dashboard expense category query failed:', error);
      return [];
    }
  }

  private async listOperatingExpenseRows(
    range: DashboardDateRange,
  ): Promise<DashboardDetailRow[]> {
    try {
      if (!(await this.tableExists('pcmazing_company_expenses'))) {
        return [];
      }

      const result = await this.databaseService.query<{
        id: number;
        title: string;
        category: string;
        vendor: string | null;
        amount: string;
        expense_date: string;
        status: string;
      }>(
        `SELECT id, title, category, vendor, amount::text, expense_date::text, status
         FROM pcmazing_company_expenses
         WHERE deleted_at IS NULL
           AND expense_date >= $1::date
           AND expense_date <= $2::date
         ORDER BY expense_date DESC, id DESC
         LIMIT 50`,
        [this.toDateOnly(range.start), this.toDateOnly(range.end)],
      );

      return result.rows.map((row) => {
        const key = row.category as keyof typeof COMPANY_EXPENSE_CATEGORY_LABELS;
        const categoryLabel = COMPANY_EXPENSE_CATEGORY_LABELS[key] ?? row.category;
        return {
          id: row.id,
          title: row.title,
          subtitle: row.vendor ? `${categoryLabel} · ${row.vendor}` : categoryLabel,
          status: row.status,
          amount: this.toNumber(row.amount),
          date: row.expense_date,
          href: '/admin/company-expenses',
        };
      });
    } catch (error) {
      console.warn('Dashboard operating expense details query failed:', error);
      return [];
    }
  }
}
