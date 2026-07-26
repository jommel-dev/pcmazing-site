import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientAppointmentDto {
  @IsInt()
  prospectId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsIn(['face_to_face', 'teams', 'gmeet', 'facebook', 'zoom'])
  meetingType!: string;

  @IsOptional()
  @IsString()
  locationOrLink?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
