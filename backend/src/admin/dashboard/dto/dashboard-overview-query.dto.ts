import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export const DASHBOARD_DETAIL_METRICS = [
  'activeJobs',
  'completedJobs',
  'inquiries',
  'projects',
  'net',
  'outstanding',
  'discounts',
] as const;

export type DashboardDetailMetric = (typeof DASHBOARD_DETAIL_METRICS)[number];

export class DashboardOverviewQueryDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  period?: DashboardPeriod;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;
}

export class DashboardDetailsQueryDto extends DashboardOverviewQueryDto {
  @IsIn([...DASHBOARD_DETAIL_METRICS])
  metric!: DashboardDetailMetric;
}
