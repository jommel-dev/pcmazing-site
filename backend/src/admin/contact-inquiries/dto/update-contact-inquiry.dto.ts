import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContactInquiryDto {
  @IsOptional()
  @IsIn(['new', 'in_progress', 'resolved'])
  status?: 'new' | 'in_progress' | 'resolved';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
