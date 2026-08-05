import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProspectContractDto } from '../../marketing/dto/prospect-contract.dto';

const USER_SOURCES = ['pcmazing_admin_users', 'tblusers'] as const;

export class ProjectUserRefDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id!: number;

  @IsIn(USER_SOURCES)
  source!: (typeof USER_SOURCES)[number];
}

export class CreateProjectDto {
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  prospectId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

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

  @ValidateNested()
  @Type(() => ProjectUserRefDto)
  projectManager!: ProjectUserRefDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProjectUserRefDto)
  teamMembers!: ProjectUserRefDto[];
}
