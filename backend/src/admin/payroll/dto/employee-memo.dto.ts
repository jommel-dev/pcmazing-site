import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployeeMemoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  employeeUserId!: number;

  @IsString()
  @IsIn(['verbal_reminder', 'written_warning', 'final_warning', 'other'])
  memoType!: 'verbal_reminder' | 'written_warning' | 'final_warning' | 'other';

  @IsString()
  @MinLength(3)
  @MaxLength(300)
  subject!: string;

  @IsOptional()
  @IsDateString()
  incidentDate?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  statementOfFacts!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  policyViolated?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  directive?: string;

  @IsOptional()
  @IsDateString()
  replyByDate?: string;
}
