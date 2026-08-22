import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PAYROLL_SALARY_TYPES } from './payroll-profile-fields.dto';
import type { PayrollSalaryType } from './payroll-profile-fields.dto';

export class GeneratePayslipEmployeeDto {
  @IsInt()
  @Type(() => Number)
  userId!: number;

  @IsString()
  userSource!: string;

  @IsIn([...PAYROLL_SALARY_TYPES])
  payslipPeriod!: PayrollSalaryType;
}

export class GeneratePayslipsDto {
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GeneratePayslipEmployeeDto)
  employees?: GeneratePayslipEmployeeDto[];
}
