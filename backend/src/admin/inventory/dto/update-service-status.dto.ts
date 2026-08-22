import { IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const JOB_ORDER_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done'] as const;
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
}
