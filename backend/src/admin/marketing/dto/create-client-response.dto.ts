import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateClientResponseDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  responseType?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  outcome?: string;
}
