import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateSalesOrderItemDto {
  @IsInt()
  @Min(1)
  materialId!: number;

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

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  customDiscount?: number;

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
