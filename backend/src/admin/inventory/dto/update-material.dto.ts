import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  materialName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  materialCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  brandId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  productTypeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  productTypeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  unitPrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  orderCost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  sellPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999999)
  onHandStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999999999)
  reorderLevel?: number;
}
