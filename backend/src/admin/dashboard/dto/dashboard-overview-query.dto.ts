import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export type DashboardPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

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
