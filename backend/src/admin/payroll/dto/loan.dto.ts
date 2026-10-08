import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { COMMISSION_USER_SOURCES } from './commission-entry.dto';
import type { CommissionUserSource } from './commission-entry.dto';

export type LoanTermStyle = 'equal_installments' | 'fixed_per_cutoff';
export type LoanStatus = 'active' | 'paid' | 'cancelled' | 'deleted';

export class LoanQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @IsIn([...COMMISSION_USER_SOURCES])
  userSource!: CommissionUserSource;
}

export class CreateLoanDto extends LoanQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  principal!: number;

  @IsIn(['equal_installments', 'fixed_per_cutoff'])
  termStyle!: LoanTermStyle;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  installmentCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  fixedInstallmentAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateLoanDto {
  @IsOptional()
  @IsIn(['cancelled', 'active', 'deleted'])
  status?: 'cancelled' | 'active' | 'deleted';

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
