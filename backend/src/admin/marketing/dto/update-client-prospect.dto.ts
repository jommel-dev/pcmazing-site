import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProspectDealFieldsDto } from './prospect-deal-fields.dto';
import { ProspectContractDto } from './prospect-contract.dto';

export class UpdateClientProspectDto extends ProspectDealFieldsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  clientName?: string;

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
  @ValidateNested()
  @Type(() => ProspectContractDto)
  contract?: ProspectContractDto;
}
