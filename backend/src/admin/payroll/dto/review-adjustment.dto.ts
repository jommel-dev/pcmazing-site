import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const ADJUSTMENT_REVIEW_STATUSES = ['approved', 'rejected'] as const;
export type AdjustmentReviewStatus = (typeof ADJUSTMENT_REVIEW_STATUSES)[number];

export class ReviewAdjustmentDto {
  @IsIn([...ADJUSTMENT_REVIEW_STATUSES])
  status!: AdjustmentReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
