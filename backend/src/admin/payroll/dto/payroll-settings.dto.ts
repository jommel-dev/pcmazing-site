import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const PAYROLL_WORK_WEEKS = ['mon_fri', 'mon_sat', 'day_off_basis'] as const;
export type PayrollWorkWeek = (typeof PAYROLL_WORK_WEEKS)[number];

export const PAYROLL_PERIOD_TYPES = ['weekly', 'semi_monthly', 'monthly', 'cutoff'] as const;
export type PayrollPeriodType = (typeof PAYROLL_PERIOD_TYPES)[number];

export const UNDERTIME_CATEGORIES = ['emergency', 'appointment', 'event', 'other'] as const;
export type UndertimeCategory = (typeof UNDERTIME_CATEGORIES)[number];

export class UpdatePayrollSettingsDto {
  @IsOptional()
  @IsIn([...PAYROLL_WORK_WEEKS])
  workWeek?: PayrollWorkWeek;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  undertimeGraceMinutes?: number;
}
