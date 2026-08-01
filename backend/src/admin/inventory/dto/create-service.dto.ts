import {
  ArrayMaxSize,
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
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateServicePartDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  materialId!: number;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999999999.99)
  labor?: number;
}

export class CreateServiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  customerName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  serviceName!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  personInChargeUserId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['tblusers', 'pcmazing_admin_users'])
  personInChargeSource?: 'tblusers' | 'pcmazing_admin_users';

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  type!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
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
}
