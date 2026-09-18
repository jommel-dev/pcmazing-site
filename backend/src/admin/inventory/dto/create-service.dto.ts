import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class CreateServicePartDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  materialId!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  serviceTypeId?: number;

  @IsOptional()
  @IsBoolean()
  createCatalogService?: boolean;

  @IsOptional()
  @IsBoolean()
  createInventoryMaterial?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  customItemName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  brandName?: string;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  labor?: number;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'senior', 'pwd'])
  discountType?: 'none' | 'senior' | 'pwd';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  discountAmount?: number;
}

export class CreateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(180)
  customerName?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsEmail()
  @MaxLength(180)
  customerEmail?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(60)
  customerContact?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  serviceName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  personInChargeUserId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['tblusers', 'pcmazing_admin_users'])
  personInChargeSource?: 'tblusers' | 'pcmazing_admin_users';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  type?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => CreateServicePartDto)
  parts?: CreateServicePartDto[];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  cost?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  labor?: number;

  @IsOptional()
  @IsString()
  @IsIn(['none', 'senior', 'pwd'])
  laborDiscountType?: 'none' | 'senior' | 'pwd';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  customDiscount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  downpayment?: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @IsIn(['Cash', 'Gcash', 'Bank Transfer'])
  paymentMethod?: 'Cash' | 'Gcash' | 'Bank Transfer';

  @IsOptional()
  @IsString()
  @MaxLength(60)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceBrand?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(180)
  deviceModel?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceSerial?: string;
}
