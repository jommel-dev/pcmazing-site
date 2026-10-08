import { Type } from 'class-transformer';
import {
  IsDateString,
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

export const COMMISSION_USER_SOURCES = [
  'pcmazing_admin_users',
  'tblusers',
] as const;
export type CommissionUserSource = (typeof COMMISSION_USER_SOURCES)[number];

export class CommissionEntryQueryDto {
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

export class CreateCommissionEntryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  typeId?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  label?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(9999999999.99)
  amount!: number;
}
