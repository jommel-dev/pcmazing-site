import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const OVERTIME_REVIEW_STATUSES = ['approved', 'rejected'] as const;
export type OvertimeReviewStatus = (typeof OVERTIME_REVIEW_STATUSES)[number];

export class ReviewOvertimeDto {
  @IsIn([...OVERTIME_REVIEW_STATUSES])
  status!: OvertimeReviewStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
