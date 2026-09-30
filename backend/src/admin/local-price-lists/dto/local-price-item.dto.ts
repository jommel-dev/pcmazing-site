import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateLocalPriceItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  pricePhp!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateLocalPriceItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  pricePhp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
