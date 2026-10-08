import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { COMMISSION_USER_SOURCES } from './commission-entry.dto';
import type { CommissionUserSource } from './commission-entry.dto';

export class ManualDeductionQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @IsIn([...COMMISSION_USER_SOURCES])
  userSource!: CommissionUserSource;

  @IsDateString()
  dateFrom!: string;

  @IsDateString()
  dateTo!: string;
}

export class CreateManualDeductionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  amount!: number;
}
