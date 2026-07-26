import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseItemDto {
  @IsInt()
  @Min(1)
  materialId!: number;

  @IsInt()
  @Min(1)
  @Max(999999)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  unitPrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999.99)
  discountPrice?: number;
}

export class CreatePurchasePaymentDto {
  @IsString()
  @MinLength(1)
  method!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  amount?: number;

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreatePurchaseDto {
  @ValidateIf((dto: CreatePurchaseDto) => !dto.vendorName?.trim())
  @IsUUID()
  vendorId?: string;

  @ValidateIf((dto: CreatePurchaseDto) => !dto.vendorId?.trim())
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  vendorName?: string;

  @IsOptional()
  @IsString()
  poType?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  branchId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseItemDto)
  items!: CreatePurchaseItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchasePaymentDto)
  payments?: CreatePurchasePaymentDto[];
}
