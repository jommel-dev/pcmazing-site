import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class CreateSalesOrderItemDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  materialId?: number | null;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(180)
  customItemName?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999999.99)
  quantity!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  unitPrice?: number;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'senior', 'pwd'])
  discountType?: 'none' | 'senior' | 'pwd';

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warrantyValue?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @IsIn(['day', 'week', 'month', 'year'])
  warrantyUnit?: 'day' | 'week' | 'month' | 'year' | null;
}

export class CreateSalesOrderDto {
  @IsString()
  @MaxLength(180)
  customerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(180)
  promotion?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  customDiscount?: number;

  @IsOptional()
  @IsBoolean()
  useManualTotal?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  manualTotalAmount?: number | null;

  @IsOptional()
  @IsDateString()
  saleDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateSalesOrderItemDto)
  items!: CreateSalesOrderItemDto[];
}
