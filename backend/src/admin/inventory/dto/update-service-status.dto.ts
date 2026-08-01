import { IsIn, IsString } from 'class-validator';

export const JOB_ORDER_STATUSES = ['Active', 'Pending', 'Cancelled', 'Done'] as const;
export type JobOrderStatus = (typeof JOB_ORDER_STATUSES)[number];

export class UpdateServiceStatusDto {
  @IsString()
  @IsIn([...JOB_ORDER_STATUSES])
  status!: JobOrderStatus;
}
