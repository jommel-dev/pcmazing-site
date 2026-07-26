import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ProspectDealFieldsDto } from './prospect-deal-fields.dto';

export class CreateClientProspectDto extends ProspectDealFieldsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  clientName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  company?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn(['available', 'picked_up', 'called', 'texted', 'emailed', 'met', 'no_response', 'meeting_set', 'closed_won', 'closed_lost'])
  status?: string;
}
