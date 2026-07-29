import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProspectContractModuleDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  features?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  processFlow?: string;
}

export class ProspectContractMilestoneDto {
  @IsString()
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  connectedModuleId?: string;
}

export class ProspectContractPaymentScheduleDto {
  @IsString()
  @MaxLength(150)
  label!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  connectedMilestoneId?: string;
}

export class ProspectContractDto {
  @IsString()
  @MaxLength(150)
  projectName!: string;

  @IsString()
  @MaxLength(100)
  projectType!: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProspectContractModuleDto)
  modules!: ProspectContractModuleDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProspectContractMilestoneDto)
  milestones!: ProspectContractMilestoneDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProspectContractPaymentScheduleDto)
  paymentSchedule!: ProspectContractPaymentScheduleDto[];
}

export class PrepareContractSigningDto {
  @ValidateNested()
  @Type(() => ProspectContractDto)
  contract!: ProspectContractDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CompleteContractSigningDto {
  @IsString()
  @MaxLength(200)
  signerName!: string;

  @IsString()
  @MaxLength(200)
  signerEmail!: string;

  @IsString()
  @MaxLength(2000)
  acceptanceStatement!: string;
}
