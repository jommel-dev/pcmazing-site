import { IsDateString, IsIn, IsISO8601, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export const CLIENT_PROSPECT_PROGRESS_STATUSES = [
  'follow_up',
  'meeting_set',
  'closed_won',
  'closed_lost',
  'return_to_available',
  'pending_decision',
  // legacy — still accepted for existing records
  'called',
  'no_response',
  'emailed',
] as const;

export const FOLLOW_UP_METHODS = ['text', 'call', 'email', 'meet'] as const;

export class UpdateClientProspectStatusDto {
  @IsIn([...CLIENT_PROSPECT_PROGRESS_STATUSES])
  status!: (typeof CLIENT_PROSPECT_PROGRESS_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateIf((dto) => dto.status === 'follow_up')
  @IsDateString()
  followUpDate?: string;

  @ValidateIf((dto) => dto.status === 'follow_up')
  @IsIn([...FOLLOW_UP_METHODS])
  followUpMethod?: string;

  @ValidateIf((dto) => dto.status === 'follow_up')
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @ValidateIf((dto) => dto.status === 'meeting_set')
  @IsString()
  @MaxLength(200)
  title?: string;

  @ValidateIf((dto) => dto.status === 'meeting_set')
  @IsISO8601()
  startsAt?: string;

  @ValidateIf((dto) => dto.status === 'meeting_set')
  @IsISO8601()
  endsAt?: string;

  @ValidateIf((dto) => dto.status === 'meeting_set')
  @IsIn(['face_to_face', 'teams', 'gmeet', 'facebook', 'zoom'])
  meetingType?: string;

  @IsOptional()
  @IsString()
  locationOrLink?: string;
}
