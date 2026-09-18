import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export const JOB_ORDER_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done', 'Refunded'] as const;
export type JobOrderStatus = (typeof JOB_ORDER_STATUSES)[number];

export class UpdateServiceStatusDto {
  @IsString()
  @IsIn([...JOB_ORDER_STATUSES])
  status!: JobOrderStatus;

  @IsOptional()
  @IsString()
  @IsIn(['Cash', 'Gcash', 'Bank Transfer'])
  paymentMethod?: 'Cash' | 'Gcash' | 'Bank Transfer';

  @ValidateIf((dto) => String(dto.status ?? '').trim().toLowerCase() === 'cancelled')
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  cancelReason?: string;

  @ValidateIf((dto) => String(dto.status ?? '').trim().toLowerCase() === 'refunded')
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  refundReason?: string;

  @ValidateIf((dto) => String(dto.status ?? '').trim().toLowerCase() === 'refunded')
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  refundAmount?: number;
}
