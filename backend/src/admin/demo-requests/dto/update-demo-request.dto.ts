import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDemoRequestDto {
  @IsOptional()
  @IsIn(['pending', 'followed_up', 'confirmed', 'cancelled'])
  status?: 'pending' | 'followed_up' | 'confirmed' | 'cancelled';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  followUpNotes?: string;
}
