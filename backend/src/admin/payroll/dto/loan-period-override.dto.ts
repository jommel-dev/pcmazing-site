import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class LoanPeriodDto {
  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}

export class UpsertLoanPeriodOverrideDto extends LoanPeriodDto {
  @IsIn(['skip', 'custom'])
  action!: 'skip' | 'custom';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  customAmount?: number;
}
