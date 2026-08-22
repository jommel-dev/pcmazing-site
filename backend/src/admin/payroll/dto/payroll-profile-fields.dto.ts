import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const PAYROLL_SALARY_TYPES = ['weekly', 'semi_monthly', 'monthly', 'cutoff'] as const;
export type PayrollSalaryType = (typeof PAYROLL_SALARY_TYPES)[number];

export const PAYROLL_PAYOUT_METHODS = ['cash', 'online'] as const;
export type PayrollPayoutMethod = (typeof PAYROLL_PAYOUT_METHODS)[number];

export class PayrollProfileFieldsDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  employeeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  positionTitle?: string;

  @IsOptional()
  @IsIn([...PAYROLL_SALARY_TYPES])
  salaryType?: PayrollSalaryType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlySalary?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fixedMonthlySalary?: number | null;

  @IsOptional()
  @IsIn([...PAYROLL_PAYOUT_METHODS])
  payoutMethod?: PayrollPayoutMethod;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bankDetails?: string | null;

  @IsOptional()
  @IsBoolean()
  payrollEnabled?: boolean;
}
